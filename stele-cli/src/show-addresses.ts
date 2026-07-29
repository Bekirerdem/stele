// STELE - print every address this wallet exposes
// SPDX-License-Identifier: Apache-2.0

/*
 * The faucet asks for one specific kind of address, and a Midnight wallet has
 * more than one. This prints all of them so the right one can be used instead
 * of guessed.
 *
 * Run with:  npm run addresses
 */

import { existsSync, readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { createLogger } from './logger-utils.js';
import { PreprodRemoteConfig } from './config.js';
import { MidnightWalletProvider } from './midnight-wallet-provider';

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

const main = async (): Promise<void> => {
  const config = new PreprodRemoteConfig();
  const logger = await createLogger(config.logDir);

  const seedFile = new URL('../../.stele-seed', import.meta.url).pathname;
  if (!existsSync(seedFile)) {
    throw new Error(`No wallet seed at ${seedFile}`);
  }
  const seed = readFileSync(seedFile, 'utf8').trim();

  const testEnv = config.getEnvironment(logger);
  const envConfiguration = await testEnv.start();
  const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);

  try {
    const wallet = walletProvider.wallet as unknown as Record<string, unknown>;
    const state = (await (wallet.state as () => Promise<unknown>)?.()) ?? null;

    console.log('\n================= WALLET ADDRESSES =================');
    console.log(JSON.stringify(state, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
    console.log('===================================================\n');
  } finally {
    await walletProvider.stop();
    await testEnv.shutdown();
  }
};

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
