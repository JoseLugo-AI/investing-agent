import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Electron's safeStorage
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((text: string) => Buffer.from(`enc:${text}`)),
    decryptString: vi.fn((buf: Buffer) => buf.toString().replace('enc:', '')),
  },
  app: {
    getPath: vi.fn(() => '/tmp/investing-agent-test'),
  },
}));

// Use vi.hoisted so mockStore is available inside the hoisted vi.mock factory
const { mockStore } = vi.hoisted(() => {
  const mockStore: Record<string, string> = {};
  return { mockStore };
});

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn((p: string) => p in mockStore),
    readFileSync: vi.fn((p: string) => mockStore[p]),
    writeFileSync: vi.fn((p: string, data: string) => { mockStore[p] = data; }),
    unlinkSync: vi.fn((p: string) => { delete mockStore[p]; }),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn((p: string) => p in mockStore),
  readFileSync: vi.fn((p: string) => mockStore[p]),
  writeFileSync: vi.fn((p: string, data: string) => { mockStore[p] = data; }),
  unlinkSync: vi.fn((p: string) => { delete mockStore[p]; }),
  mkdirSync: vi.fn(),
}));

import { saveKeys, loadKeys, hasKeys, clearKeys } from '../keystore';

describe('keystore', () => {
  beforeEach(() => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  });

  it('returns false when no keys stored', () => {
    expect(hasKeys()).toBe(false);
  });

  it('saves and loads API keys', () => {
    saveKeys('PKTEST123', 'SKTEST456');
    expect(hasKeys()).toBe(true);
    const keys = loadKeys();
    expect(keys).toEqual({ keyId: 'PKTEST123', secretKey: 'SKTEST456' });
  });

  it('clears stored keys', () => {
    saveKeys('PKTEST123', 'SKTEST456');
    clearKeys();
    expect(hasKeys()).toBe(false);
    expect(loadKeys()).toBeNull();
  });
});
