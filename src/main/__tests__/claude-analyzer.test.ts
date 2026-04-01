import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRunClaude = vi.hoisted(() => vi.fn());
vi.mock('../run-claude', () => ({ runClaude: mockRunClaude }));

import { analyzePosition, parseAnalysisResponse, buildAnalysisPrompt } from '../claude-analyzer';

describe('Claude Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildAnalysisPrompt', () => {
    it('includes symbol and position data', () => {
      const prompt = buildAnalysisPrompt('AAPL', {
        qty: '10',
        avg_entry_price: '172.50',
        current_price: '178.25',
        unrealized_pl: '57.50',
        side: 'long',
      }, {
        portfolio_value: '100000.00',
        equity: '100000.00',
        cash: '82150.25',
      }, [
        { c: 178, h: 180, l: 175, o: 176, v: 1000000, t: '2026-03-31' },
      ]);

      expect(prompt).toContain('AAPL');
      expect(prompt).toContain('172.50');
      expect(prompt).toContain('178.25');
      expect(prompt).toContain('100000.00');
    });

    it('handles null position (new symbol analysis)', () => {
      const prompt = buildAnalysisPrompt('GOOG', null, {
        portfolio_value: '100000.00',
        equity: '100000.00',
        cash: '82150.25',
      }, []);

      expect(prompt).toContain('GOOG');
      expect(prompt).toContain('No current position');
    });
  });

  describe('parseAnalysisResponse', () => {
    it('parses a valid JSON response', () => {
      const response = JSON.stringify({
        recommendation: 'buy',
        confidence: 'medium',
        reasoning: 'Strong fundamentals and upward momentum.',
        risks: ['Market volatility', 'Sector rotation'],
        timeframe: '1-3 months',
      });

      const result = parseAnalysisResponse(response);
      expect(result.recommendation).toBe('buy');
      expect(result.confidence).toBe('medium');
      expect(result.reasoning).toContain('Strong fundamentals');
      expect(result.risks).toHaveLength(2);
      expect(result.timeframe).toBe('1-3 months');
    });

    it('parses JSON embedded in text', () => {
      const response = `Here's my analysis:\n\n\`\`\`json\n${JSON.stringify({
        recommendation: 'hold',
        confidence: 'high',
        reasoning: 'Stable position.',
        risks: ['Inflation risk'],
        timeframe: '6 months',
      })}\n\`\`\``;

      const result = parseAnalysisResponse(response);
      expect(result.recommendation).toBe('hold');
      expect(result.confidence).toBe('high');
    });

    it('returns fallback for unparseable response', () => {
      const result = parseAnalysisResponse('I cannot provide financial advice.');
      expect(result.recommendation).toBe('hold');
      expect(result.confidence).toBe('low');
      expect(result.reasoning).toContain('Could not parse');
    });

    it('validates recommendation values', () => {
      const response = JSON.stringify({
        recommendation: 'strong_buy',
        confidence: 'medium',
        reasoning: 'Test',
        risks: [],
        timeframe: 'now',
      });

      const result = parseAnalysisResponse(response);
      expect(result.recommendation).toBe('hold');
    });
  });

  describe('analyzePosition', () => {
    it('calls Claude Code CLI and returns parsed result', async () => {
      mockRunClaude.mockResolvedValue(JSON.stringify({
        recommendation: 'buy',
        confidence: 'high',
        reasoning: 'Bullish trend confirmed.',
        risks: ['Earnings miss'],
        timeframe: '2 weeks',
      }));

      const result = await analyzePosition(
        'AAPL',
        { qty: '10', avg_entry_price: '172.50', current_price: '178.25', unrealized_pl: '57.50', side: 'long' },
        { portfolio_value: '100000.00', equity: '100000.00', cash: '82150.25' },
        [{ c: 178, h: 180, l: 175, o: 176, v: 1000000, t: '2026-03-31' }]
      );

      expect(result.recommendation).toBe('buy');
      expect(result.confidence).toBe('high');
      expect(mockRunClaude).toHaveBeenCalledTimes(1);
      expect(mockRunClaude).toHaveBeenCalledWith(expect.stringContaining('AAPL'));
    });

    it('returns fallback on CLI error', async () => {
      mockRunClaude.mockRejectedValue(new Error('claude command not found'));

      const result = await analyzePosition(
        'AAPL',
        null,
        { portfolio_value: '100000.00', equity: '100000.00', cash: '82150.25' },
        []
      );

      expect(result.recommendation).toBe('hold');
      expect(result.confidence).toBe('low');
      expect(result.reasoning).toContain('error');
    });
  });
});
