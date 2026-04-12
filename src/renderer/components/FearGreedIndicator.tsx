import React, { useState, useEffect } from 'react';

interface FearGreedData {
  value: number;
  label: string;
  timestamp: string;
}

function getColor(value: number): string {
  if (value <= 20) return '#dc3545'; // extreme fear - red
  if (value <= 35) return '#fd7e14'; // fear - orange
  if (value <= 65) return '#ffc107'; // neutral - yellow
  if (value <= 75) return '#28a745'; // greed - green
  return '#6f42c1'; // extreme greed - purple
}

function getSignal(value: number): string {
  if (value <= 20) return 'DCA BUY ZONE';
  if (value <= 35) return 'BUY (with sentiment)';
  if (value <= 65) return 'HOLD';
  if (value <= 75) return 'PAUSE BUYING';
  return 'TRIM POSITIONS';
}

export function FearGreedIndicator(): React.ReactElement {
  const [data, setData] = useState<FearGreedData | null>(null);

  useEffect(() => {
    fetch('/api/crypto/fear-greed')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null));

    const interval = setInterval(() => {
      fetch('/api/crypto/fear-greed')
        .then(r => r.json())
        .then(setData)
        .catch(() => {});
    }, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (!data) return <></>;

  const color = getColor(data.value);
  const signal = getSignal(data.value);

  return (
    <div className="dashboard-panel" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>Crypto Fear & Greed</h2>
          <span style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color,
          }}>
            {data.value}
          </span>
          <span style={{ color, fontWeight: 500 }}>
            {data.label}
          </span>
        </div>
        <span style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '4px',
          backgroundColor: color + '22',
          color,
          fontWeight: 600,
          fontSize: '0.85rem',
        }}>
          {signal}
        </span>
      </div>
      {/* Simple bar visualization */}
      <div style={{
        marginTop: '0.5rem',
        height: '6px',
        borderRadius: '3px',
        backgroundColor: '#333',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${data.value}%`,
          backgroundColor: color,
          borderRadius: '3px',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}
