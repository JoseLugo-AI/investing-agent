import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface Props {
  onSave: (keyId: string, secretKey: string) => void;
  onClear: () => void;
  hasKeys: boolean;
}

export function Settings({ onSave, onClear, hasKeys }: Props): React.ReactElement {
  const [keyId, setKeyId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [hasClaudeKey, setHasClaudeKey] = useState(false);
  const [claudeSaved, setClaudeSaved] = useState(false);

  useEffect(() => {
    api.hasClaudeKey().then(setHasClaudeKey).catch(() => {});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyId && secretKey) onSave(keyId, secretKey);
  };

  const handleSaveClaude = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claudeKey) return;
    await api.saveClaudeKey(claudeKey);
    setHasClaudeKey(true);
    setClaudeKey('');
    setClaudeSaved(true);
    setTimeout(() => setClaudeSaved(false), 3000);
  };

  const handleClearClaude = async () => {
    await api.clearClaudeKey();
    setHasClaudeKey(false);
  };

  return (
    <div className="settings">
      <h2>Alpaca API Settings</h2>
      {hasKeys ? (
        <div className="settings-connected">
          <p className="connected-badge">Connected to Alpaca Paper Trading</p>
          <button className="btn btn-danger" onClick={onClear}>
            Disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="settings-form">
          <p className="settings-hint">
            Get your paper trading keys at app.alpaca.markets -- Paper Trading -- API Keys
          </p>
          <input
            type="text"
            placeholder="API Key ID (PK...)"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
          />
          <input
            type="password"
            placeholder="Secret Key (SK...)"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!keyId || !secretKey}>
            Save Keys
          </button>
        </form>
      )}

      <h2>Claude AI Analysis</h2>
      {hasClaudeKey ? (
        <div className="settings-connected">
          <p className="connected-badge">Claude API key configured</p>
          {claudeSaved && <p className="saved-badge">Saved!</p>}
          <button className="btn btn-danger" onClick={handleClearClaude}>
            Remove Claude Key
          </button>
        </div>
      ) : (
        <form onSubmit={handleSaveClaude} className="settings-form">
          <p className="settings-hint">
            Get your API key at console.anthropic.com -- enables AI-powered trade analysis
          </p>
          <input
            type="password"
            placeholder="Claude API Key (sk-ant-...)"
            value={claudeKey}
            onChange={(e) => setClaudeKey(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!claudeKey}>
            Save Claude Key
          </button>
        </form>
      )}

      <h2>Risk Limits</h2>
      <div className="settings-risk-info">
        <div className="settings-risk-row">
          <span>Max capital per trade</span><span>2%</span>
        </div>
        <div className="settings-risk-row">
          <span>Daily loss halt</span><span>3%</span>
        </div>
        <div className="settings-risk-row">
          <span>Weekly drawdown pause</span><span>5%</span>
        </div>
        <div className="settings-risk-row">
          <span>Max drawdown (kill switch)</span><span>20%</span>
        </div>
        <div className="settings-risk-row">
          <span>Max single position</span><span>3%</span>
        </div>
        <div className="settings-risk-row">
          <span>Max sector exposure</span><span>30%</span>
        </div>
        <p className="settings-hint">
          Risk limits are designed to protect new traders. They cannot be modified in this version.
        </p>
      </div>

      <div className="settings-version">
        <p>Investing Agent v1.0.0 -- Paper Trading Only</p>
      </div>
    </div>
  );
}
