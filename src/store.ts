// Where answer blobs live. The chain holds only each blob's SHA-256 digest;
// the blob is content-addressed by that digest, so whoever stores it can't
// swap it without the swap showing.
//
//   STELE_RELAY_URL set   -> the Stele relay (relay/), over HTTP
//   otherwise             -> a local directory, .stele/blobs/<network>/<address>/
//
// The relay serves blobs only after a question closes with at least its
// minimum number of answers; a local store is for a single-machine dry run.
//
// SPDX-License-Identifier: MIT

import fs from 'node:fs';
import path from 'node:path';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { digestOf } from './crypto.js';
import { steleDir } from './keys.js';

export interface BlobStore {
  readonly where: string;
  put(address: string, blob: Uint8Array): Promise<string>;
  get(address: string, digestHex: string): Promise<Uint8Array | undefined>;
}

const check = (blob: Uint8Array, digestHex: string): Uint8Array => {
  if (toHex(digestOf(blob)) !== digestHex) throw new Error(`Stored blob does not match its digest ${digestHex}`);
  return blob;
};

export function localStore(network: string): BlobStore {
  const dir = (address: string) => path.join(steleDir(), 'blobs', network, address);
  return {
    where: path.join(steleDir(), 'blobs', network),
    async put(address, blob) {
      const d = toHex(digestOf(blob));
      fs.mkdirSync(dir(address), { recursive: true });
      fs.writeFileSync(path.join(dir(address), `${d}.bin`), blob);
      return d;
    },
    async get(address, digestHex) {
      const f = path.join(dir(address), `${digestHex}.bin`);
      return fs.existsSync(f) ? check(new Uint8Array(fs.readFileSync(f)), digestHex) : undefined;
    },
  };
}

export function relayStore(base: string): BlobStore {
  const url = (address: string, d: string) => `${base.replace(/\/$/, '')}/q/${address}/blob/${d}`;
  return {
    where: base,
    async put(address, blob) {
      const d = toHex(digestOf(blob));
      const res = await fetch(url(address, d), {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: blob,
      });
      if (!res.ok) throw new Error(`Relay refused the answer: ${res.status} ${await res.text()}`);
      return d;
    },
    async get(address, digestHex) {
      const res = await fetch(url(address, digestHex));
      if (res.status === 404) return undefined;
      if (!res.ok) throw new Error(`Relay: ${res.status} ${await res.text()}`);
      return check(new Uint8Array(await res.arrayBuffer()), digestHex);
    },
  };
}

export const blobStore = (network: string): BlobStore => {
  const relay = process.env['STELE_RELAY_URL']?.trim();
  return relay ? relayStore(relay) : localStore(network);
};
