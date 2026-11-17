// Keys, nullifiers, the rules hash and the answer blob.
//
// An answer never goes on chain. What goes on chain is the SHA-256 digest of
// the stored blob, keyed by the member's nullifier. The blob is the answer
// padded to a fixed size bucket (so its length says little about what was
// written), and, when only the asker may read answers, sealed to the asker's
// X25519 keys with the question and the contract bound in as associated data.
//
// SPDX-License-Identifier: MIT

import { x25519 } from '@noble/curves/ed25519.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { pureCircuits } from '../contract/index.js';

export const newSecretKey = (): Uint8Array => randomBytes(32);

export const askerKey = (sk: Uint8Array): Uint8Array => pureCircuits.askerKey(sk);
export const moderatorKey = (sk: Uint8Array): Uint8Array => pureCircuits.moderatorKey(sk);
export const memberKey = (sk: Uint8Array): Uint8Array => pureCircuits.memberKey(sk);

/** The question and contract instance a nullifier and a sealed blob are bound to. */
export type QuestionInstance = { questionId: Uint8Array; address: Uint8Array };

export const questionInstance = (questionId: Uint8Array, address: string): QuestionInstance => {
  const a = fromHex(address);
  if (a.length !== 32) throw new Error('contract address must be 32 bytes of hex');
  return { questionId, address: a };
};

export const answerNullifier = (sk: Uint8Array, q: QuestionInstance): Uint8Array =>
  pureCircuits.answerNullifier(sk, q.questionId, q.address);

/** A question id from a short human label, e.g. "acme-2026-q4". */
export const questionIdFromLabel = (label: string): Uint8Array => {
  const bytes = new TextEncoder().encode(label);
  if (bytes.length === 0 || bytes.length > 32) throw new Error('Question label must be 1-32 bytes');
  const out = new Uint8Array(32);
  out.set(bytes);
  return out;
};

export const questionLabel = (id: Uint8Array): string => {
  const end = id.indexOf(0);
  return new TextDecoder().decode(end === -1 ? id : id.subarray(0, end));
};

export const keyFingerprint = (key: Uint8Array): string => toHex(sha256(key)).slice(0, 32);

// --- The rules document -----------------------------------------------------

export type Visibility = 'public' | 'asker_only';

/** Everything the asker commits to when the question opens. */
export type Rules = {
  version: 1;
  title: string;
  prompts: string[];
  visibility: Visibility;
  minAnswers: number;
  moderation: { remove: string[]; model: string; provider: string };
  promise?: string;
};

/** JSON with object keys sorted, so the same rules always hash the same. */
export const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export const rulesHash = (rules: Rules): Uint8Array => sha256(new TextEncoder().encode(canonicalJson(rules)));

export const validateRules = (rules: Rules): Rules => {
  if (rules.version !== 1) throw new Error('rules.version must be 1');
  if (!rules.title?.trim()) throw new Error('rules.title is required');
  if (!Array.isArray(rules.prompts) || rules.prompts.length === 0 || rules.prompts.length > 5)
    throw new Error('rules.prompts needs 1 to 5 questions');
  if (rules.visibility !== 'public' && rules.visibility !== 'asker_only')
    throw new Error("rules.visibility must be 'public' or 'asker_only'");
  if (!Number.isInteger(rules.minAnswers) || rules.minAnswers < 3) throw new Error('rules.minAnswers must be at least 3');
  return rules;
};

// --- The answer blob --------------------------------------------------------

/** What a member submits: one text per prompt. */
export type AnswerBody = { v: 1; answers: string[] };

const PLAIN = 0x00;
const SEALED = 0x01;
const VERSION = 1;
const NONCE = 24;
const WRAP = 32 + 16;
const BUCKETS = [1024, 2048, 4096, 8192, 16384];
const INFO = new TextEncoder().encode('stele:answer:v1');

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
};

const u32 = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const readU32 = (b: Uint8Array, at: number): number => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;

/** Length-prefixed body, zero-padded to the next bucket. */
export const padBody = (body: AnswerBody): Uint8Array => {
  const json = new TextEncoder().encode(JSON.stringify(body));
  const need = 4 + json.length;
  const size = BUCKETS.find((b) => b >= need);
  if (size === undefined) throw new Error(`Answer too long (${json.length} bytes; the limit is ${BUCKETS.at(-1)! - 4})`);
  const out = new Uint8Array(size);
  out.set(u32(json.length));
  out.set(json, 4);
  return out;
};

export const unpadBody = (padded: Uint8Array): AnswerBody => {
  const len = readU32(padded, 0);
  if (len + 4 > padded.length) throw new Error('Malformed answer body');
  for (let i = 4 + len; i < padded.length; i++) if (padded[i] !== 0) throw new Error('Malformed answer padding');
  const body = JSON.parse(new TextDecoder().decode(padded.subarray(4, 4 + len))) as AnswerBody;
  if (body.v !== 1 || !Array.isArray(body.answers) || body.answers.some((a) => typeof a !== 'string'))
    throw new Error('Malformed answer body');
  return body;
};

export const digestOf = (blob: Uint8Array): Uint8Array => sha256(blob);

const aadFor = (header: Uint8Array, q: QuestionInstance) => concat(header, q.questionId, q.address);
const kek = (shared: Uint8Array, ephPub: Uint8Array, recipient: Uint8Array) =>
  hkdf(sha256, shared, concat(ephPub, recipient), INFO, 32);

export type EncryptionKeys = { secretKey: Uint8Array; publicKey: Uint8Array };

export const newEncryptionKeys = (): EncryptionKeys => {
  const secretKey = x25519.utils.randomSecretKey();
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
};

export const encryptionPublicKey = (secretKey: Uint8Array): Uint8Array => x25519.getPublicKey(secretKey);

/** A blob anyone can read (visibility 'public'). Still padded. */
export const plainBlob = (body: AnswerBody): Uint8Array => concat(Uint8Array.of(PLAIN, VERSION), padBody(body));

/**
 * A blob only the holders of `recipients` can read (visibility 'asker_only').
 * One random content key, wrapped once per recipient; the question id and
 * contract address are associated data, so a blob copied into another
 * question won't open.
 */
export const sealedBlob = (body: AnswerBody, recipients: readonly Uint8Array[], q: QuestionInstance): Uint8Array => {
  if (recipients.length === 0 || recipients.length > 4) throw new Error('Need 1 to 4 asker keys');
  const contentKey = randomBytes(32);
  const eph = x25519.utils.randomSecretKey();
  const ephPub = x25519.getPublicKey(eph);
  const header = concat(Uint8Array.of(SEALED, VERSION), ephPub, Uint8Array.of(recipients.length));
  const aad = aadFor(header, q);
  const wraps = recipients.map((r) => {
    const nonce = randomBytes(NONCE);
    return concat(nonce, xchacha20poly1305(kek(x25519.getSharedSecret(eph, r), ephPub, r), nonce, aad).encrypt(contentKey));
  });
  const nonce = randomBytes(NONCE);
  const sealed = xchacha20poly1305(contentKey, nonce, aad).encrypt(padBody(body));
  return concat(header, ...wraps, nonce, sealed);
};

/** Reads a blob. Sealed blobs need one of the asker's X25519 secrets. */
export const openBlob = (blob: Uint8Array, q: QuestionInstance, secretKey?: Uint8Array): AnswerBody => {
  if (blob[1] !== VERSION) throw new Error('Unknown answer version');
  if (blob[0] === PLAIN) return unpadBody(blob.subarray(2));
  if (blob[0] !== SEALED) throw new Error('Unknown answer format');
  if (!secretKey) throw new Error('This answer is sealed to the asker');
  const headerLen = 2 + 32 + 1;
  const ephPub = blob.subarray(2, 34);
  const n = blob[34]!;
  const header = blob.subarray(0, headerLen);
  const aad = aadFor(header, q);
  const key = kek(x25519.getSharedSecret(secretKey, ephPub), ephPub, x25519.getPublicKey(secretKey));
  const bodyAt = headerLen + n * (NONCE + WRAP);
  for (let i = 0; i < n; i++) {
    const at = headerLen + i * (NONCE + WRAP);
    let contentKey: Uint8Array;
    try {
      contentKey = xchacha20poly1305(key, blob.subarray(at, at + NONCE), aad).decrypt(blob.subarray(at + NONCE, at + NONCE + WRAP));
    } catch {
      continue;
    }
    const padded = xchacha20poly1305(contentKey, blob.subarray(bodyAt, bodyAt + NONCE), aad).decrypt(blob.subarray(bodyAt + NONCE));
    return unpadBody(padded);
  }
  throw new Error('This answer was not sealed to this key');
};

export { toHex, fromHex };
