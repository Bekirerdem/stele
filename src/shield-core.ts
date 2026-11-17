// The answer shield, without any I/O: the prompts, the response shapes and
// the code checks. It runs the same in Node and in the browser.
//
// Cryptography hides who sent an answer; the shield hides who wrote it. A
// model reads the draft and LISTS the parts that could identify the writer
// (it does not rewrite on its own). The writer decides, part by part,
// whether to generalize it or keep it, because sometimes the detail is the
// evidence: "one nurse for 12 patients" narrows down who wrote it and is
// also the complaint. Then the style is neutralized with the writer's
// choices held fixed, and code (not the model) checks that every part the
// writer chose to generalize is really gone.
//
// SPDX-License-Identifier: MIT

export type FlagType = 'insult' | 'date_time' | 'event' | 'name' | 'role' | 'unique_detail' | 'style';

export type Flag = {
  /** The exact span from the draft. */
  text: string;
  type: FlagType;
  /** Why it could identify the writer (or why it is an insult). */
  why: string;
  /** A generalized replacement that keeps the claim. Empty to drop the span. */
  suggestion: string;
};

export type Decision = 'generalize' | 'keep';

export const FLAG_TYPES: FlagType[] = ['insult', 'date_time', 'event', 'name', 'role', 'unique_detail', 'style'];

export const DETECT_SYSTEM = `You protect anonymous answers. A person is answering, honestly and without fear, a question about their workplace, community or manager. Before the answer is sent, find every part of it that could identify who wrote it, and every insult.

Look for:
- insult: swearing, slurs, demeaning words, threats. The claim underneath stays.
- date_time: a specific day, date, time or "last Tuesday".
- event: a named meeting or incident few people attended or know about.
- name: a person's name.
- role: the writer's title, position or a role only one or two people hold ("the only designer", "the nurse in charge that night").
- unique_detail: a floor, unit, city office, year of study, number or experience that narrows the group.
- style: slang, dialect spelling, repeated punctuation, emoji, signature phrases.

For each, give the EXACT span copied from the answer, its type, a short reason in the answer's language, and a suggestion: a general replacement that keeps the claim and its severity ("last Tuesday's sprint meeting" -> "a team meeting"; "the only woman engineer in the Ankara office" -> "a woman engineer"). For a pure style mark (an emoji, "lol"), the suggestion may be empty.

Rules:
- Never soften the claim. "Incompetent" stays as strong; a concrete incident stays concrete.
- Never invent information the answer did not contain.
- Do not flag ordinary words that identify nobody.
- When identifying parts sit next to each other ("last Tuesday's sprint meeting"), flag the whole phrase once, not each piece.
- A suggestion must not itself identify the writer ("the only designer" -> "a designer", not "the only design person").
- If nothing needs flagging, return an empty list.
Return only JSON.`;

export const DETECT_SCHEMA = {
  name: 'stele_flags',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['flags'],
    properties: {
      flags: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'type', 'why', 'suggestion'],
          properties: {
            text: { type: 'string' },
            type: { type: 'string', enum: FLAG_TYPES },
            why: { type: 'string' },
            suggestion: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

export const NORMALIZE_SYSTEM = `You rewrite an anonymous answer into plain, standard written language so its style does not identify the writer: no slang, no dialect spelling, no emoji, no repeated punctuation, no signature phrases, no swearing.

Rules:
- Keep every claim, its severity and its emotion. Do not soften, summarize, generalize further or add anything.
- Keep the same language as the answer.
- The spans listed under KEEP must appear in your output exactly as written.
- If the answer is already plain, return it unchanged.
Return only JSON.`;

export const NORMALIZE_SCHEMA = {
  name: 'stele_plain',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: { text: { type: 'string' } },
  },
} as const;

/** The chat request body for one shield step. */
export const shieldRequest = (model: string, system: string, user: string, schema: object) => {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.1,
    max_tokens: 4000,
    response_format: { type: 'json_schema', json_schema: schema },
  };
  // Both models think before answering unless told not to, and the thinking
  // can eat the whole token budget before any JSON appears.
  if (model.startsWith('z-ai/glm')) body['reasoning_effort'] = 'low';
  else body['chat_template_kwargs'] = { enable_thinking: false };
  return body;
};

const jsonOf = (content: unknown): unknown => {
  const m = String(content ?? '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('The shield returned no JSON');
  return JSON.parse(m[0]);
};

/** Parses and cleans the detector's reply: only spans that really occur in the draft survive. */
export const parseFlags = (content: unknown, draft: string): Flag[] => {
  const raw = (jsonOf(content) as { flags?: unknown }).flags;
  if (!Array.isArray(raw)) throw new Error('The shield returned no flag list');
  const seen = new Set<string>();
  const out: Flag[] = [];
  for (const f of raw as Partial<Flag>[]) {
    const text = String(f.text ?? '').trim();
    if (!text || !draft.includes(text) || seen.has(text)) continue;
    if (!FLAG_TYPES.includes(f.type as FlagType)) continue;
    seen.add(text);
    out.push({ text, type: f.type as FlagType, why: String(f.why ?? ''), suggestion: String(f.suggestion ?? '').trim() });
  }
  // Longest first, so replacing a long span never breaks a shorter one inside it.
  return out.sort((a, b) => b.text.length - a.text.length);
};

export const parsePlain = (content: unknown): string => {
  const text = (jsonOf(content) as { text?: unknown }).text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('The shield returned no text');
  return text.trim();
};

/** Applies the writer's choices: every span marked generalize is replaced by its suggestion. */
export const applyDecisions = (draft: string, flags: Flag[], decisions: Decision[]): string => {
  let text = draft;
  flags.forEach((f, i) => {
    if (decisions[i] === 'generalize') text = text.split(f.text).join(f.suggestion);
  });
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
};

/** The normalizer's user message: the text, and the spans it must keep. */
export const normalizeInput = (text: string, keep: string[]): string =>
  keep.length === 0 ? text : `${text}\n\nKEEP:\n${keep.map((k) => `- ${k}`).join('\n')}`;

/**
 * The code check, no model involved. A span the writer chose to generalize
 * must not be in the final text (compared case-insensitively); a span the
 * writer chose to keep should still be there.
 */
export const checkFinal = (final: string, flags: Flag[], decisions: Decision[]) => {
  const lower = final.toLocaleLowerCase();
  const leaked: Flag[] = [];
  const lost: Flag[] = [];
  flags.forEach((f, i) => {
    const has = lower.includes(f.text.toLocaleLowerCase());
    if (decisions[i] === 'generalize' && has && f.text.toLocaleLowerCase() !== f.suggestion.toLocaleLowerCase()) leaked.push(f);
    if (decisions[i] === 'keep' && !has && f.type !== 'style' && f.type !== 'insult') lost.push(f);
  });
  return { ok: leaked.length === 0, leaked, lost };
};
