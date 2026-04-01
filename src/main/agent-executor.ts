import type { AlpacaClient } from './alpaca-client';
import type { AgentStore } from './agent-store';
import type { TierId, AgentAnalysisResult, TierAllocation } from '../shared/agent-types';
import { validateOrder, getDefaultRiskConfig } from './risk-engine';

interface ExecutionContext {
  alpaca: AlpacaClient;
  store: AgentStore;
  account: any;
  positions: any[];
  tierAllocation: TierAllocation;
}

interface ExecutionResult {
  action: 'buy' | 'sell' | 'hold' | 'skip';
  reason: string;
  qty: number | null;
  price: number | null;
  orderId: string | null;
  riskCheck: string | null;
}

/**
 * Execute a trading decision based on Claude's analysis.
 * Validates through the risk engine, places orders, and logs everything.
 */
export async function executeDecision(
  analysisId: number,
  tierId: TierId,
  symbol: string,
  analysis: AgentAnalysisResult,
  currentPrice: number,
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  const { alpaca, store, account, positions, tierAllocation } = ctx;

  // Hold or low confidence — no action
  if (analysis.recommendation === 'hold') {
    const result: ExecutionResult = {
      action: 'hold',
      reason: analysis.reasoning,
      qty: null, price: null, orderId: null, riskCheck: null,
    };
    logDecision(store, analysisId, tierId, symbol, result);
    return result;
  }

  // Sell — find existing position and sell
  if (analysis.recommendation === 'sell') {
    const position = positions.find((p: any) => p.symbol === symbol);
    if (!position) {
      const result: ExecutionResult = {
        action: 'skip',
        reason: 'Sell recommended but no position held',
        qty: null, price: null, orderId: null, riskCheck: null,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      return result;
    }

    const qty = parseInt(position.qty, 10);
    try {
      const order = await alpaca.createOrder({
        symbol,
        qty,
        side: 'sell',
        type: 'market',
        time_in_force: 'day',
      });
      const result: ExecutionResult = {
        action: 'sell',
        reason: analysis.reasoning,
        qty,
        price: currentPrice,
        orderId: order.id,
        riskCheck: null,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      store.logActivity('trade', `SELL ${qty} ${symbol} @ ~$${currentPrice.toFixed(2)}`, tierId, symbol,
        JSON.stringify({ analysisId, confidence: analysis.confidence, reasoning: analysis.reasoning }));
      return result;
    } catch (err: any) {
      const result: ExecutionResult = {
        action: 'skip',
        reason: `Sell order failed: ${err.message}`,
        qty: null, price: null, orderId: null, riskCheck: null,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      return result;
    }
  }

  // Buy — calculate position size and validate through risk engine
  if (analysis.recommendation === 'buy') {
    // Skip low confidence buys
    if (analysis.confidence === 'low') {
      const result: ExecutionResult = {
        action: 'skip',
        reason: 'Buy signal but confidence too low to act',
        qty: null, price: null, orderId: null, riskCheck: null,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      return result;
    }

    // Check tier budget
    if (tierAllocation.available <= 0) {
      const result: ExecutionResult = {
        action: 'skip',
        reason: `Tier budget exhausted ($${tierAllocation.available.toFixed(0)} available)`,
        qty: null, price: null, orderId: null, riskCheck: null,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      return result;
    }

    // Calculate quantity from target allocation
    const portfolioValue = parseFloat(account.portfolio_value);
    const targetPct = analysis.target_allocation_pct || 0.02; // default 2%
    const targetDollars = Math.min(
      portfolioValue * targetPct,
      tierAllocation.available,
      portfolioValue * 0.03 // max 3% per position
    );
    const qty = Math.floor(targetDollars / currentPrice);

    if (qty <= 0) {
      const result: ExecutionResult = {
        action: 'skip',
        reason: `Calculated quantity is 0 (price $${currentPrice.toFixed(2)}, budget $${targetDollars.toFixed(0)})`,
        qty: null, price: null, orderId: null, riskCheck: null,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      return result;
    }

    // Risk engine validation
    const orderReq = { symbol, qty, side: 'buy', type: 'market', time_in_force: 'day' };
    const riskCheck = validateOrder(orderReq, account, positions, currentPrice, getDefaultRiskConfig());
    const riskCheckStr = JSON.stringify(riskCheck);

    if (!riskCheck.allowed) {
      const result: ExecutionResult = {
        action: 'skip',
        reason: `Risk engine blocked: ${riskCheck.errors.join(', ')}`,
        qty,
        price: currentPrice,
        orderId: null,
        riskCheck: riskCheckStr,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      store.logActivity('skip', `Risk blocked BUY ${qty} ${symbol}: ${riskCheck.errors[0]}`, tierId, symbol);
      return result;
    }

    // Use suggested qty if risk engine adjusted it
    const finalQty = riskCheck.suggestedQty ?? qty;

    try {
      const order = await alpaca.createOrder({
        symbol,
        qty: finalQty,
        side: 'buy',
        type: 'market',
        time_in_force: 'day',
      });
      const result: ExecutionResult = {
        action: 'buy',
        reason: analysis.reasoning,
        qty: finalQty,
        price: currentPrice,
        orderId: order.id,
        riskCheck: riskCheckStr,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      store.logActivity('trade', `BUY ${finalQty} ${symbol} @ ~$${currentPrice.toFixed(2)}`, tierId, symbol,
        JSON.stringify({ analysisId, confidence: analysis.confidence, reasoning: analysis.reasoning }));
      return result;
    } catch (err: any) {
      const result: ExecutionResult = {
        action: 'skip',
        reason: `Buy order failed: ${err.message}`,
        qty: finalQty, price: currentPrice, orderId: null, riskCheck: riskCheckStr,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      return result;
    }
  }

  // Fallback
  const result: ExecutionResult = {
    action: 'skip',
    reason: `Unknown recommendation: ${analysis.recommendation}`,
    qty: null, price: null, orderId: null, riskCheck: null,
  };
  logDecision(store, analysisId, tierId, symbol, result);
  return result;
}

function logDecision(
  store: AgentStore,
  analysisId: number,
  tierId: TierId,
  symbol: string,
  result: ExecutionResult
): void {
  store.saveDecision({
    analysisId,
    tierId,
    symbol,
    action: result.action,
    reason: result.reason,
    qty: result.qty,
    price: result.price,
    orderId: result.orderId,
    riskCheck: result.riskCheck,
  });
}
