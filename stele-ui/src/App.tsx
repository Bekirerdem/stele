// STELE - application root
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { MainLayout, Round } from './components';
import { useDeployedRoundContext } from './hooks';
import { type RoundDeployment } from './contexts';
import { type Observable } from 'rxjs';

/**
 * The root component.
 *
 * Requires a `<DeployedRoundProvider />` parent to retrieve the current round
 * deployments.
 */
const App: React.FC = () => {
  const roundApiProvider = useDeployedRoundContext();
  const [roundDeployments, setRoundDeployments] = useState<Array<Observable<RoundDeployment>>>([]);

  useEffect(() => {
    const subscription = roundApiProvider.roundDeployments$.subscribe(setRoundDeployments);
    return () => subscription.unsubscribe();
  }, [roundApiProvider]);

  return (
    <Box sx={{ background: '#000', minHeight: '100vh' }}>
      <MainLayout>
        {roundDeployments.map((roundDeployment, idx) => (
          <div data-testid={`round-${idx}`} key={`round-${idx}`}>
            <Round roundDeployment$={roundDeployment} />
          </div>
        ))}
        <div data-testid="round-start">
          <Round />
        </div>
      </MainLayout>
    </Box>
  );
};

export default App;
