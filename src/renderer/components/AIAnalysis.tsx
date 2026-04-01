import React, { useState, useEffect } from 'react';
import { api } from '../api';
import type { AnalysisResult } from '../types';

interface Props {
  symbol: string | null;
}

function badgeColor(rec: string): string {
  switch (rec) {
    case 'buy': return '#4caf50';
    case 'sell': return '#f44336';
    case 'hold': return '#ff9800';
    default: return '#888';
  }
}

function confidenceColor(c: string): string {
  switch (c) {
    case 'high': return '#4caf50';
    case 'medium': return '#ff9800';
    case 'low': return '#f44336';
    default: return '#888';
  }
}

export function AIAnalysis({ symbol }: Props): React.ReactElement {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset analysis when symbol changes
  useEffect(() => {
    setAnalysis(null);
    setError(null);
  }, [symbol]);

  const handleAnalyze = async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.analyzePosition(symbol);
      setAnalysis(result);
    } catch (err) {
      setError(`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!symbol) {
    return (
      <div className="ai-analysis">
        <h3>AI Analysis</h3>
        <p className="ai-placeholder">Select a symbol to get AI-powered analysis</p>
      </div>
    );
  }

  return (
    <div className="ai-analysis">
      <h3>AI Analysis — {symbol}</h3>

      {!analysis && !loading && !error && (
        <button className="btn btn-primary" onClick={handleAnalyze}>
          Analyze {symbol}
        </button>
      )}

      {loading && <p className="ai-loading">Analyzing {symbol}...</p>}

      {error && <p className="ai-error">{error}</p>}

      {analysis && (
        <div className="ai-result">
          <div className="ai-header">
            <span className="ai-badge" style={{ backgroundColor: badgeColor(analysis.recommendation) }}>
              {analysis.recommendation.toUpperCase()}
            </span>
            <span className="ai-confidence" style={{ color: confidenceColor(analysis.confidence) }}>
              {analysis.confidence.toUpperCase()}
            </span>
          </div>

          <div className="ai-reasoning">
            <p>{analysis.reasoning}</p>
          </div>

          {analysis.risks.length > 0 && (
            <div className="ai-risks">
              <strong>Risks:</strong>
              <ul>
                {analysis.risks.map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="ai-timeframe">
            <strong>Timeframe:</strong> {analysis.timeframe}
          </div>

          <button className="btn btn-secondary" onClick={handleAnalyze}>
            Re-analyze
          </button>
        </div>
      )}
    </div>
  );
}
