import React, { useState } from 'react';

interface Props {
  onSave: (keyId: string, secretKey: string) => void;
  onClear: () => void;
  hasKeys: boolean;
}

export function Settings({ onSave, onClear, hasKeys }: Props): React.ReactElement {
  const [keyId, setKeyId] = useState('');
  const [secretKey, setSecretKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyId && secretKey) onSave(keyId, secretKey);
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
            Get your paper trading keys at app.alpaca.markets → Paper Trading → API Keys
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
    </div>
  );
}
