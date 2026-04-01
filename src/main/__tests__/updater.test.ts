import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkForUpdates } from '../updater';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock logger
vi.mock('../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Updater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects when update is available', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        tag_name: 'v2.0.0',
        html_url: 'https://github.com/test/releases/v2.0.0',
        body: 'New features!',
      }),
    });

    const result = await checkForUpdates('1.0.0');
    expect(result.updateAvailable).toBe(true);
    expect(result.latestVersion).toBe('2.0.0');
    expect(result.downloadUrl).toContain('github.com');
  });

  it('reports no update when current is latest', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        tag_name: 'v1.0.0',
        html_url: '',
        body: '',
      }),
    });

    const result = await checkForUpdates('1.0.0');
    expect(result.updateAvailable).toBe(false);
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await checkForUpdates('1.0.0');
    expect(result.updateAvailable).toBe(false);
    expect(result.currentVersion).toBe('1.0.0');
  });

  it('handles non-200 response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const result = await checkForUpdates('1.0.0');
    expect(result.updateAvailable).toBe(false);
  });

  it('compares semver correctly (patch update)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        tag_name: 'v1.0.1',
        html_url: '',
        body: 'Bug fix',
      }),
    });

    const result = await checkForUpdates('1.0.0');
    expect(result.updateAvailable).toBe(true);
  });
});
