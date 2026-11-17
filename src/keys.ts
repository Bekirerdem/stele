// The key files the CLI reads. They hold secrets: written with mode 0600
// under .stele/ (gitignored), or STELE_KEYS_DIR to keep several identities on
// one machine for a dry run.
//   asker.json   { secretKey, moderatorSecretKey, encSecretKey, encPublicKey }
//                the asker's contract secret (askerPk = its hash), the
//                moderator secret, and the X25519 pair answers are sealed to
//   member.json  { secretKey }  one member's secret; memberKey(secretKey) is
//                what the asker enrols. The same file works for every question.
//
// SPDX-License-Identifier: MIT

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { newEncryptionKeys, newSecretKey } from './crypto.js';

export const steleDir = (): string => fileURLToPath(new URL('../.stele/', import.meta.url));
export const keysDir = (): string => process.env['STELE_KEYS_DIR'] ?? steleDir();

export type AskerKeys = {
  secretKey: Uint8Array;
  moderatorSecretKey: Uint8Array;
  encSecretKey: Uint8Array;
  encPublicKey: Uint8Array;
};
export type MemberKeys = { secretKey: Uint8Array };

const file = (name: string) => path.join(keysDir(), name);

function writeSecret(name: string, value: Record<string, Uint8Array>, overwrite: boolean): string {
  const f = file(name);
  if (fs.existsSync(f) && !overwrite) throw new Error(`${f} already exists; pass --force to replace it (the old key is lost)`);
  fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 });
  const json = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toHex(v)]));
  fs.writeFileSync(f, `${JSON.stringify(json, null, 2)}\n`, { mode: 0o600 });
  return f;
}

function readSecret(name: string, hint: string): Record<string, Uint8Array> {
  const f = file(name);
  if (!fs.existsSync(f)) throw new Error(`No ${f}. Run \`npm run stele -- ${hint}\` first.`);
  const json = JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, string>;
  return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, fromHex(v)]));
}

export function createAskerKeys(overwrite = false): { keys: AskerKeys; file: string } {
  const enc = newEncryptionKeys();
  const keys: AskerKeys = {
    secretKey: newSecretKey(),
    moderatorSecretKey: newSecretKey(),
    encSecretKey: enc.secretKey,
    encPublicKey: enc.publicKey,
  };
  return { keys, file: writeSecret('asker.json', keys, overwrite) };
}

export const readAskerKeys = (): AskerKeys => readSecret('asker.json', 'asker keygen') as AskerKeys;

export function createMemberKeys(overwrite = false): { keys: MemberKeys; file: string } {
  const keys = { secretKey: newSecretKey() };
  return { keys, file: writeSecret('member.json', keys, overwrite) };
}

export const readMemberKeys = (): MemberKeys => readSecret('member.json', 'member keygen') as MemberKeys;
