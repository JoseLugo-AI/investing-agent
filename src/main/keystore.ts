import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

function getKeyPath(): string {
  const dir = app?.getPath?.('userData') ?? '/tmp/investing-agent';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, '.alpaca-keys');
}

export function saveKeys(keyId: string, secretKey: string): void {
  const data = JSON.stringify({ keyId, secretKey });
  const encrypted = safeStorage.encryptString(data);
  fs.writeFileSync(getKeyPath(), encrypted.toString('base64'));
}

export function loadKeys(): { keyId: string; secretKey: string } | null {
  const keyPath = getKeyPath();
  if (!fs.existsSync(keyPath)) return null;
  const raw = fs.readFileSync(keyPath, 'utf-8');
  const buf = Buffer.from(raw, 'base64');
  const decrypted = safeStorage.decryptString(buf);
  return JSON.parse(decrypted);
}

export function hasKeys(): boolean {
  return fs.existsSync(getKeyPath());
}

export function clearKeys(): void {
  const keyPath = getKeyPath();
  if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
}
