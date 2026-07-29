// STELE - non-interactive round deployment
// SPDX-License-Identifier: Apache-2.0

/*
 * Opens a round without prompting, so a deployment can be repeated exactly.
 * Reads its input from the environment:
 *
 *   STELE_WALLET_SEED   64 hex chars. Printed on first run if absent.
 *   STELE_QUESTION      the question text
 *   STELE_OPTIONS       how many answer options            (default 3)
 *   STELE_PROMISE       what the operator promises
 *   STELE_THRESHOLD     the option number counted as falling short (default 1)
 *   STELE_MIN           anonymity floor                    (default 3)
 *   STELE_ROUND         position in the registry           (default 1)
 *
 * Run with:  npm run deploy:preprod
 */

import { existsSync, readFileSync } from 'node:fs';
import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { SteleAPI, type RoundParams } from '../../api/src/index';
import { pureCircuits } from '../../contract/src/managed/stele/contract/index.js';
import { createLogger } from './logger-utils.js';
import { PreprodRemoteConfig } from './config.js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { buildProviders } from './index.js';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils';
import { generateDust } from './generate-dust';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

const textHash = (text: string): Uint8Array => new Uint8Array(createHash('sha256').update(text, 'utf8').digest());

const env = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing ${name}`);
  }
  return value;
};

const main = async (): Promise<void> => {
  const config = new PreprodRemoteConfig();
  const logger = await createLogger(config.logDir);

  // Reuse a funded wallet across runs: the Preprod faucet is rate limited and
  // gated by a captcha, so regenerating a seed means asking for funds again.
  const seedFile = new URL('../../.stele-seed', import.meta.url).pathname;
  const seed =
    process.env.STELE_WALLET_SEED ??
    (existsSync(seedFile) ? readFileSync(seedFile, 'utf8').trim() : toHex(new Uint8Array(nodeRandomBytes(32))));

  if (!process.env.STELE_WALLET_SEED && !existsSync(seedFile)) {
    logger.info('No wallet seed found; generated one:');
    logger.info(seed);
    logger.info(`Save it to ${seedFile} - the operator identity is tied to this wallet.`);
  }

  const testEnv = config.getEnvironment(logger);
  const envConfiguration = await testEnv.start();
  logger.info(`Environment: ${JSON.stringify(envConfiguration)}`);

  const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
  await walletProvider.start();
  const walletFacade: WalletFacade = walletProvider.wallet;

  try {
    logger.info('Waiting for NIGHT. Fund this wallet from the Preprod faucet if it has no balance.');
    const unshieldedState = await waitForUnshieldedFunds(logger, walletFacade, envConfiguration, unshieldedToken());
    const nightBalance = unshieldedState.balances[unshieldedToken().raw];

    if (nightBalance === undefined) {
      logger.error('No NIGHT received; cannot pay for the deployment.');
      return;
    }
    logger.info(`NIGHT balance: ${nightBalance}`);

    const dustGeneration = await generateDust(logger, seed, unshieldedState, walletFacade);
    if (dustGeneration) {
      logger.info(`Dust generation registered: ${dustGeneration}`);
      await syncWallet(logger, walletFacade);
    }

    // The operator identity is derived from a secret held on this machine, so
    // only this machine can move the round's phase.
    const operatorSecret = new Uint8Array(nodeRandomBytes(32));
    const question = env('STELE_QUESTION', 'How well is this programme run?');
    const promise = env('STELE_PROMISE', 'Publish the result and address the lowest-scoring area.');

    const params: RoundParams = {
      round: BigInt(env('STELE_ROUND', '1')),
      questionHash: textHash(question),
      optionCount: BigInt(env('STELE_OPTIONS', '3')),
      promiseHash: textHash(promise),
      promiseThreshold: BigInt(env('STELE_THRESHOLD', '1')),
      minParticipants: BigInt(env('STELE_MIN', '3')),
      operatorId: pureCircuits.operatorIdOf(operatorSecret),
    };

    const providers = buildProviders(config, envConfiguration, walletProvider, seed);
    const api = await SteleAPI.deploy(providers, params, operatorSecret, logger);

    logger.info('----------------------------------------------------------');
    logger.info(`Round deployed at: ${api.deployedContractAddress}`);
    logger.info(`Round number:      ${params.round}`);
    logger.info(`Question:          ${question}`);
    logger.info(`Question hash:     ${toHex(params.questionHash)}`);
    logger.info(`Promise:           ${promise}`);
    logger.info(`Promise hash:      ${toHex(params.promiseHash)}`);
    logger.info(`Options:           ${params.optionCount}`);
    logger.info(`Anonymity floor:   ${params.minParticipants}`);
    logger.info(`Operator secret:   ${toHex(operatorSecret)}`);
    logger.info('----------------------------------------------------------');
  } finally {
    await walletProvider.stop();
    await testEnv.shutdown();
  }
};

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
