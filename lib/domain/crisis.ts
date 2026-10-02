/**
 * Crisis-language handling (ticket 24). Framework-free (no Vue/Nuxt imports).
 *
 * Detection is on-device rules only: nothing is sent anywhere to be checked, it works with
 * AI off, and it ignores the Private flag. The rules look for first-person intent phrases,
 * not single words, and skip idioms ("I could kill myself for forgetting", "I want to die of
 * embarrassment"). A wrong match costs the user one tap, so the rules lean towards catching.
 *
 * Helpline numbers, each checked against its official site on 2026-10-01:
 *  - US 988 Suicide & Crisis Lifeline: call or text 988, 24/7 (988lifeline.org)
 *  - Canada 988 Suicide Crisis Helpline: call or text 988, 24/7 (988.ca)
 *  - UK and Ireland Samaritans: 116 123, free, 24 hours (samaritans.org/how-we-can-help/contact-samaritan)
 *  - Australia Lifeline: 13 11 14, 24/7 (lifeline.org.au/get-help)
 *  - Everywhere else: findahelpline.com (ThroughLine, helplines in 175+ countries)
 */

// ── detection ───────────────────────────────────────────────────

function normalise(text: string): string {
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "I", "I'm", "I've", "I'd", "I'll" followed by up to four words, so "I really just want to ..." still reads as first person. */
const I = "(?:\\bi\\b|\\bi'm\\b|\\bim\\b|\\bi've\\b|\\bive\\b|\\bi'd\\b|\\bid\\b|\\bi'll\\b|\\bill\\b)(?:\\s+[a-z']+){0,4}?\\s+";
const INTENT = "(?:want|wanna|going|gonna|need|plan|planning|ready|keep|feel like|urge|thinking of|thinking about)(?: to| on)?";
/** Wanting to die: no "going to", which is the idiom in "I'm going to die if I miss the bus". */
const INTENT_DIE = "(?:want|wanna|need|plan|planning|ready|feel like|thinking of|thinking about)(?: to)?";

const RULES: RegExp[] = [
  // Ending it (idiom skips: "kill myself for forgetting", "kill myself if I miss it", "kill myself laughing")
  new RegExp(`${I}(?:kill|killing) myself(?! (?:for|if|laughing|over|when|trying|doing|getting)\\b)`),
  new RegExp(`${I}(?:end|ending|take|taking) my (?:own )?life\\b`),
  new RegExp(`${I}(?:commit|committing) suicide\\b`),
  new RegExp(`${I}suicidal\\b`),
  // Wanting to die (idiom skips: "want to die of embarrassment")
  new RegExp(`${I}${INTENT_DIE} (?:die|be dead|end it all)(?! (?:of|from|laughing|inside|a little)\\b)`),
  new RegExp(`${I}wish i (?:was|were) (?:dead|gone)\\b`),
  new RegExp(`${I}wish i (?:wouldn't|would not) wake up\\b`),
  new RegExp(`${I}(?:don't|do not|no longer) want to (?:live|be alive|exist|go on living)\\b`),
  // No way forward
  /\b(?:no|any) (?:reason|point) (?:to|in) (?:live|living|go on living|being alive)\b/,
  /\bbetter off without me\b/,
  /\beveryone (?:would|will) be better off if i (?:was|were) (?:gone|dead)\b/,
  // Hurting oneself (idiom skips: "cut myself some slack", "cut myself off")
  new RegExp(`${I}${INTENT} (?:hurt|hurting|harm|harming|cut|cutting) myself(?! (?:some slack|off|short|loose|a break)\\b)`),
  /\bself harm(?:ing)?\b|\bselfharm\b/,
];

/** True if the text reads as crisis or self-harm language. Pure and on-device. */
export function checkCrisis(text: string): boolean {
  const t = normalise(text);
  return t.length > 0 && RULES.some((r) => r.test(t));
}

export type AiReplyGuard = { ok: true; text: string } | { ok: false };

/**
 * For AI output in Discuss: a reply that matches is dropped, and the caller shows the calm
 * crisis card instead. Nothing about the match is recorded.
 */
export function guardAiReply(text: string): AiReplyGuard {
  return checkCrisis(text) ? { ok: false } : { ok: true, text };
}

// ── resources ───────────────────────────────────────────────────

export interface Resource {
  name: string;
  /** Plain words the card shows under the name. */
  detail: string;
  /** A tap-to-call link, e.g. "tel:988". */
  tel?: string;
  /** A tap-to-text link, e.g. "sms:988". */
  sms?: string;
  /** A tap-to-open web link. */
  url?: string;
}

export interface ResourceSet {
  /** The country the list is for, or null for the worldwide fallback. */
  country: string | null;
  resources: Resource[];
}

const FIND_A_HELPLINE: Resource = { name: 'Find a helpline', detail: 'Free, confidential support near you, in over 175 countries.', url: 'https://findahelpline.com' };

const SAMARITANS: Resource = { name: 'Samaritans', detail: 'Call 116 123, free, any time.', tel: 'tel:116123' };

const BY_COUNTRY: Record<string, Resource[]> = {
  US: [{ name: '988 Suicide & Crisis Lifeline', detail: 'Call or text 988, any time.', tel: 'tel:988', sms: 'sms:988' }],
  CA: [{ name: '988 Suicide Crisis Helpline', detail: 'Call or text 988, any time.', tel: 'tel:988', sms: 'sms:988' }],
  GB: [SAMARITANS],
  IE: [SAMARITANS],
  AU: [{ name: 'Lifeline', detail: 'Call 13 11 14, any time.', tel: 'tel:131114' }],
};

/** Countries with a built-in list (for the Settings picker). */
export const COUNTRY_CHOICES: { code: string; label: string }[] = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IE', label: 'Ireland' },
  { code: 'AU', label: 'Australia' },
];

/** What to show for a country (ISO code, "UK" accepted). Unknown or missing: the worldwide finder alone. */
export function resourcesFor(country: string | null | undefined): ResourceSet {
  const code = (country ?? '').trim().toUpperCase().replace(/^UK$/, 'GB');
  const list = BY_COUNTRY[code];
  return list ? { country: code, resources: [...list, FIND_A_HELPLINE] } : { country: null, resources: [FIND_A_HELPLINE] };
}

/** The region of a locale such as "en-US" or "en-GB", upper-cased; null when it has none. */
export function countryFromLocale(locale: string | readonly string[] | null | undefined): string | null {
  const first = Array.isArray(locale) ? locale[0] : locale;
  if (typeof first !== 'string') return null;
  const m = /^[a-z]{2,3}(?:[-_][A-Za-z]{4})?[-_]([A-Za-z]{2})\b/.exec(first.trim());
  return m ? m[1]!.toUpperCase() : null;
}
