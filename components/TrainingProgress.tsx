import { Box, Card, CircularProgress, Typography, LinearProgress } from '@mui/material';
import { useEffect, useState } from 'react';

interface TrainingProgressProps {
  currentEpoch: number;
  totalEpochs: number;
  loss?: number;
  accuracy?: number;
}

export const TrainingProgress = ({ 
  currentEpoch, 
  totalEpochs, 
  loss, 
  accuracy 
}: TrainingProgressProps) => {
  const progress = (currentEpoch / totalEpochs) * 100;

  return (
    <Card sx={{ p: 3, mb: 2, bgcolor: 'background.paper' }}>
      <Box display="flex" alignItems="center" mb={2}>
        <CircularProgress variant="determinate" value={progress} size={60} />
        <Box ml={2}>
          <Typography variant="h6" color="primary">
            Training in Progress
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Epoch {currentEpoch} of {totalEpochs}
          </Typography>
        </Box>
      </Box>

      <Box mb={2}>
        <Typography variant="body2" color="text.secondary" mb={1}>
          Overall Progress
        </Typography>
        <LinearProgress variant="determinate" value={progress} />
      </Box>

      <Box display="flex" justifyContent="space-between">
        {loss !== undefined && (
          <Typography variant="body2" color="text.secondary">
            Loss: {loss.toFixed(4)}
          </Typography>
        )}
        {accuracy !== undefined && (
          <Typography variant="body2" color="text.secondary">
            Accuracy: {(accuracy * 100).toFixed(1)}%
          </Typography>
        )}
      </Box>
    </Card>
  );
};
