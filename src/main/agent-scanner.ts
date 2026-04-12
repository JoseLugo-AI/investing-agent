import type { AlpacaClient } from './alpaca-client';
import { isCrypto } from './alpaca-client';
import type { TierConfig, TierId } from '../shared/agent-types';

export interface ScanCandidate {
  symbol: string;
  currentPrice: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  bars: any[];
}

export interface ScanResult {
  tierId: TierId;
  candidates: ScanCandidate[];
  existingPositions: ScanCandidate[];
}

/**
 * Scan the market for a given tier. Returns existing positions in the tier
 * plus new candidates from the tier's universe, ranked by relevance.
 */
export async function scanTier(
  tier: TierConfig,
  alpaca: AlpacaClient,
  currentPositions: any[]
): Promise<ScanResult> {
  // Only include positions that belong to this tier's universe
  const tierSymbolSet = new Set(tier.symbols);
  const tierPositions = currentPositions.filter((p: any) => tierSymbolSet.has(p.symbol));
  const positionSymbols = new Set(tierPositions.map((p: any) => p.symbol));

  // Tier universe + any positions already in this tier
  const allSymbols = [...new Set([...tier.symbols, ...positionSymbols])];

  const existingPositions: ScanCandidate[] = [];
  const candidates: ScanCandidate[] = [];

  // Fetch bars in parallel batches of 5
  const batchSize = 5;
  for (let i = 0; i < allSymbols.length; i += batchSize) {
    const batch = allSymbols.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (symbol) => {
        const bars = isCrypto(symbol)
          ? await alpaca.getCryptoBars(symbol, '1Day', 20)
          : await alpaca.getBars(symbol, '1Day', 20);
        if (bars.length < 2) return null;

        const latest = bars[bars.length - 1];
        const prev = bars[bars.length - 2];
        const changePercent = prev.c > 0 ? ((latest.c - prev.c) / prev.c) * 100 : 0;
        const volumes = bars.map((b: any) => b.v);
        const avgVolume = volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length;

        const candidate: ScanCandidate = {
          symbol,
          currentPrice: latest.c,
          changePercent,
          volume: latest.v,
          avgVolume,
          bars,
        };

        return { symbol, candidate };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { symbol, candidate } = result.value;
        if (positionSymbols.has(symbol)) {
          existingPositions.push(candidate);
        } else {
          candidates.push(candidate);
        }
      }
    }
  }

  // Rank candidates by tier-specific criteria
  const ranked = rankCandidates(tier.id, candidates);

  return {
    tierId: tier.id,
    candidates: ranked.slice(0, 5), // top 5 new candidates per scan
    existingPositions,
  };
}

/**
 * Rank candidates differently per tier strategy.
 */
function rankCandidates(tierId: TierId, candidates: ScanCandidate[]): ScanCandidate[] {
  switch (tierId) {
    case 'conservative':
      // Prefer low volatility, high volume (stable blue chips)
      return [...candidates].sort((a, b) => {
        const volA = Math.abs(a.changePercent);
        const volB = Math.abs(b.changePercent);
        return volA - volB; // lower volatility first
      });

    case 'moderate':
      // Prefer positive momentum with decent volume
      return [...candidates].sort((a, b) => {
        const scoreA = a.changePercent * (a.volume / Math.max(a.avgVolume, 1));
        const scoreB = b.changePercent * (b.volume / Math.max(b.avgVolume, 1));
        return scoreB - scoreA; // higher momentum score first
      });

    case 'aggressive':
      // Prefer high volatility + above-average volume (momentum plays)
      return [...candidates].sort((a, b) => {
        const scoreA = Math.abs(a.changePercent) * (a.volume / Math.max(a.avgVolume, 1));
        const scoreB = Math.abs(b.changePercent) * (b.volume / Math.max(b.avgVolume, 1));
        return scoreB - scoreA; // highest volatility-volume combo first
      });

    case 'jose_crypto':
      // Crypto: rank by volume ratio (institutional/whale activity)
      return [...candidates].sort((a, b) => {
        const ratioA = a.avgVolume > 0 ? a.volume / a.avgVolume : 0;
        const ratioB = b.avgVolume > 0 ? b.volume / b.avgVolume : 0;
        return ratioB - ratioA;
      });

    default:
      return candidates;
  }
}
