/**
 * Cross-device sync engine.
 *
 * Each local collection maps to a normalized Supabase table where one row =
 * one entity, stored as `{ user_id, id, data: jsonb, updated_at }` under RLS.
 * Sync is row-level with last-writer-wins by the entity's own timestamp:
 *
 *   - pullAll  → fetch every row, merge into local (newer wins; ties → cloud),
 *                write the merged result back to localStorage.
 *   - pushAll  → upsert all local rows, and delete only server rows that were
 *                present at the last pull but are now gone locally (a real
 *                local delete) — never rows another device created since.
 *   - realtime → a change on another device wakes this one to pull+merge.
 *
 * Offline is the natural resting state: with no client or session, every call
 * is a no-op and the app runs exactly as the local-first version did.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getTasks, saveTasks,
  getTimeBlocks, saveTimeBlocks,
  getTimerSessions, saveTimerSessions,
  getBrainDump, saveBrainDump,
  getProjects, saveProjects,
  getHabits, saveHabits,
  getTrips, saveTrips,
  getCapacityMap, saveCapacityMap,
  getGamificationMap, saveGamificationMap,
  getSettings, saveSettings,
  getPlanningStreak, savePlanningStreak,
  getNotificationPrefs, saveNotificationPrefs,
} from './local-storage';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = Record<string, any> & { id: string };

interface Collection {
  table: string;            // suffix after cadence_
  read(): AnyRow[];         // flatten local state to id'd rows
  write(rows: AnyRow[]): void; // rebuild local state from id'd rows
}

// Row-array + map-backed collections, all flattened to id'd rows.
const COLLECTIONS: Collection[] = [
  { table: 'tasks', read: () => getTasks() as AnyRow[], write: (r) => saveTasks(r as any) },
  { table: 'time_blocks', read: () => getTimeBlocks() as AnyRow[], write: (r) => saveTimeBlocks(r as any) },
  { table: 'timer_sessions', read: () => getTimerSessions() as AnyRow[], write: (r) => saveTimerSessions(r as any) },
  { table: 'brain_dump', read: () => getBrainDump() as AnyRow[], write: (r) => saveBrainDump(r as any) },
  { table: 'projects', read: () => getProjects() as AnyRow[], write: (r) => saveProjects(r as any) },
  { table: 'habits', read: () => getHabits() as AnyRow[], write: (r) => saveHabits(r as any) },
  { table: 'trips', read: () => getTrips<AnyRow>(), write: (r) => saveTrips(r) },
  {
    table: 'capacity',
    read: () => Object.values(getCapacityMap()) as AnyRow[],
    write: (rows) => {
      const m: Record<string, any> = {};
      for (const r of rows) if (r.date) m[r.date] = r;
      saveCapacityMap(m);
    },
  },
  {
    table: 'gamification',
    read: () => Object.values(getGamificationMap()).flat() as AnyRow[],
    write: (rows) => {
      const m: Record<string, any[]> = {};
      for (const r of rows) { if (!r.date) continue; (m[r.date] ||= []).push(r); }
      saveGamificationMap(m);
    },
  },
];

// Singletons live in cadence_kv keyed by (user_id, key).
interface KvEntry { key: string; read(): any; write(v: any): void; }
const KV: KvEntry[] = [
  { key: 'settings', read: getSettings, write: (v) => saveSettings(v) },
  { key: 'planning_streak', read: getPlanningStreak, write: (v) => savePlanningStreak(v) },
  { key: 'notifications', read: getNotificationPrefs, write: (v) => saveNotificationPrefs(v) },
];

// Ids present on the server at the last pull, per table — the delete baseline.
const baseline: Record<string, Set<string>> = {};

export function resetBaseline() {
  for (const k of Object.keys(baseline)) delete baseline[k];
}

function tsOf(d: any): string | null {
  return (d && (d.updatedAt || d.completedAt || d.createdAt)) || null;
}

/** Merge local + server rows by id; newer timestamp wins, ties go to cloud. */
export function mergeRows(local: AnyRow[], server: { id: string; data: AnyRow }[]): AnyRow[] {
  const map = new Map<string, AnyRow>();
  for (const r of local) map.set(r.id, r);
  for (const s of server) {
    const existing = map.get(s.id);
    if (!existing) { map.set(s.id, s.data); continue; }
    const lt = tsOf(existing);
    const st = tsOf(s.data);
    let takeServer: boolean;
    if (lt && st) takeServer = st >= lt;      // newer, ties → cloud
    else if (st && !lt) takeServer = true;
    else if (lt && !st) takeServer = false;
    else takeServer = true;                   // neither stamped → cloud on login
    if (takeServer) map.set(s.id, s.data);
  }
  return [...map.values()];
}

// ── KV timestamp watermarks (localStorage) ──────────────────
const KV_TS_KEY = 'cadence:sync:kvts';
function getKvTs(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KV_TS_KEY) || '{}'); } catch { return {}; }
}
function setKvTs(key: string, ts: string) {
  const m = getKvTs(); m[key] = ts;
  try { localStorage.setItem(KV_TS_KEY, JSON.stringify(m)); } catch { /* quota */ }
}

// ── Pull ────────────────────────────────────────────────────
async function pullCollection(sb: SupabaseClient, userId: string, c: Collection) {
  const { data, error } = await sb.from(`cadence_${c.table}`).select('id,data').eq('user_id', userId);
  if (error) throw error;
  const server = (data || []) as { id: string; data: AnyRow }[];
  baseline[c.table] = new Set(server.map((r) => r.id));
  c.write(mergeRows(c.read(), server));
}

async function pullKv(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb.from('cadence_kv').select('key,data,updated_at').eq('user_id', userId);
  if (error) throw error;
  const byKey = new Map((data || []).map((r: any) => [r.key, r]));
  const ts = getKvTs();
  for (const k of KV) {
    const server = byKey.get(k.key);
    if (!server) continue;
    if (!ts[k.key] || server.updated_at > ts[k.key]) {
      k.write(server.data);
      setKvTs(k.key, server.updated_at);
    }
  }
}

export async function pullAll(sb: SupabaseClient, userId: string) {
  for (const c of COLLECTIONS) await pullCollection(sb, userId, c);
  await pullKv(sb, userId);
}

// ── Push ────────────────────────────────────────────────────
async function pushCollection(sb: SupabaseClient, userId: string, c: Collection) {
  const rows = c.read();
  const localIds = new Set(rows.map((r) => r.id));
  if (rows.length) {
    const payload = rows.map((r) => ({ user_id: userId, id: r.id, data: r }));
    const { error } = await sb.from(`cadence_${c.table}`).upsert(payload, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
  const base = baseline[c.table];
  if (base) {
    const toDelete = [...base].filter((id) => !localIds.has(id));
    if (toDelete.length) {
      const { error } = await sb.from(`cadence_${c.table}`).delete().eq('user_id', userId).in('id', toDelete);
      if (error) throw error;
    }
  }
  baseline[c.table] = localIds;
}

async function pushKv(sb: SupabaseClient, userId: string) {
  const payload = KV.map((k) => ({ user_id: userId, key: k.key, data: k.read() }));
  const { data, error } = await sb.from('cadence_kv').upsert(payload, { onConflict: 'user_id,key' }).select('key,updated_at');
  if (error) throw error;
  for (const r of (data || []) as any[]) setKvTs(r.key, r.updated_at);
}

export async function pushAll(sb: SupabaseClient, userId: string) {
  for (const c of COLLECTIONS) await pushCollection(sb, userId, c);
  await pushKv(sb, userId);
}

// ── Realtime ────────────────────────────────────────────────
/** Wake `onRemote` (debounced) whenever any of the user's rows change elsewhere. */
export function subscribeRealtime(sb: SupabaseClient, userId: string, onRemote: () => void): () => void {
  const tables = [...COLLECTIONS.map((c) => `cadence_${c.table}`), 'cadence_kv'];
  const channel = sb.channel(`cadence:${userId}`);
  for (const t of tables) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `user_id=eq.${userId}` }, onRemote);
  }
  channel.subscribe();
  return () => { try { sb.removeChannel(channel); } catch { /* noop */ } };
}
