/**
 * Sentiment analysis for stocks using Claude Code CLI.
 * Analyzes recent news/market narrative for a given symbol.
 * This is the strongest documented LLM edge (74.4% accuracy, Sharpe 3.05).
 */

import { runClaude } from './run-claude';

export interface SentimentResult {
  score: number;       // -1.0 (very bearish) to +1.0 (very bullish)
  label: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
  reasoning: string;
  catalysts: string[];  // upcoming events that could move the stock
  newsAge: 'fresh' | 'stale'; // is the sentiment based on recent events?
}

const SENTIMENT_PROMPT = `You are a financial sentiment analyst. Your job is to assess the current market sentiment for a specific stock based on your knowledge of recent events, earnings, news, analyst ratings, and market narratives.

SYMBOL: {SYMBOL}
COMPANY: {SYMBOL} (look up the company from the ticker)
CURRENT PRICE: ${'{PRICE}'}
SECTOR CONTEXT: Consider broader sector trends affecting this stock.

Analyze the current sentiment around this stock. Consider:
1. Recent earnings results and guidance (if any in last 30 days)
2. Analyst upgrades/downgrades
3. Product launches, partnerships, or competitive developments
4. Macro factors affecting this stock's sector
5. Social media and retail investor sentiment
6. Insider trading activity
7. Any upcoming catalysts (earnings dates, FDA decisions, product launches)

RESPOND WITH ONLY THIS JSON:
{
  "score": <number from -1.0 to 1.0>,
  "label": "very_bearish" | "bearish" | "neutral" | "bullish" | "very_bullish",
  "reasoning": "2-3 sentence summary of the sentiment picture",
  "catalysts": ["upcoming event 1", "upcoming event 2"],
  "news_age": "fresh" | "stale"
}

Score guide:
- 0.7 to 1.0: Very bullish — strong positive catalysts, upgrades, momentum
- 0.3 to 0.7: Bullish — generally positive outlook, supportive trends
- -0.3 to 0.3: Neutral — mixed signals, no clear direction
- -0.7 to -0.3: Bearish — negative developments, downgrades, headwinds
- -1.0 to -0.7: Very bearish — major negative events, sell-offs, fundamental deterioration`;

/**
 * Get sentiment analysis for a symbol using Claude.
 */
export async function analyzeSentiment(symbol: string, currentPrice: number): Promise<SentimentResult> {
  const prompt = SENTIMENT_PROMPT
    .replace(/{SYMBOL}/g, symbol)
    .replace('{PRICE}', currentPrice.toFixed(2));

  try {
    const raw = await runClaude(prompt);
    return parseSentimentResponse(raw);
  } catch (err: any) {
    return {
      score: 0,
      label: 'neutral',
      reasoning: `Sentiment analysis failed: ${err.message}`,
      catalysts: [],
      newsAge: 'stale',
    };
  }
}

function parseSentimentResponse(raw: string): SentimentResult {
  const fallback: SentimentResult = {
    score: 0,
    label: 'neutral',
    reasoning: 'Could not parse sentiment response.',
    catalysts: [],
    newsAge: 'stale',
  };

  try {
    const jsonBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonBlockMatch ? jsonBlockMatch[1] : raw;
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);
    const score = typeof parsed.score === 'number' ? Math.max(-1, Math.min(1, parsed.score)) : 0;

    const VALID_LABELS = ['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'] as const;
    const label = VALID_LABELS.includes(parsed.label) ? parsed.label : scoreToLabel(score);

    return {
      score,
      label,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : fallback.reasoning,
      catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts.map(String) : [],
      newsAge: parsed.news_age === 'fresh' ? 'fresh' : 'stale',
    };
  } catch {
    return fallback;
  }
}

function scoreToLabel(score: number): SentimentResult['label'] {
  if (score >= 0.7) return 'very_bullish';
  if (score >= 0.3) return 'bullish';
  if (score <= -0.7) return 'very_bearish';
  if (score <= -0.3) return 'bearish';
  return 'neutral';
}

/**
 * Format sentiment for inclusion in Claude trading prompts.
 */
export function formatSentimentForPrompt(sentiment: SentimentResult): string {
  const bar = '█'.repeat(Math.round(Math.abs(sentiment.score) * 10));
  const direction = sentiment.score >= 0 ? '+' : '-';

  let catalystStr = '';
  if (sentiment.catalysts.length > 0) {
    catalystStr = `\nUpcoming catalysts: ${sentiment.catalysts.join(', ')}`;
  }

  return `Sentiment: ${sentiment.label.toUpperCase()} (${direction}${Math.abs(sentiment.score).toFixed(2)}) ${bar}
${sentiment.reasoning}${catalystStr}
News freshness: ${sentiment.newsAge}`;
}
