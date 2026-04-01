import { log } from './logger';

const GITHUB_REPO = 'JoseLugo-AI/investing-agent';
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
}

/**
 * Check for updates by comparing current version against GitHub releases.
 * Simple approach — no auto-download, just notifies user.
 */
export async function checkForUpdates(currentVersion: string): Promise<UpdateInfo> {
  const result: UpdateInfo = {
    updateAvailable: false,
    currentVersion,
    latestVersion: currentVersion,
    downloadUrl: '',
    releaseNotes: '',
  };

  try {
    const response = await fetch(RELEASES_URL, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
      log.warn(`Update check failed: ${response.status}`);
      return result;
    }

    const release = await response.json();
    const latestVersion = (release.tag_name || '').replace(/^v/, '');

    if (latestVersion && isNewerVersion(currentVersion, latestVersion)) {
      result.updateAvailable = true;
      result.latestVersion = latestVersion;
      result.downloadUrl = release.html_url || '';
      result.releaseNotes = release.body || '';
      log.info(`Update available: ${currentVersion} -> ${latestVersion}`);
    } else {
      log.info(`App is up to date (${currentVersion})`);
    }
  } catch (err) {
    log.warn('Update check failed:', err);
  }

  return result;
}

/**
 * Simple semver comparison (major.minor.patch).
 */
function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const c = parse(current);
  const l = parse(latest);

  for (let i = 0; i < 3; i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}
