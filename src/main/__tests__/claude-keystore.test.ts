import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveClaudeKey, loadClaudeKey, hasClaudeKey, clearClaudeKey, setKeyDir } from '../claude-keystore';

describe('Claude Keystore', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-keystore-test-'));
    setKeyDir(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves and loads a Claude API key', () => {
    saveClaudeKey('sk-ant-test-key-123');
    const key = loadClaudeKey();
    expect(key).toBe('sk-ant-test-key-123');
  });

  it('returns null when no key exists', () => {
    const key = loadClaudeKey();
    expect(key).toBeNull();
  });

  it('reports hasClaudeKey correctly', () => {
    expect(hasClaudeKey()).toBe(false);
    saveClaudeKey('sk-ant-test');
    expect(hasClaudeKey()).toBe(true);
  });

  it('clears the stored key', () => {
    saveClaudeKey('sk-ant-test');
    expect(hasClaudeKey()).toBe(true);
    clearClaudeKey();
    expect(hasClaudeKey()).toBe(false);
    expect(loadClaudeKey()).toBeNull();
  });

  it('handles clearing when no key exists', () => {
    expect(() => clearClaudeKey()).not.toThrow();
  });
});
