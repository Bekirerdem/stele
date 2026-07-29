// STELE - report the wallet balance as soon as it is visible
// SPDX-License-Identifier: Apache-2.0

/*
 * The helper used before deployment waits for the wallet to be fully synced
 * with the chain before it reports anything. Preprod is ~1.9M blocks deep, and
 * that wait is what exhausts the heap.
 *
 * This asks a narrower question - has any balance appeared yet - and prints
 * every emission on the way, so a partially synced wallet still tells us
 * whether the funds are there.
 *
 * Run with:  npm run balance
 */

import { existsSync, readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { createLogger } from './logger-utils.js';
import { PreprodRemoteConfig } from './config.js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';

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
  await walletProvider.start();

  const token = unshieldedToken().raw;

  try {
    const found = await Rx.firstValueFrom(
      walletProvider.wallet.state().pipe(
        Rx.tap((state: { unshielded: { balances: Record<string, bigint> } }) => {
          const balance = state.unshielded.balances[token] ?? 0n;
          const kinds = Object.keys(state.unshielded.balances ?? {}).length;
          logger.info(`emission: unshielded balance=${balance.toString()} (${kinds} token kinds seen)`);
        }),
        // Deliberately does NOT require a fully synced wallet.
        Rx.filter(
          (state: { unshielded: { balances: Record<string, bigint> } }) =>
            (state.unshielded.balances[token] ?? 0n) > 0n,
        ),
        Rx.timeout(10 * 60 * 1000),
      ),
    );

    const balance = found.unshielded.balances[token];
    logger.info('==========================================');
    logger.info(`FUNDS FOUND: ${balance?.toString()} NIGHT`);
    logger.info('==========================================');
  } catch {
    logger.error('No balance became visible within the timeout.');
  } finally {
    await walletProvider.stop();
    await testEnv.shutdown();
  }
};

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
