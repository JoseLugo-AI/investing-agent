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
  action: 'buy' | 'sell' | 'hold' | 'skip' | 'short_sell' | 'cover';
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

/**
 * Open a short position — submit a sell order for a stock we don't own.
 * Alpaca handles this as a short sell automatically.
 */
export async function executeShortEntry(
  symbol: string,
  qty: number,
  currentPrice: number,
  tierId: TierId,
  analysisId: number,
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  const { alpaca, store } = ctx;

  try {
    const order = await alpaca.createOrder({
      symbol,
      qty,
      side: 'sell',
      type: 'market',
      time_in_force: 'day',
    });

    const result: ExecutionResult = {
      action: 'short_sell',
      reason: `Short entry: ${symbol} @ ~$${currentPrice.toFixed(2)}`,
      qty,
      price: currentPrice,
      orderId: order.id,
      riskCheck: null,
    };

    store.saveDecision({
      analysisId,
      tierId,
      symbol,
      action: 'short_sell',
      reason: result.reason,
      qty,
      price: currentPrice,
      orderId: order.id,
      riskCheck: null,
    });

    store.logActivity('short_entry', `SHORT ${qty} ${symbol} @ ~$${currentPrice.toFixed(2)}`, tierId, symbol,
      JSON.stringify({ analysisId }));

    return result;
  } catch (err: any) {
    store.logActivity('error', `Short entry failed for ${symbol}: ${err.message}`, tierId, symbol);
    return {
      action: 'skip',
      reason: `Short order failed: ${err.message}`,
      qty: null, price: null, orderId: null, riskCheck: null,
    };
  }
}

/**
 * Cover (close) a short position — submit a buy order.
 */
export async function executeShortExit(
  symbol: string,
  qty: number,
  currentPrice: number,
  exitReason: string,
  tierId: TierId,
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  const { alpaca, store } = ctx;

  try {
    const order = await alpaca.createOrder({
      symbol,
      qty,
      side: 'buy',
      type: 'market',
      time_in_force: 'day',
    });

    const result: ExecutionResult = {
      action: 'cover',
      reason: exitReason,
      qty,
      price: currentPrice,
      orderId: order.id,
      riskCheck: null,
    };

    store.saveDecision({
      analysisId: 0,
      tierId,
      symbol,
      action: 'cover',
      reason: exitReason,
      qty,
      price: currentPrice,
      orderId: order.id,
      riskCheck: null,
    });

    store.logActivity('short_exit', `COVER ${qty} ${symbol} @ ~$${currentPrice.toFixed(2)} — ${exitReason}`, tierId, symbol);

    return result;
  } catch (err: any) {
    store.logActivity('error', `Cover failed for ${symbol}: ${err.message}`, tierId, symbol);
    return {
      action: 'skip',
      reason: `Cover order failed: ${err.message}`,
      qty: null, price: null, orderId: null, riskCheck: null,
    };
  }
}

// === Crypto execution functions ===

interface CryptoExecutionContext {
  alpaca: AlpacaClient;
  store: AgentStore;
  account?: any;
  positions?: any[];
}

/**
 * Execute a crypto DCA buy order.
 * Uses 'gtc' time_in_force (crypto is 24/7) and supports fractional qty.
 */
export async function executeCryptoDCA(
  symbol: string,
  buyAmountDollars: number,
  analysisId: number,
  tierId: TierId,
  ctx: CryptoExecutionContext
): Promise<ExecutionResult> {
  const { alpaca, store } = ctx;

  try {
    // Get current price for qty calculation
    const snapshot = await alpaca.getCryptoSnapshot(symbol);
    const currentPrice = snapshot?.LatestTrade?.Price ?? snapshot?.DailyBar?.Close;
    if (!currentPrice || currentPrice <= 0) {
      const result: ExecutionResult = {
        action: 'skip',
        reason: `Could not get ${symbol} price for DCA`,
        qty: null, price: null, orderId: null, riskCheck: null,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      return result;
    }

    // Fractional qty for crypto
    const qty = parseFloat((buyAmountDollars / currentPrice).toFixed(6));
    if (qty <= 0 || buyAmountDollars < 1) {
      const result: ExecutionResult = {
        action: 'skip',
        reason: `DCA amount too small ($${buyAmountDollars.toFixed(2)})`,
        qty: null, price: null, orderId: null, riskCheck: null,
      };
      logDecision(store, analysisId, tierId, symbol, result);
      return result;
    }

    const order = await alpaca.createOrder({
      symbol,
      qty,
      side: 'buy',
      type: 'market',
      time_in_force: 'gtc', // crypto is 24/7
    });

    const result: ExecutionResult = {
      action: 'buy',
      reason: `Crypto DCA buy: $${buyAmountDollars.toFixed(2)} of ${symbol}`,
      qty,
      price: currentPrice,
      orderId: order.id,
      riskCheck: null,
    };
    logDecision(store, analysisId, tierId, symbol, result);
    store.logActivity('trade', `CRYPTO DCA BUY ${qty.toFixed(6)} ${symbol} @ ~$${currentPrice.toFixed(2)} ($${buyAmountDollars.toFixed(0)})`, tierId, symbol);
    return result;
  } catch (err: any) {
    const result: ExecutionResult = {
      action: 'skip',
      reason: `Crypto DCA order failed: ${err.message}`,
      qty: null, price: null, orderId: null, riskCheck: null,
    };
    logDecision(store, analysisId, tierId, symbol, result);
    store.logActivity('error', `Crypto DCA failed for ${symbol}: ${err.message}`, tierId, symbol);
    return result;
  }
}

/**
 * Trim a crypto position (sell a percentage during extreme greed).
 */
export async function executeCryptoTrim(
  symbol: string,
  trimQty: number,
  analysisId: number,
  tierId: TierId,
  ctx: Pick<CryptoExecutionContext, 'alpaca' | 'store'>
): Promise<ExecutionResult> {
  const { alpaca, store } = ctx;

  try {
    const qty = parseFloat(trimQty.toFixed(6));
    if (qty <= 0) {
      return { action: 'skip', reason: 'Trim qty is 0', qty: null, price: null, orderId: null, riskCheck: null };
    }

    const snapshot = await alpaca.getCryptoSnapshot(symbol);
    const currentPrice = snapshot?.LatestTrade?.Price ?? snapshot?.DailyBar?.Close ?? 0;

    const order = await alpaca.createOrder({
      symbol,
      qty,
      side: 'sell',
      type: 'market',
      time_in_force: 'gtc',
    });

    const result: ExecutionResult = {
      action: 'sell',
      reason: `Crypto greed trim: ${qty.toFixed(6)} ${symbol}`,
      qty,
      price: currentPrice,
      orderId: order.id,
      riskCheck: null,
    };
    logDecision(store, analysisId, tierId, symbol, result);
    store.logActivity('trade', `CRYPTO TRIM ${qty.toFixed(6)} ${symbol} @ ~$${currentPrice.toFixed(2)}`, tierId, symbol);
    return result;
  } catch (err: any) {
    store.logActivity('error', `Crypto trim failed for ${symbol}: ${err.message}`, tierId, symbol);
    return { action: 'skip', reason: `Trim failed: ${err.message}`, qty: null, price: null, orderId: null, riskCheck: null };
  }
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
