/**
 * The provider-agnostic AI layer. Framework-free (no Nitro globals) so it can be
 * unit tested with a fake provider and an in-memory store.
 *
 * Rules (spec sections 8 and 10):
 *  - Keys are server-only; the AI never decides urgency, only language and extraction.
 *  - Every call goes through `runAi`, which refuses before reaching a provider when
 *    the user has AI switched off (checked here, on the server, so another device
 *    cannot bypass it) or is over their usage cap.
 *  - Callers build the prompt from `buildSlice`, which drops Private nodes, so a
 *    Private node never appears in a provider payload.
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, type LanguageModel } from 'ai';
import type { Node } from '../../lib/domain/types';

// ── providers ─────────────────────────────────────────────────

/** 'fast' for small wording jobs, 'strong' for extraction and coaching. */
export type ModelTier = 'fast' | 'strong';

export interface AiRequest {
  tier: ModelTier;
  system: string;
  prompt: string;
  maxTokens: number;
}

/** One text-in, text-out call. Adapters throw on transport or API failure. */
export interface AiProvider {
  complete(req: AiRequest): Promise<string>;
}

export interface ModelNames { fast: string; strong: string }
export const DEFAULT_ANTHROPIC_MODELS: ModelNames = { fast: 'claude-haiku-4-5', strong: 'claude-sonnet-5-5' };

/** One adapter for any Vercel AI SDK language model, picked per tier. */
function fromModels(models: Record<ModelTier, LanguageModel>): AiProvider {
  return {
    async complete(req) {
      const { text } = await generateText({
        model: models[req.tier],
        system: req.system,
        prompt: req.prompt,
        maxOutputTokens: req.maxTokens,
      });
      return text;
    },
  };
}

/** Anthropic (the default). */
export function createAnthropicProvider(opts: { apiKey: string; models?: Partial<ModelNames> }): AiProvider {
  const anthropic = createAnthropic({ apiKey: opts.apiKey });
  const names = { ...DEFAULT_ANTHROPIC_MODELS, ...opts.models };
  return fromModels({ fast: anthropic(names.fast), strong: anthropic(names.strong) });
}

/** Any OpenAI-compatible chat endpoint, which also reaches local models (Ollama, LM Studio). */
export function createOpenAiCompatProvider(opts: {
  baseUrl: string; apiKey?: string; models: ModelNames; fetch?: typeof fetch;
}): AiProvider {
  const compat = createOpenAICompatible({ name: 'openai-compatible', baseURL: opts.baseUrl.replace(/\/$/, ''), apiKey: opts.apiKey, fetch: opts.fetch });
  return fromModels({ fast: compat.chatModel(opts.models.fast), strong: compat.chatModel(opts.models.strong) });
}

// ── what may be sent ──────────────────────────────────────────

/** The nodes an AI call may see: Private ones are dropped here, once, for every feature. */
export function buildSlice<T extends Pick<Node, 'private'>>(nodes: readonly T[]): T[] {
  return nodes.filter((n) => !n.private);
}

// ── gate: AI-off and usage cap ────────────────────────────────

/** Default calls per user per rolling 24 hours; override with AI_DAILY_CALL_CAP. */
export const DEFAULT_DAILY_CALL_CAP = 100;
export const CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface AiStore {
  /** The user's server-side AI switch. On unless they turned it off. */
  isAiOn(userId: string): Promise<boolean>;
  /** Calls this user made at or after sinceIso. */
  countSince(userId: string, sinceIso: string): Promise<number>;
  recordUse(userId: string, atIso: string, tier: ModelTier): Promise<void>;
}

export type AiResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'ai_off' | 'over_cap' | 'unavailable' };

export interface AiDeps {
  provider: AiProvider | null;
  store: AiStore;
  now?: () => number;
  dailyCap?: number;
}

/** Run one AI call for a user, or say calmly why it did not run. Never throws. */
export async function runAi(deps: AiDeps, userId: string, req: AiRequest): Promise<AiResult> {
  if (!deps.provider) return { ok: false, reason: 'unavailable' };
  try {
    if (!(await deps.store.isAiOn(userId))) return { ok: false, reason: 'ai_off' };
    const now = (deps.now ?? Date.now)();
    const used = await deps.store.countSince(userId, new Date(now - CAP_WINDOW_MS).toISOString());
    if (used >= (deps.dailyCap ?? DEFAULT_DAILY_CALL_CAP)) return { ok: false, reason: 'over_cap' };
    // Recorded before the call so a failing provider cannot be hammered past the cap.
    await deps.store.recordUse(userId, new Date(now).toISOString(), req.tier);
    return { ok: true, text: await deps.provider.complete(req) };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** In-memory store for tests. */
export function createMemoryAiStore(opts: { aiOn?: boolean } = {}): AiStore & { uses: { userId: string; at: string; tier: ModelTier }[]; aiOn: boolean } {
  const uses: { userId: string; at: string; tier: ModelTier }[] = [];
  const store = {
    uses,
    aiOn: opts.aiOn ?? true,
    async isAiOn() { return store.aiOn; },
    async countSince(userId: string, sinceIso: string) { return uses.filter((u) => u.userId === userId && u.at >= sinceIso).length; },
    async recordUse(userId: string, at: string, tier: ModelTier) { uses.push({ userId, at, tier }); },
  };
  return store;
}

// ── Supabase store ────────────────────────────────────────────

/** The slice of the Supabase client the store uses, so it can be faked in tests. */
export interface AiSupabaseLike {
  from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Backed by `ai_settings` and `ai_usage` (supabase/drafts/0004_ai_layer.sql), written with the service role. */
export function createSupabaseAiStore(db: AiSupabaseLike): AiStore {
  return {
    async isAiOn(userId) {
      const { data, error } = await db.from('ai_settings').select('ai_enabled').eq('user_id', userId).maybeSingle();
      if (error) throw new Error('ai_settings read failed');
      return data ? data.ai_enabled !== false : true;
    },
    async countSince(userId, sinceIso) {
      const { count, error } = await db.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('used_at', sinceIso);
      if (error) throw new Error('ai_usage read failed');
      return count ?? 0;
    },
    async recordUse(userId, atIso, tier) {
      const { error } = await db.from('ai_usage').insert({ user_id: userId, used_at: atIso, tier });
      if (error) throw new Error('ai_usage write failed');
    },
  };
}
