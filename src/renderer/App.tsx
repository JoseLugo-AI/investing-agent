import React, { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { AgentDashboard } from './components/AgentDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { api } from './api';

export function App(): React.ReactElement {
  const [hasKeys, setHasKeys] = useState<boolean | null>(null);
  const [view, setView] = useState<'dashboard' | 'agent' | 'settings'>('dashboard');

  useEffect(() => {
    api.hasApiKeys().then(setHasKeys);
  }, []);

  const handleSaveKeys = async (keyId: string, secretKey: string) => {
    await api.saveApiKeys(keyId, secretKey);
    setHasKeys(true);
    setView('dashboard');
  };

  const handleClearKeys = async () => {
    await api.clearApiKeys();
    setHasKeys(false);
  };

  if (hasKeys === null) return <div className="app">Loading...</div>;

  if (!hasKeys) {
    return (
      <div className="app">
        <Settings onSave={handleSaveKeys} onClear={handleClearKeys} hasKeys={false} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app">
        <nav className="app-nav">
          <button
            className={view === 'dashboard' ? 'active' : ''}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={view === 'agent' ? 'active' : ''}
            onClick={() => setView('agent')}
          >
            Agent
          </button>
          <button
            className={view === 'settings' ? 'active' : ''}
            onClick={() => setView('settings')}
          >
            Settings
          </button>
        </nav>
        {view === 'dashboard' && <Dashboard />}
        {view === 'agent' && <AgentDashboard />}
        {view === 'settings' && <Settings onSave={handleSaveKeys} onClear={handleClearKeys} hasKeys={true} />}
      </div>
    </ErrorBoundary>
  );
}
