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

function parseSentimentResponse(raw: string): SentimentResult & { _parseFailed?: boolean } {
  const fallback: SentimentResult & { _parseFailed: boolean } = {
    score: 0,
    label: 'neutral',
    reasoning: 'Could not parse sentiment response.',
    catalysts: [],
    newsAge: 'stale',
    _parseFailed: true,
  };

  if (!raw || raw.trim().length === 0) {
    console.error('[sentiment] Empty response from Claude');
    return fallback;
  }

  // Strategy 1: Extract JSON from markdown code block
  const jsonBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  // Strategy 2: Find a JSON object directly in the text
  const rawJsonMatch = raw.match(/\{[\s\S]*\}/);

  const candidates = [
    jsonBlockMatch?.[1]?.trim(),
    rawJsonMatch?.[0],
    raw.trim(),  // Strategy 3: The entire response might be JSON
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed.score !== 'undefined') {
        return extractSentiment(parsed);
      }
    } catch {
      // Try next candidate
    }
  }

  // Strategy 4: Regex extraction — pull individual fields from malformed JSON
  const scoreMatch = raw.match(/"score"\s*:\s*(-?[\d.]+)/);
  const labelMatch = raw.match(/"label"\s*:\s*"([^"]+)"/);
  const reasoningMatch = raw.match(/"reasoning"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  if (scoreMatch) {
    const score = Math.max(-1, Math.min(1, parseFloat(scoreMatch[1])));
    const VALID_LABELS = ['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'] as const;
    const rawLabel = labelMatch?.[1] as any;
    return {
      score,
      label: VALID_LABELS.includes(rawLabel) ? rawLabel : scoreToLabel(score),
      reasoning: reasoningMatch?.[1] ?? `Sentiment score: ${score}`,
      catalysts: [],
      newsAge: 'stale',
    };
  }

  console.error('[sentiment] All parse strategies failed. Raw response:', raw.substring(0, 500));
  return fallback;
}

function extractSentiment(parsed: any): SentimentResult {
  const score = typeof parsed.score === 'number'
    ? Math.max(-1, Math.min(1, parsed.score))
    : typeof parsed.score === 'string'
      ? Math.max(-1, Math.min(1, parseFloat(parsed.score) || 0))
      : 0;

  const VALID_LABELS = ['very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'] as const;
  const label = VALID_LABELS.includes(parsed.label) ? parsed.label : scoreToLabel(score);

  return {
    score,
    label,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : `Sentiment score: ${score}`,
    catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts.map(String) : [],
    newsAge: parsed.news_age === 'fresh' || parsed.newsAge === 'fresh' ? 'fresh' : 'stale',
  };
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
