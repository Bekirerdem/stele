// The off-chain half of the contract: the two witnesses Compact asks for.
//
// One secret per participant. The asker's secret hashes to askerPk; a member's
// secret hashes to the member key the asker enrols, and the answer nullifier
// is derived from it. The secret never leaves this private state.
//
// SPDX-License-Identifier: MIT

import { type Ledger, type Witnesses } from './managed/stele/contract/index.js';
import { type WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/v9/compact-runtime';

export type StelePrivateState = {
  readonly secretKey: Uint8Array;
};

export const createStelePrivateState = (secretKey: Uint8Array): StelePrivateState => {
  if (secretKey.length !== 32) throw new Error('secretKey must be 32 bytes');
  return { secretKey };
};

export const witnesses: Witnesses<StelePrivateState> = {
  secretKey: ({ privateState }) => [privateState, privateState.secretKey],
  // Looked up in the member tree of the ledger state the circuit runs against,
  // so it always matches the root `answer` checks. The tree is frozen once
  // answering opens, so the path can't go stale before the answer lands.
  memberPath: ({ privateState, ledger }, pk) => {
    const path = ledger.members.findPathForLeaf(pk);
    if (path === undefined) throw new Error('This member key is not enrolled');
    return [privateState, path];
  },
};

export type { Ledger, Witnesses, WitnessContext };
