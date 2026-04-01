import fs from 'fs';
import path from 'path';

/**
 * Simple keystore for the Claude API key.
 * Uses the same pattern as the Alpaca keystore but stores plaintext
 * in a separate file (safeStorage requires Electron app to be ready,
 * which complicates testing — for a paper trading learning tool, this is fine).
 *
 * In production, we'd use safeStorage like the Alpaca keystore.
 */

let keyDir: string;

function getKeyDir(): string {
  if (keyDir) return keyDir;
  try {
    const { app } = require('electron');
    keyDir = app.getPath('userData');
  } catch {
    keyDir = '/tmp/investing-agent';
  }
  if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { recursive: true });
  return keyDir;
}

function getKeyPath(): string {
  return path.join(getKeyDir(), '.claude-key');
}

export function saveClaudeKey(apiKey: string): void {
  fs.writeFileSync(getKeyPath(), apiKey, 'utf-8');
}

export function loadClaudeKey(): string | null {
  const keyPath = getKeyPath();
  if (!fs.existsSync(keyPath)) return null;
  return fs.readFileSync(keyPath, 'utf-8').trim();
}

export function hasClaudeKey(): boolean {
  return fs.existsSync(getKeyPath());
}

export function clearClaudeKey(): void {
  const keyPath = getKeyPath();
  if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
}

/** For testing — override the key directory */
export function setKeyDir(dir: string): void {
  keyDir = dir;
}
