import type { TierConfig, AgentAnalysis, AgentDecision, TierAllocation } from '../shared/agent-types';
import type { StrategySignal } from './strategy-engine';
import type { SentimentResult } from './sentiment-analyzer';
import type { RegimeResult } from './regime-detector';
import { formatSentimentForPrompt } from './sentiment-analyzer';
import { formatRegimeForPrompt } from './regime-detector';
import { formatStrategyForPrompt } from './strategy-engine';

interface PositionData {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  market_value: string;
  side: string;
}

interface AccountData {
  portfolio_value: string;
  equity: string;
  cash: string;
  last_equity: string;
}

interface BarData {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface RiskStatus {
  dailyLossPercent: number;
  drawdownLevel: string;
}

const TIER_STRATEGIES: Record<string, string> = {
  conservative: `Buy and hold index ETFs and blue-chip stocks. Focus on stability, dividends, and long-term growth.
Holding period: months to years. Only sell if fundamentals deteriorate significantly.
Rebalance monthly to maintain target weights. Prefer dollar-cost averaging into positions.`,

  moderate: `Swing trading growth stocks and sector leaders. Look for multi-day to multi-week moves.
Enter on confirmed breakouts or pullbacks to support. Exit on momentum exhaustion or target price.
Balance conviction with diversification. Take profits at 10-15% gains, cut losses at 5-7%.`,

  aggressive: `Active momentum trading. Look for high-volatility setups with above-average volume.
Enter on breakouts with volume confirmation. Use tight stops (2-3%). Take quick profits (5-10%).
Hold hours to days. Be willing to go to cash if no setups qualify. Speed matters.`,
};

/**
 * Build a context-rich prompt for the agent's Claude analysis call.
 * This is the "memory" layer — packing previous analyses, trades, and portfolio state
 * into each stateless Claude call.
 */
export function buildAgentPrompt(params: {
  symbol: string;
  tier: TierConfig;
  tierAllocation: TierAllocation;
  position: PositionData | null;
  account: AccountData;
  allPositions: PositionData[];
  recentBars: BarData[];
  previousAnalyses: AgentAnalysis[];
  recentTierTrades: AgentDecision[];
  riskStatus: RiskStatus;
  // Strategy engine signals (Phase 1)
  strategySignal?: StrategySignal;
  sentiment?: SentimentResult;
  regime?: RegimeResult;
}): string {
  const { symbol, tier, tierAllocation, position, account, allPositions, recentBars, previousAnalyses, recentTierTrades, riskStatus, strategySignal, sentiment, regime } = params;

  const portfolioValue = parseFloat(account.portfolio_value);

  // Tier mandate
  const mandate = `=== YOUR MANDATE ===
Tier: ${tier.label} (${(tier.target_pct * 100).toFixed(0)}% of portfolio)
Strategy: ${TIER_STRATEGIES[tier.id]}
Scan frequency: Every ${tier.scan_interval_min} minutes during market hours`;

  // Portfolio state
  const portfolioState = `=== PORTFOLIO STATE ===
Total equity: $${parseFloat(account.equity).toLocaleString()}
Cash: $${parseFloat(account.cash).toLocaleString()}
Daily P&L: ${riskStatus.dailyLossPercent.toFixed(2)}%
Drawdown level: ${riskStatus.drawdownLevel}

Tier budget: $${tierAllocation.target_value.toLocaleString()} target | $${tierAllocation.current_value.toLocaleString()} deployed | $${tierAllocation.available.toLocaleString()} available
Tier positions: ${tierAllocation.position_count}`;

  // All positions summary
  const positionsSummary = allPositions.length > 0
    ? `=== ALL CURRENT POSITIONS ===\n${allPositions.map(p =>
        `${p.symbol}: ${p.qty} shares @ $${parseFloat(p.avg_entry_price).toFixed(2)}, now $${parseFloat(p.current_price).toFixed(2)}, P&L: $${parseFloat(p.unrealized_pl).toFixed(2)}`
      ).join('\n')}`
    : '=== ALL CURRENT POSITIONS ===\nNo open positions.';

  // Symbol under review
  const positionInfo = position
    ? `Current position: ${position.qty} shares at avg $${parseFloat(position.avg_entry_price).toFixed(2)}, current $${parseFloat(position.current_price).toFixed(2)}, P&L: $${parseFloat(position.unrealized_pl).toFixed(2)} (${position.side})`
    : 'No current position in this symbol.';

  const priceHistory = recentBars.length > 0
    ? recentBars.slice(-15).map(b => `${b.t}: O=${b.o.toFixed(2)} H=${b.h.toFixed(2)} L=${b.l.toFixed(2)} C=${b.c.toFixed(2)} V=${b.v.toLocaleString()}`).join('\n')
    : 'No recent price data available.';

  // Previous analyses for this symbol (the "memory")
  let analysisHistory = '';
  if (previousAnalyses.length > 0) {
    analysisHistory = `=== YOUR PREVIOUS ANALYSES FOR ${symbol} ===\n${previousAnalyses.map(a => {
      return `[${a.created_at}] Recommended ${a.recommendation.toUpperCase()} (${a.confidence} confidence): "${a.reasoning}"`;
    }).join('\n\n')}`;
  }

  // Recent trades in this tier
  let tradeHistory = '';
  if (recentTierTrades.length > 0) {
    tradeHistory = `=== RECENT TRADES IN ${tier.label.toUpperCase()} TIER ===\n${recentTierTrades.map(d => {
      const qtyStr = d.qty ? `${d.qty} shares` : '';
      const priceStr = d.price ? `@ $${d.price.toFixed(2)}` : '';
      return `[${d.created_at}] ${d.action.toUpperCase()} ${d.symbol} ${qtyStr} ${priceStr} — ${d.reason}`;
    }).join('\n')}`;
  }

  // Strategy engine signals
  let strategySection = '';
  if (regime) {
    strategySection += formatRegimeForPrompt(regime) + '\n\n';
  }
  if (sentiment) {
    strategySection += `=== SENTIMENT ANALYSIS: ${symbol} ===\n${formatSentimentForPrompt(sentiment)}\n\n`;
  }
  if (strategySignal) {
    strategySection += formatStrategyForPrompt(strategySignal) + '\n\n';
  }

  // Decision context — different instructions for owned vs unowned
  const decisionContext = position
    ? `=== DECISION CONTEXT ===
You ALREADY OWN this position. Your options are:
- "hold" — keep the position, no action needed
- "sell" — exit the position (explain why fundamentals changed or target hit)
- "buy" — add to the position (explain why you want more exposure)`
    : `=== DECISION CONTEXT ===
You DO NOT own this symbol yet. Your options are:
- "buy" — open a new position (this is what you should do if the symbol fits the tier strategy and has a reasonable entry point)
- "hold" — ONLY use this if you see no good entry right now but want to watch it

IMPORTANT: Your tier has $${tierAllocation.available.toLocaleString()} available to deploy. Your job is to BUILD POSITIONS that match the tier strategy. Do not hold cash unnecessarily. If a symbol belongs in this tier and the price action is not terrible, BUY IT. This is paper trading — bias toward action and learning.`;

  // Constraints
  const constraints = `=== CONSTRAINTS ===
- Max position size: 3% of total portfolio ($${(portfolioValue * 0.03).toFixed(0)})
- Available tier budget: $${tierAllocation.available.toLocaleString()}
- Risk engine validates all trades independently — if it blocks, the trade won't execute
- This is PAPER TRADING — bias toward deploying capital and learning from results`;

  // Response format
  const responseFormat = `=== RESPOND WITH ONLY THIS JSON ===
{
  "recommendation": "buy" | "sell" | "hold",
  "confidence": "high" | "medium" | "low",
  "reasoning": "2-4 sentence explanation of your thesis",
  "risks": ["risk 1", "risk 2"],
  "timeframe": "suggested holding period",
  "target_allocation_pct": 0.01-0.03 (only for buy — what % of TOTAL portfolio),
  "urgency": "immediate" | "soon" | "watch"
}`;

  return `You are an autonomous AI trading agent managing the ${tier.label} tier of a paper trading portfolio.

${mandate}

${portfolioState}

${positionsSummary}

=== SYMBOL UNDER REVIEW: ${symbol} ===
${positionInfo}

Recent price history (last 15 bars):
${priceHistory}

${analysisHistory}

${tradeHistory}

${strategySection}${decisionContext}

${constraints}

${responseFormat}`;
}
