/**
 * Fear & Greed Index fetcher for crypto strategy.
 * Uses the free alternative.me API (no API key needed).
 * Index updates once per day — we cache for 24 hours.
 *
 * Research basis: Fear-based DCA returned 1,145% over 7 years (2018-2025),
 * outperforming buy-and-hold by 99 percentage points.
 */

export interface FearGreedResult {
  value: number;       // 0-100 (0 = extreme fear, 100 = extreme greed)
  label: string;       // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: string;   // ISO date
}

let cache: { result: FearGreedResult; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchFearGreedIndex(): Promise<FearGreedResult> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.result;
  }

  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const entry = data.data?.[0];

    if (!entry || typeof entry.value === 'undefined') {
      throw new Error('Unexpected API response shape');
    }

    const result: FearGreedResult = {
      value: parseInt(entry.value, 10),
      label: entry.value_classification,
      timestamp: new Date(parseInt(entry.timestamp, 10) * 1000).toISOString(),
    };

    cache = { result, fetchedAt: Date.now() };
    return result;
  } catch (err: any) {
    console.error(`[fear-greed] Failed to fetch: ${err.message}`);

    // Return cached value if available, otherwise neutral fallback
    if (cache) {
      console.warn('[fear-greed] Using stale cache');
      return cache.result;
    }

    return {
      value: 50,
      label: 'Neutral',
      timestamp: new Date().toISOString(),
    };
  }
}

export function clearFearGreedCache(): void {
  cache = null;
}
