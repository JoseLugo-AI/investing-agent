import Anthropic from '@anthropic-ai/sdk';

export interface AnalysisResult {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  risks: string[];
  timeframe: string;
}

interface PositionData {
  qty: string;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  side: string;
}

interface AccountData {
  portfolio_value: string;
  equity: string;
  cash: string;
}

interface BarData {
  c: number;
  h: number;
  l: number;
  o: number;
  v: number;
  t: string;
}

const VALID_RECOMMENDATIONS = ['buy', 'sell', 'hold'] as const;
const VALID_CONFIDENCE = ['high', 'medium', 'low'] as const;

/**
 * Build the analysis prompt for Claude.
 */
export function buildAnalysisPrompt(
  symbol: string,
  position: PositionData | null,
  account: AccountData,
  recentBars: BarData[]
): string {
  const positionInfo = position
    ? `Current position: ${position.qty} shares at avg $${position.avg_entry_price}, current $${position.current_price}, P&L: $${position.unrealized_pl} (${position.side})`
    : 'No current position in this symbol.';

  const priceHistory = recentBars.length > 0
    ? recentBars.slice(-10).map(b => `${b.t}: O=${b.o} H=${b.h} L=${b.l} C=${b.c} V=${b.v}`).join('\n')
    : 'No recent price data available.';

  return `You are an AI investment analyst for a paper trading learning platform. Analyze the following and provide a recommendation.

IMPORTANT: This is PAPER TRADING only — for educational purposes. Be honest about risks.

Symbol: ${symbol}
${positionInfo}

Account:
- Portfolio Value: $${account.portfolio_value}
- Equity: $${account.equity}
- Cash: $${account.cash}

Recent Price History (last 10 bars):
${priceHistory}

Respond with ONLY a JSON object in this exact format:
{
  "recommendation": "buy" | "sell" | "hold",
  "confidence": "high" | "medium" | "low",
  "reasoning": "2-3 sentence explanation",
  "risks": ["risk 1", "risk 2"],
  "timeframe": "suggested holding period"
}`;
}

/**
 * Parse Claude's response into a structured AnalysisResult.
 */
export function parseAnalysisResponse(text: string): AnalysisResult {
  const fallback: AnalysisResult = {
    recommendation: 'hold',
    confidence: 'low',
    reasoning: 'Could not parse AI analysis response.',
    risks: ['Analysis unavailable'],
    timeframe: 'N/A',
  };

  try {
    // Try to extract JSON from the response
    let jsonStr = text;

    // Check for ```json ... ``` blocks
    const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1];
    }

    // Try to find JSON object in the text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!VALID_RECOMMENDATIONS.includes(parsed.recommendation)) {
      return { ...fallback, reasoning: parsed.reasoning || fallback.reasoning };
    }

    return {
      recommendation: parsed.recommendation,
      confidence: VALID_CONFIDENCE.includes(parsed.confidence) ? parsed.confidence : 'low',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'No reasoning provided.',
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      timeframe: typeof parsed.timeframe === 'string' ? parsed.timeframe : 'Unknown',
    };
  } catch {
    return fallback;
  }
}

/**
 * Call Claude API to analyze a position/symbol.
 */
export async function analyzePosition(
  apiKey: string,
  symbol: string,
  position: PositionData | null,
  account: AccountData,
  recentBars: BarData[]
): Promise<AnalysisResult> {
  try {
    const client = new Anthropic({ apiKey });
    const prompt = buildAnalysisPrompt(symbol, position, account, recentBars);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join('');

    return parseAnalysisResponse(text);
  } catch (err) {
    return {
      recommendation: 'hold',
      confidence: 'low',
      reasoning: `Analysis error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      risks: ['AI analysis unavailable'],
      timeframe: 'N/A',
    };
  }
}
