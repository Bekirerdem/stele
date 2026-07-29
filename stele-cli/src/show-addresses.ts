// STELE - print the addresses this wallet exposes
// SPDX-License-Identifier: Apache-2.0

/*
 * A Midnight wallet has more than one address, and only one of them is what a
 * faucet or a sender wants. Guessing which is a good way to lose an afternoon,
 * so this prints them side by side.
 *
 * Run with:  npm run addresses
 */

import { existsSync, readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { createLogger } from './logger-utils.js';
import { PreprodRemoteConfig } from './config.js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { UnshieldedAddress, ShieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

type WalletShape = {
  unshielded?: { address?: unknown };
  shielded?: { address?: unknown };
};

const main = async (): Promise<void> => {
  const config = new PreprodRemoteConfig();
  const logger = await createLogger(config.logDir);

  const seedFile = new URL('../../.stele-seed', import.meta.url).pathname;
  if (!existsSync(seedFile)) {
    throw new Error(`No wallet seed at ${seedFile}`);
  }
  const seed = readFileSync(seedFile, 'utf8').trim();

  const testEnv = config.getEnvironment(logger);
  const env = await testEnv.start();
  const walletProvider = await MidnightWalletProvider.build(logger, env, seed);

  try {
    // The first emission arrives without waiting for a full sync.
    const state = await Rx.firstValueFrom(walletProvider.wallet.state() as unknown as Rx.Observable<WalletShape>);

    console.log('\n=============== WALLET ADDRESSES ===============');
    console.log(`network     ${getNetworkId()}`);

    if (state.unshielded?.address) {
      const unshielded = UnshieldedAddress.codec.encode(getNetworkId(), state.unshielded.address as never);
      console.log(`unshielded  ${unshielded.toString()}`);
      console.log('            <- this is what the faucet expects');
    }

    if (state.shielded?.address) {
      const shielded = ShieldedAddress.codec.encode(getNetworkId(), state.shielded.address as never);
      console.log(`shielded    ${shielded.toString()}`);
    }

    console.log('================================================\n');
  } finally {
    await walletProvider.stop();
    await testEnv.shutdown();
  }
};

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
