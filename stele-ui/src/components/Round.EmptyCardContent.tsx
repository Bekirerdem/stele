// STELE - shown before a round is opened or joined
// SPDX-License-Identifier: Apache-2.0

import React, { useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { CardActions, CardContent, IconButton, Tooltip, Typography } from '@mui/material';
import RoundIcon from '@mui/icons-material/HistoryEduOutlined';
import OpenRoundIcon from '@mui/icons-material/AddCircleOutlined';
import JoinRoundIcon from '@mui/icons-material/AddLinkOutlined';
import { TextPromptDialog } from './TextPromptDialog';

export interface EmptyCardContentProps {
  /** Open a new round; the caller becomes its operator. */
  onCreateRound: () => void;
  /** Join a round that is already on the network. */
  onJoinRound: (contractAddress: ContractAddress) => void;
}

export const EmptyCardContent: React.FC<Readonly<EmptyCardContentProps>> = ({ onCreateRound, onJoinRound }) => {
  const [textPromptOpen, setTextPromptOpen] = useState(false);

  return (
    <React.Fragment>
      <CardContent>
        <Typography align="center" variant="h1" color="primary.dark">
          <RoundIcon fontSize="large" />
        </Typography>
        <Typography align="center" variant="body2" color="primary.dark">
          Open a round, or join one that already exists.
        </Typography>
        <Typography align="center" variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          Opening a round engraves its question, its audience, its closing time and its promise. None of them can be
          changed afterwards.
        </Typography>
      </CardContent>
      <CardActions disableSpacing sx={{ justifyContent: 'center' }}>
        <Tooltip title="Open a new round">
          <IconButton data-testid="round-deploy-btn" onClick={onCreateRound}>
            <OpenRoundIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Join an existing round">
          <IconButton data-testid="round-join-btn" onClick={() => setTextPromptOpen(true)}>
            <JoinRoundIcon />
          </IconButton>
        </Tooltip>
      </CardActions>
      <TextPromptDialog
        prompt="Enter the round address"
        isOpen={textPromptOpen}
        onCancel={() => setTextPromptOpen(false)}
        onSubmit={(text) => {
          setTextPromptOpen(false);
          onJoinRound(text);
        }}
      />
    </React.Fragment>
  );
};
