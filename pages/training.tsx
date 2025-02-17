import React, { useState } from 'react';
import axios from 'axios';
import styles from '../styles/Training.module.css';

interface TrainingStats {
  epoch: number;
  accuracy: number;
  loss: number;
  validationAccuracy?: number;
  validationLoss?: number;
}

const TrainingPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<TrainingStats | null>(null);

  const startTraining = async () => {
    setLoading(true);
    setMessage('');
    setStats(null);

    try {
      const response = await axios.post('http://localhost:5001/api/training/start', {
        symbol: 'BTCUSDT',
        interval: '1h'
      });

      setMessage('Training started successfully');
      
      // Start polling for status updates
      const statusInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get('http://localhost:5001/api/training/status');
          if (statusResponse.data.stats) {
            setStats(statusResponse.data.stats);
          }
        } catch (error) {
          console.error('Error fetching training status:', error);
        }
      }, 5000); // Poll every 5 seconds

      // Cleanup interval when component unmounts
      return () => clearInterval(statusInterval);
      
    } catch (error) {
      setMessage('Failed to start training');
      console.error('Error starting training:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1>ML Model Training</h1>
      
      <div className={styles.controlPanel}>
        <button 
          onClick={startTraining} 
          disabled={loading}
          className={styles.startButton}
        >
          {loading ? 'Starting...' : 'Start Training'}
        </button>
      </div>

      {message && (
        <div className={styles.messageBox}>
          {message}
        </div>
      )}

      {stats && (
        <div className={styles.statsBox}>
          <h2>Training Progress</h2>
          <div className={styles.stats}>
            <div>Epoch: {stats.epoch}</div>
            <div>Accuracy: {(stats.accuracy * 100).toFixed(2)}%</div>
            <div>Loss: {stats.loss.toFixed(4)}</div>
            {stats.validationAccuracy && (
              <div>Validation Accuracy: {(stats.validationAccuracy * 100).toFixed(2)}%</div>
            )}
            {stats.validationLoss && (
              <div>Validation Loss: {stats.validationLoss.toFixed(4)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingPage;
