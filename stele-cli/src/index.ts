// STELE - operator and participant CLI
// SPDX-License-Identifier: Apache-2.0

/*
 * Entry point is the run function at the end of the file. The launcher files
 * (preprod.ts, preview.ts, standalone.ts) call it with the network addresses
 * this file relies on.
 */

import { createHash } from 'node:crypto';
import { createInterface, type Interface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { WebSocket } from 'ws';
import {
  SteleAPI,
  type SteleDerivedState,
  stelePrivateStateKey,
  type SteleProviders,
  type SteleCircuitKeys,
  type DeployedSteleContract,
  type PrivateStateId,
  type RoundParams,
} from '../../api/src/index';
import { type WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ledger, type Ledger, Phase, pureCircuits } from '../../contract/src/managed/stele/contract/index.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { type Logger } from 'pino';
import { type Config, StandaloneConfig } from './config.js';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { assertIsContractAddress, toHex } from '@midnight-ntwrk/midnight-js-utils';
import { TestEnvironment } from '@midnight-ntwrk/testkit-js';
import { MidnightWalletProvider } from './midnight-wallet-provider';
import { randomBytes } from '../../api/src/utils';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils';
import { generateDust } from './generate-dust';
import { type StelePrivateState } from '../../contract/src/witnesses.js';

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

const phaseName = (phase: Phase): string =>
  phase === Phase.REGISTRATION ? 'registration' : phase === Phase.VOTING ? 'voting' : 'closed';

/**
 * Canonical hash of a round's text.
 *
 * The ledger stores only this digest. Publishing the text alongside it lets
 * anyone check that the question was not reworded after the fact.
 */
const textHash = (text: string): Uint8Array => new Uint8Array(createHash('sha256').update(text, 'utf8').digest());

export const getSteleLedgerState = async (
  providers: SteleProviders,
  contractAddress: ContractAddress,
): Promise<Ledger | null> => {
  assertIsContractAddress(contractAddress);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  return contractState != null ? ledger(contractState.data) : null;
};

/* **********************************************************************
 * openOrJoin: open a new round as its operator, or join one that already
 * exists as a participant.
 */

const OPEN_OR_JOIN_QUESTION = `
You can do one of the following:
  1. Open a new round (you become its operator)
  2. Join an existing round
  3. Exit
Which would you like to do? `;

const askRoundParams = async (rli: Interface, operatorId: Uint8Array): Promise<RoundParams> => {
  const question = await rli.question('Question text: ');
  const optionCount = BigInt(await rli.question('How many answer options? '));
  const promise = await rli.question('What do you promise if the result falls short? ');
  const threshold = BigInt(await rli.question('Below which option number counts as falling short? '));
  const minParticipants = BigInt(await rli.question('Minimum participants before the round can close? '));
  const round = BigInt(await rli.question('Round number in the registry? '));

  return {
    round,
    questionHash: textHash(question),
    optionCount,
    promiseHash: textHash(promise),
    promiseThreshold: threshold,
    minParticipants,
    operatorId,
  };
};

const openOrJoin = async (providers: SteleProviders, rli: Interface, logger: Logger): Promise<SteleAPI | null> => {
  while (true) {
    const choice = await rli.question(OPEN_OR_JOIN_QUESTION);
    switch (choice) {
      case '1': {
        // The operator identity is derived from a secret generated here. The
        // same secret is stored as this device's private state, so only this
        // device can move the round's phase.
        const operatorSecret = randomBytes(32);
        const operatorId = pureCircuits.operatorIdOf(operatorSecret);
        const params = await askRoundParams(rli, operatorId);

        const api = await SteleAPI.deploy(providers, params, operatorSecret, logger);
        logger.info(`Round opened at address: ${api.deployedContractAddress}`);
        logger.info(`Question hash: ${toHex(params.questionHash)}`);
        logger.info(`Promise hash:  ${toHex(params.promiseHash)}`);
        return api;
      }
      case '2': {
        const address = await rli.question('What is the round address (in hex)? ');
        const api = await SteleAPI.join(providers, address, logger);
        logger.info(`Joined round at address: ${api.deployedContractAddress}`);
        return api;
      }
      case '3':
        logger.info('Exiting...');
        return null;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

/* **********************************************************************
 * Display helpers.
 */

const displayLedgerState = async (
  providers: SteleProviders,
  deployedContract: DeployedSteleContract,
  logger: Logger,
): Promise<void> => {
  const contractAddress = deployedContract.deployTxData.public.contractAddress;
  const state = await getSteleLedgerState(providers, contractAddress);

  if (state === null) {
    logger.info(`There is no round deployed at ${contractAddress}`);
    return;
  }

  logger.info(`Round number:     ${state.roundNumber}`);
  logger.info(`Phase:            ${phaseName(state.phase)}`);
  logger.info(`Question hash:    ${toHex(state.questionHash)}`);
  logger.info(`Options:          ${state.optionCount}`);
  logger.info(`Promise hash:     ${toHex(state.promiseHash)}`);
  logger.info(`Promise threshold:${state.promiseThreshold}`);
  logger.info(`Anonymity floor:  ${state.minParticipants}`);
  logger.info(`Registered:       ${state.eligibleCount}`);
  logger.info(`Answered:         ${state.participantCount}`);

  for (let option = 0n; option < state.optionCount; option++) {
    const votes = state.tally.member(option) ? state.tally.lookup(option).read() : 0n;
    logger.info(`  option ${option}: ${votes}`);
  }
};

const displayPrivateState = async (providers: SteleProviders, logger: Logger): Promise<void> => {
  const privateState = await providers.privateStateProvider.get(stelePrivateStateKey);

  if (privateState === null) {
    logger.info('There is no private state on this device yet');
  } else {
    // The secret itself is what makes this device's participation unlinkable.
    // It is printed here only so a participant can back it up; it must never
    // be handed to the operator.
    logger.info(`Your eligibility secret: ${toHex(privateState.secretKey)}`);
    logger.info(`Your commitment:         ${toHex(pureCircuits.commitmentOf(privateState.secretKey))}`);
  }
};

const displayDerivedState = (state: SteleDerivedState | undefined, logger: Logger): void => {
  if (state === undefined) {
    logger.info('No round state currently available');
    return;
  }

  logger.info(`Phase:        ${phaseName(state.phase)}`);
  logger.info(`Registered:   ${state.eligibleCount}`);
  logger.info(`Answered:     ${state.participantCount}`);
  logger.info(`You are registered:   ${state.isRegistered ? 'yes' : 'no'}`);
  logger.info(`You have answered:    ${state.hasParticipated ? 'yes' : 'no'}`);
  logger.info(`You are the operator: ${state.isOperator ? 'yes' : 'no'}`);
  state.tally.forEach((votes, option) => logger.info(`  option ${option}: ${votes}`));
};

/* **********************************************************************
 * mainLoop
 */

const MAIN_LOOP_QUESTION = `
You can do one of the following:
  1. Register (add your commitment to the eligibility tree)
  2. Open voting (operator only - freezes the eligibility root)
  3. Answer the question
  4. Close the round (operator only)
  5. Display the ledger state (known by everyone)
  6. Display your private state (known only to this device)
  7. Display the derived state (ledger plus what this device can tell)
  8. Exit
Which would you like to do? `;

const mainLoop = async (providers: SteleProviders, rli: Interface, logger: Logger): Promise<void> => {
  const api = await openOrJoin(providers, rli, logger);
  if (api === null) {
    return;
  }

  let currentState: SteleDerivedState | undefined;
  const subscription = api.state$.subscribe({
    next: (state: SteleDerivedState) => (currentState = state),
  });

  try {
    while (true) {
      const choice = await rli.question(MAIN_LOOP_QUESTION);
      try {
        switch (choice) {
          case '1':
            await api.register();
            logger.info('Commitment added to the eligibility tree');
            break;
          case '2':
            await api.openVoting();
            logger.info('Voting is open; the eligibility root is now frozen');
            break;
          case '3': {
            const answer = await rli.question('Which option do you choose? ');
            await api.participate(BigInt(answer));
            logger.info('Answer recorded');
            break;
          }
          case '4':
            await api.closeRound();
            logger.info('Round closed');
            break;
          case '5':
            await displayLedgerState(providers, api.deployedContract, logger);
            break;
          case '6':
            await displayPrivateState(providers, logger);
            break;
          case '7':
            displayDerivedState(currentState, logger);
            break;
          case '8':
            logger.info('Exiting...');
            return;
          default:
            logger.error(`Invalid choice: ${choice}`);
        }
      } catch (e) {
        logError(logger, e);
      }
    }
  } finally {
    subscription.unsubscribe();
  }
};

/* ***********************************************************************
 * This seed gives access to tokens minted in the genesis block of a local
 * development node - only used in standalone networks.
 */
const GENESIS_MINT_WALLET_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

const WALLET_LOOP_QUESTION = `
You can do one of the following:
  1. Build a fresh wallet
  2. Build wallet from a seed
  3. Exit
Which would you like to do? `;

const buildWallet = async (config: Config, rli: Interface, logger: Logger): Promise<string | undefined> => {
  if (config instanceof StandaloneConfig) {
    return GENESIS_MINT_WALLET_SEED;
  }
  while (true) {
    const choice = await rli.question(WALLET_LOOP_QUESTION);
    switch (choice) {
      case '1':
        return toHex(randomBytes(32));
      case '2':
        return await rli.question('Enter your wallet seed: ');
      case '3':
        logger.info('Exiting...');
        return undefined;
      default:
        logger.error(`Invalid choice: ${choice}`);
    }
  }
};

/**
 * Assemble the providers a round needs.
 *
 * The proof server runs locally, so the witness - the eligibility secret and
 * the answer - never leaves this machine.
 */
export const buildProviders = (
  config: Config,
  envConfiguration: { indexer: string; indexerWS: string; proofServer: string },
  walletProvider: MidnightWalletProvider,
  seed: string,
): SteleProviders => {
  const zkConfigProvider = new NodeZkConfigProvider<SteleCircuitKeys>(config.zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider<PrivateStateId, StelePrivateState>({
      privateStateStoreName: config.privateStateStoreName,
      signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
      privateStoragePasswordProvider: () => 'Stele-Test-2026!',
      accountId: seed,
    }),
    publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
};

export const run = async (config: Config, testEnv: TestEnvironment, logger: Logger): Promise<void> => {
  const rli = createInterface({ input, output, terminal: true });
  const providersToBeStopped: MidnightWalletProvider[] = [];
  try {
    const envConfiguration = await testEnv.start();
    logger.info(`Environment started with configuration: ${JSON.stringify(envConfiguration)}`);
    const seed = await buildWallet(config, rli, logger);
    if (seed === undefined) {
      return;
    }
    const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
    providersToBeStopped.push(walletProvider);
    const walletFacade: WalletFacade = walletProvider.wallet;

    await walletProvider.start();

    const unshieldedState = await waitForUnshieldedFunds(logger, walletFacade, envConfiguration, unshieldedToken());
    const nightBalance = unshieldedState.balances[unshieldedToken().raw];
    if (nightBalance === undefined) {
      logger.info('No funds received, exiting...');
      return;
    }
    logger.info(`Your NIGHT wallet balance is: ${nightBalance}`);

    if (config.generateDust) {
      const dustGeneration = await generateDust(logger, seed, unshieldedState, walletFacade);
      if (dustGeneration) {
        logger.info(`Submitted dust generation registration transaction: ${dustGeneration}`);
        await syncWallet(logger, walletFacade);
      }
    }

    const providers = buildProviders(config, envConfiguration, walletProvider, seed);
    await mainLoop(providers, rli, logger);
  } catch (e) {
    logError(logger, e);
    logger.info('Exiting...');
  } finally {
    try {
      rli.close();
      rli.removeAllListeners();
    } catch (e) {
      logError(logger, e);
    } finally {
      try {
        for (const wallet of providersToBeStopped) {
          logger.info('Stopping wallet...');
          await wallet.stop();
        }
        if (testEnv) {
          logger.info('Stopping test environment...');
          await testEnv.shutdown();
        }
      } catch (e) {
        logError(logger, e);
      }
    }
  }
};

function logError(logger: Logger, e: unknown) {
  if (e instanceof Error) {
    logger.error(`Found error '${e.message}'`);
    logger.debug(`${e.stack}`);
  } else {
    logger.error(`Found error (unknown type)`);
  }
}
