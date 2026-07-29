// STELE - the round screen
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Backdrop,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import { type SteleDerivedState, type DeployedSteleAPI } from '../../../api/src/index';
import { useDeployedRoundContext } from '../hooks';
import { type RoundDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { Phase } from '../../../contract/src/index';
import { EmptyCardContent } from './Round.EmptyCardContent';

export interface RoundProps {
  roundDeployment$?: Observable<RoundDeployment>;
}

const phaseLabel = (phase: Phase): string =>
  phase === Phase.REGISTRATION ? 'Registration' : phase === Phase.VOTING ? 'Voting' : 'Closed';

const shortHex = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}…${hex.slice(-8)}`;
};

/**
 * The UI for one round.
 *
 * Without a `roundDeployment$` it offers to open or join a round. Once it has
 * one, it subscribes to the derived state and renders both sides of the
 * contract: what the chain knows about the round, and what only this device
 * can tell about its own position in it.
 */
export const Round: React.FC<Readonly<RoundProps>> = ({ roundDeployment$ }) => {
  const roundApiProvider = useDeployedRoundContext();
  const [roundDeployment, setRoundDeployment] = useState<RoundDeployment>();
  const [deployedRoundAPI, setDeployedRoundAPI] = useState<DeployedSteleAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [roundState, setRoundState] = useState<SteleDerivedState>();
  const [isWorking, setIsWorking] = useState(!!roundDeployment$);

  const onOpenRound = useCallback(() => roundApiProvider.resolve(), [roundApiProvider]);
  const onJoinRound = useCallback(
    (contractAddress: ContractAddress) => roundApiProvider.resolve(contractAddress),
    [roundApiProvider],
  );

  const guard = useCallback(async (action: () => Promise<void>) => {
    try {
      setIsWorking(true);
      await action();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, []);

  const onRegister = useCallback(
    () => guard(async () => deployedRoundAPI && (await deployedRoundAPI.register())),
    [guard, deployedRoundAPI],
  );

  const onOpenVoting = useCallback(
    () => guard(async () => deployedRoundAPI && (await deployedRoundAPI.openVoting())),
    [guard, deployedRoundAPI],
  );

  const onAnswer = useCallback(
    (choice: bigint) => guard(async () => deployedRoundAPI && (await deployedRoundAPI.participate(choice))),
    [guard, deployedRoundAPI],
  );

  const onClose = useCallback(
    () => guard(async () => deployedRoundAPI && (await deployedRoundAPI.closeRound())),
    [guard, deployedRoundAPI],
  );

  useEffect(() => {
    if (!roundDeployment$) {
      return;
    }
    const subscription = roundDeployment$.subscribe(setRoundDeployment);
    return () => subscription.unsubscribe();
  }, [roundDeployment$]);

  useEffect(() => {
    if (!roundDeployment) {
      return;
    }
    if (roundDeployment.status === 'in-progress') {
      return;
    }

    setIsWorking(false);

    if (roundDeployment.status === 'failed') {
      setErrorMessage(roundDeployment.error.message);
      return;
    }

    setDeployedRoundAPI(roundDeployment.api);
    const subscription = roundDeployment.api.state$.subscribe({
      next: setRoundState,
      error: (error: unknown) => setErrorMessage(error instanceof Error ? error.message : String(error)),
    });
    return () => subscription.unsubscribe();
  }, [roundDeployment]);

  const totalVotes = roundState?.tally.reduce((sum, votes) => sum + votes, 0n) ?? 0n;

  return (
    <Card sx={{ position: 'relative', width: 460, minHeight: 380 }}>
      {!roundDeployment$ && <EmptyCardContent onCreateRound={onOpenRound} onJoinRound={onJoinRound} />}

      {roundDeployment$ && (
        <>
          <CardHeader
            title={roundState ? `Round ${roundState.roundNumber}` : <Skeleton width="60%" />}
            subheader={
              roundState ? <Chip size="small" label={phaseLabel(roundState.phase)} /> : <Skeleton width="30%" />
            }
            action={
              deployedRoundAPI && (
                <IconButton
                  title="Copy the round address"
                  onClick={() => void navigator.clipboard.writeText(deployedRoundAPI.deployedContractAddress)}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              )
            }
          />

          <CardContent>
            {!roundState && <Skeleton variant="rectangular" height={220} />}

            {roundState && (
              <Stack spacing={2}>
                {/* What the chain knows. Everything here is public by design. */}
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    On the chain
                  </Typography>
                  <Typography variant="body2">Question {shortHex(roundState.questionHash)}</Typography>
                  <Typography variant="body2">Promise {shortHex(roundState.promiseHash)}</Typography>
                  <Typography variant="body2">
                    {roundState.eligibleCount.toString()} registered · {roundState.participantCount.toString()} answered
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Closes at {roundState.minParticipants.toString()} answers or more
                  </Typography>
                </Box>

                <Box>
                  {roundState.tally.map((votes, option) => (
                    <Box key={option} sx={{ mb: 0.5 }}>
                      <Typography variant="caption">
                        Option {option} — {votes.toString()}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={totalVotes > 0n ? Number((votes * 100n) / totalVotes) : 0}
                      />
                    </Box>
                  ))}
                </Box>

                <Divider />

                {/* What only this device can tell. Derived from a secret that
                    never leaves it - the same questions cannot be asked about
                    anyone else. */}
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    On this device only
                  </Typography>
                  <Typography variant="body2">
                    {roundState.isRegistered ? 'Your commitment is in the tree' : 'You are not registered'}
                  </Typography>
                  <Typography variant="body2">
                    {roundState.hasParticipated ? 'You have answered' : 'You have not answered yet'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Your secret never leaves this device. The chain sees a tag derived from it, and nothing that ties
                    the tag back to you.
                  </Typography>
                </Box>
              </Stack>
            )}
          </CardContent>

          <CardActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
            {roundState?.phase === Phase.REGISTRATION && (
              <>
                <Button size="small" variant="outlined" onClick={onRegister} disabled={roundState.isRegistered}>
                  {roundState.isRegistered ? 'Registered' : 'Register'}
                </Button>
                {roundState.isOperator && (
                  <Button size="small" onClick={onOpenVoting}>
                    Open voting
                  </Button>
                )}
              </>
            )}

            {roundState?.phase === Phase.VOTING &&
              !roundState.hasParticipated &&
              roundState.tally.map((_, option) => (
                <Button key={option} size="small" variant="outlined" onClick={() => onAnswer(BigInt(option))}>
                  Option {option}
                </Button>
              ))}

            {roundState?.phase === Phase.VOTING && roundState.isOperator && (
              <Button size="small" onClick={onClose}>
                Close round
              </Button>
            )}
          </CardActions>
        </>
      )}

      {errorMessage && (
        <Box sx={{ px: 2, pb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <StopIcon color="error" fontSize="small" />
          <Typography variant="caption" color="error">
            {errorMessage}
          </Typography>
        </Box>
      )}

      <Backdrop sx={{ position: 'absolute', zIndex: 1 }} open={isWorking}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <CircularProgress color="inherit" size={28} />
          <Typography variant="caption">Proving on this device…</Typography>
        </Box>
      </Backdrop>
    </Card>
  );
};
