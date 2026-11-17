// STELE - application header
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { AppBar, Box, Typography } from '@mui/material';

export const Header: React.FC = () => (
  <AppBar
    position="static"
    data-testid="header"
    sx={{
      backgroundColor: '#000',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,0.12)',
      boxShadow: 'none',
    }}
  >
    <Box sx={{ display: 'flex', flexDirection: 'column', px: 6, py: 2 }} data-testid="header-logo">
      <Typography variant="h5" sx={{ letterSpacing: '0.18em', fontWeight: 300 }}>
        STELE
      </Typography>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: 620 }}>
        A public record of accountability. Respondents stay invisible; the count and the promise are verifiable.
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', px: 6, alignItems: 'center' }}>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
        on Midnight
      </Typography>
    </Box>
  </AppBar>
);
