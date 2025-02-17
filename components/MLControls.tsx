import { useState } from 'react';
import { TrainingMetrics } from '@/types';

export default function MLControls() {
  const [modelType, setModelType] = useState('LSTM');
  const [epochs, setEpochs] = useState(100);
  const [batchSize, setBatchSize] = useState(32);
  const [trainingStatus, setTrainingStatus] = useState('idle');
  const [metrics, setMetrics] = useState<any>(null);
  const [features, setFeatures] = useState<string[]>(['close', 'volume', 'rsi', 'macd']);
  const [windowSize, setWindowSize] = useState(60);
  const [trainingHistory, setTrainingHistory] = useState<any>(null);

  const handleTrainModel = async () => {
    setTrainingStatus('training');
    try {
      const response = await fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelType,
          config: {
            epochs,
            batchSize,
            windowSize,
            features
          }
        })
      });
      const data = await response.json();
      setMetrics(data.metrics);
      setTrainingHistory(data.history);
    } catch (error) {
      console.error('Training failed:', error);
    } finally {
      setTrainingStatus('idle');
    }
  };

  return (
    <div className="bg-[#151522] p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Machine Learning Controls</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block mb-2">Model Type</label>
          <select
            value={modelType}
            onChange={(e) => setModelType(e.target.value)}
            className="w-full bg-[#1E1E2D] p-2 rounded"
          >
            <option value="LSTM">LSTM</option>
            <option value="GRU">GRU</option>
            <option value="CNN">CNN</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-2">Epochs</label>
            <input
              type="number"
              value={epochs}
              onChange={(e) => setEpochs(parseInt(e.target.value))}
              className="w-full bg-[#1E1E2D] p-2 rounded"
            />
          </div>
          <div>
            <label className="block mb-2">Batch Size</label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              className="w-full bg-[#1E1E2D] p-2 rounded"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block mb-2">Window Size</label>
          <input
            type="number"
            value={windowSize}
            onChange={(e) => setWindowSize(parseInt(e.target.value))}
            className="w-full bg-[#1E1E2D] p-2 rounded"
            min="1"
            max="200"
          />
        </div>

        <div className="mt-4">
          <label className="block mb-2">Features</label>
          <div className="grid grid-cols-2 gap-2">
            {['close', 'volume', 'rsi', 'macd', 'ema', 'bb'].map(feature => (
              <label key={feature} className="flex items-center">
                <input
                  type="checkbox"
                  checked={features.includes(feature)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFeatures([...features, feature]);
                    } else {
                      setFeatures(features.filter(f => f !== feature));
                    }
                  }}
                  className="mr-2"
                />
                {feature.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleTrainModel}
          disabled={trainingStatus === 'training'}
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded disabled:opacity-50"
        >
          {trainingStatus === 'training' ? 'Training...' : 'Train Model'}
        </button>

        {metrics && (
          <div className="mt-6">
            <h3 className="text-xl mb-4">Training Results</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1E1E2D] p-4 rounded">
                <div className="text-gray-400">Accuracy</div>
                <div className="text-2xl">{(metrics.accuracy * 100).toFixed(2)}%</div>
              </div>
              <div className="bg-[#1E1E2D] p-4 rounded">
                <div className="text-gray-400">Loss</div>
                <div className="text-2xl">{metrics.loss.toFixed(4)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
