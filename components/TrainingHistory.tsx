import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import axios from 'axios';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export const TrainingHistory = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/training-history');
      console.log('Raw training history data:', response.data);
      
      if (Array.isArray(response.data)) {
        const sortedHistory = response.data
          .filter(entry => entry && entry.metrics && entry.params)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setHistory(sortedHistory);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch training history:', err);
      setError('Failed to load training history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="text-white">Loading training history...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!history.length) return <div className="text-white">No training history available</div>;

  const chartData = {
    labels: history.map(h => new Date(h.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'PnL (USDT)',  // Move PnL to first position for emphasis
        data: history.map(h => {
          const pnl = Number(h.metrics?.pnl || 0);
          console.log(`PnL for entry ${h.id}:`, pnl); // Debug log
          return pnl.toFixed(2);
        }),
        borderColor: '#0abb87',
        tension: 0.1,
        yAxisID: 'pnl'  // Separate axis for PnL
      },
      {
        label: 'Accuracy (%)',
        data: history.map(h => Number((h.metrics?.accuracy || 0) * 100).toFixed(2)),
        borderColor: '#3699FF',
        tension: 0.1
      },
      {
        label: 'Win Rate (%)',
        data: history.map(h => Number((h.metrics?.winRate || 0) * 100).toFixed(2)),
        borderColor: '#ffb822',
        tension: 0.1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    scales: {
      pnl: {  // Dedicated PnL axis
        position: 'left',
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: { 
          color: 'white',
          callback: (value: number) => `$${value}`
        }
      },
      y: {
        position: 'right',
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: { color: 'white' }
      },
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: 'white' }
      }
    },
    plugins: {
      legend: {
        labels: { color: 'white' }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            if (context.dataset.label === 'PnL (USDT)') {
              return `PnL: $${context.raw}`;
            }
            return `${context.dataset.label}: ${context.raw}`;
          }
        }
      }
    }
  };

  return (
    <div className="bg-[#1B1B29] p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-white">Training Progress</h3>
          {history.length > 0 && (
            <p className="text-green-400 text-sm">
              Current PnL: ${(history[0].metrics?.pnl || 0).toFixed(2)} USDT
            </p>
          )}
        </div>
        <button 
          onClick={() => fetchHistory()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>
      
      <Line data={chartData} options={chartOptions} />
      
      <div className="mt-4 text-white">
        <h4 className="mb-2">Latest Results:</h4>
        {history.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 bg-green-900/20 p-2 rounded">
              <span className="font-bold">PnL: </span>
              <span className={history[0].metrics?.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                ${(history[0].metrics?.pnl || 0).toFixed(2)} USDT
              </span>
            </div>
            <div>Accuracy: {(history[0].metrics?.accuracy * 100 || 0).toFixed(2)}%</div>
            <div>Win Rate: {(history[0].metrics?.winRate * 100 || 0).toFixed(2)}%</div>
            <div>Sharpe Ratio: {(history[0].metrics?.sharpeRatio || 0).toFixed(2)}</div>
            <div>Time: {new Date(history[0].timestamp).toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
};
