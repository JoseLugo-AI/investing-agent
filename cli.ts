/**
 * CLI runner for the investing agent.
 * Runs directly in Node/WSL — no Electron needed.
 * Set ALPACA_LIVE=true to use real money (default: paper trading).
 *
 * Usage: npx tsx cli.ts <command> [args...]
 *
 * Commands:
 *   account                     — Show account summary
 *   positions                   — List open positions
 *   orders                      — List recent orders
 *   quote <SYMBOL>              — Get real-time quote
 *   bars <SYMBOL> [timeframe]   — Get price bars (default: 1Hour)
 *   search <QUERY>              — Search for tradable assets
 *   buy <SYMBOL> <QTY> [limit]  — Place a buy order (market or limit)
 *   sell <SYMBOL> <QTY> [limit] — Place a sell order (market or limit)
 *   cancel <ORDER_ID>           — Cancel an order
 *   risk                        — Show risk metrics
 *   risk-check <SYMBOL> <QTY> <SIDE> [price] — Pre-trade risk validation
 *   analyze <SYMBOL>            — Claude AI analysis (requires CLAUDE_API_KEY env)
 *   history [period]            — Portfolio history (1D, 1W, 1M, 3M, 1Y)
 */

import Alpaca from '@alpacahq/alpaca-trade-api';
import {
  validateOrder,
  checkDailyLoss,
  checkDrawdown,
  checkPositionConcentration,
  getDefaultRiskConfig,
} from './src/main/risk-engine';
import {
  analyzePosition,
  buildAnalysisPrompt,
  parseAnalysisResponse,
} from './src/main/claude-analyzer';

const ALPACA_KEY_ID = process.env.ALPACA_KEY_ID;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

if (!ALPACA_KEY_ID || !ALPACA_SECRET_KEY) {
  console.error('Missing ALPACA_KEY_ID or ALPACA_SECRET_KEY environment variables.');
  console.error('Set them: export ALPACA_KEY_ID=PK... ALPACA_SECRET_KEY=SK...');
  process.exit(1);
}

const LIVE_MODE = process.env.ALPACA_LIVE === 'true';

if (LIVE_MODE) {
  console.warn('*** LIVE TRADING MODE — real money at risk ***\n');
}

const alpaca = new Alpaca({
  keyId: ALPACA_KEY_ID,
  secretKey: ALPACA_SECRET_KEY,
  paper: !LIVE_MODE,
  baseUrl: LIVE_MODE ? 'https://api.alpaca.markets' : 'https://paper-api.alpaca.markets',
});

function fmt(n: string | number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(typeof n === 'string' ? parseFloat(n) : n);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.log('Usage: npx tsx cli.ts <command> [args...]');
    console.log('Commands: account, positions, orders, quote, bars, search, buy, sell, cancel, risk, risk-check, analyze, history');
    return;
  }

  switch (command) {
    case 'account': {
      const acc = await alpaca.getAccount();
      console.log(`Portfolio Value: ${fmt(acc.portfolio_value)}`);
      console.log(`Equity:          ${fmt(acc.equity)}`);
      console.log(`Cash:            ${fmt(acc.cash)}`);
      console.log(`Buying Power:    ${fmt(acc.buying_power)}`);
      console.log(`Last Equity:     ${fmt(acc.last_equity)}`);
      const dailyPL = parseFloat(acc.equity) - parseFloat(acc.last_equity);
      console.log(`Daily P&L:       ${dailyPL >= 0 ? '+' : ''}${fmt(dailyPL)} (${pct(dailyPL / parseFloat(acc.last_equity))})`);
      console.log(`Day Trades:      ${acc.daytrade_count}`);
      console.log(`PDT:             ${acc.pattern_day_trader ? 'YES' : 'No'}`);
      break;
    }

    case 'positions': {
      const positions = await alpaca.getPositions();
      if (positions.length === 0) {
        console.log('No open positions.');
        return;
      }
      console.log('Symbol   Qty   Avg Entry   Current     Mkt Value    P&L         P&L %');
      console.log('------   ---   ---------   -------     ---------    ---         -----');
      for (const p of positions) {
        const pl = parseFloat(p.unrealized_pl);
        const plPct = (parseFloat(p.unrealized_plpc) * 100).toFixed(2);
        console.log(
          `${p.symbol.padEnd(8)} ${p.qty.padStart(3)}   ${fmt(p.avg_entry_price).padStart(9)}   ${fmt(p.current_price).padStart(9)}   ${fmt(p.market_value).padStart(11)}  ${(pl >= 0 ? '+' : '') + fmt(pl).padStart(10)}  ${plPct}%`
        );
      }
      break;
    }

    case 'orders': {
      const orders = await alpaca.getOrders({ status: 'all', limit: 15, direction: 'desc' });
      if (orders.length === 0) {
        console.log('No recent orders.');
        return;
      }
      console.log('Symbol   Side   Qty   Type     Status    Fill Price   Submitted');
      console.log('------   ----   ---   ----     ------    ----------   ---------');
      for (const o of orders) {
        const fill = o.filled_avg_price ? fmt(o.filled_avg_price) : '—';
        const time = new Date(o.submitted_at).toLocaleString();
        console.log(
          `${o.symbol.padEnd(8)} ${o.side.padEnd(6)} ${String(o.qty).padStart(3)}   ${o.type.padEnd(8)} ${o.status.padEnd(9)} ${fill.padStart(12)}   ${time}`
        );
      }
      break;
    }

    case 'quote': {
      const symbol = args[0]?.toUpperCase();
      if (!symbol) { console.error('Usage: quote <SYMBOL>'); return; }
      const snap = await alpaca.getSnapshot(symbol);
      console.log(`${symbol} Quote:`);
      if (snap.latestTrade) {
        console.log(`  Last:  ${fmt(snap.latestTrade.Price)} (${snap.latestTrade.Size} shares)`);
      }
      if (snap.latestQuote) {
        console.log(`  Bid:   ${fmt(snap.latestQuote.BidPrice)} x ${snap.latestQuote.BidSize}`);
        console.log(`  Ask:   ${fmt(snap.latestQuote.AskPrice)} x ${snap.latestQuote.AskSize}`);
      }
      if (snap.dailyBar) {
        console.log(`  Open:  ${fmt(snap.dailyBar.OpenPrice)}`);
        console.log(`  High:  ${fmt(snap.dailyBar.HighPrice)}`);
        console.log(`  Low:   ${fmt(snap.dailyBar.LowPrice)}`);
        console.log(`  Vol:   ${snap.dailyBar.Volume.toLocaleString()}`);
      }
      break;
    }

    case 'bars': {
      const symbol = args[0]?.toUpperCase();
      const timeframe = args[1] || '1Hour';
      if (!symbol) { console.error('Usage: bars <SYMBOL> [timeframe]'); return; }
      const bars: any[] = [];
      const iter = alpaca.getBarsV2(symbol, { timeframe, limit: 20 });
      for await (const bar of iter) bars.push(bar);
      console.log(`${symbol} — Last ${bars.length} bars (${timeframe}):`);
      console.log('Time                  Open      High      Low       Close     Volume');
      for (const b of bars) {
        const t = new Date(b.Timestamp).toLocaleString();
        console.log(`${t.padEnd(21)} ${fmt(b.OpenPrice).padStart(9)} ${fmt(b.HighPrice).padStart(9)} ${fmt(b.LowPrice).padStart(9)} ${fmt(b.ClosePrice).padStart(9)} ${String(b.Volume).padStart(9)}`);
      }
      break;
    }

    case 'search': {
      const query = args[0];
      if (!query) { console.error('Usage: search <QUERY>'); return; }
      const assets = await alpaca.getAssets({ status: 'active', search: query });
      const tradable = assets.filter((a: any) => a.tradable).slice(0, 15);
      if (tradable.length === 0) { console.log('No results.'); return; }
      console.log('Symbol   Name                                    Exchange');
      for (const a of tradable) {
        console.log(`${a.symbol.padEnd(8)} ${a.name.slice(0, 40).padEnd(40)} ${a.exchange}`);
      }
      break;
    }

    case 'buy':
    case 'sell': {
      const symbol = args[0]?.toUpperCase();
      const qty = parseInt(args[1]);
      const limitPrice = args[2] ? parseFloat(args[2]) : undefined;
      if (!symbol || !qty) { console.error(`Usage: ${command} <SYMBOL> <QTY> [limit_price]`); return; }

      // Pre-trade risk check
      const acc = await alpaca.getAccount();
      const positions = await alpaca.getPositions();
      const snap = await alpaca.getSnapshot(symbol);
      const price = limitPrice || snap.latestTrade?.Price || 0;
      const config = getDefaultRiskConfig();

      const orderInput = {
        symbol, qty, side: command,
        type: limitPrice ? 'limit' : 'market',
        time_in_force: 'day',
        limit_price: limitPrice,
      };

      const riskCheck = validateOrder(orderInput, acc, positions, price, config);

      if (riskCheck.warnings.length > 0) {
        console.log('⚠ Warnings:');
        riskCheck.warnings.forEach(w => console.log(`  ${w}`));
      }

      if (!riskCheck.allowed) {
        console.log('BLOCKED by risk engine:');
        riskCheck.errors.forEach(e => console.log(`  ${e}`));
        if (riskCheck.suggestedQty !== undefined) {
          console.log(`Suggested qty: ${riskCheck.suggestedQty}`);
        }
        return;
      }

      console.log(`Placing ${command.toUpperCase()} ${qty} ${symbol} @ ${limitPrice ? fmt(limitPrice) + ' limit' : 'market'}...`);
      const order = await alpaca.createOrder(orderInput);
      console.log(`Order ${order.id} — ${order.status}`);
      console.log(`  Type: ${order.type}, TIF: ${order.time_in_force}`);
      if (order.filled_avg_price) console.log(`  Filled at: ${fmt(order.filled_avg_price)}`);
      break;
    }

    case 'cancel': {
      const orderId = args[0];
      if (!orderId) { console.error('Usage: cancel <ORDER_ID>'); return; }
      await alpaca.cancelOrder(orderId);
      console.log(`Order ${orderId} cancelled.`);
      break;
    }

    case 'risk': {
      const acc = await alpaca.getAccount();
      const positions = await alpaca.getPositions();
      const config = getDefaultRiskConfig();
      const portfolioValue = parseFloat(acc.portfolio_value);

      console.log('=== Risk Dashboard ===');
      console.log();

      // Daily loss
      const daily = checkDailyLoss({ equity: acc.equity, last_equity: acc.last_equity });
      console.log(`Daily P&L:    ${daily.lossPercent > 0 ? '-' : ''}${pct(daily.lossPercent)} ${daily.halted ? '*** HALTED ***' : `(limit: ${pct(config.dailyLossLimitPct)})`}`);

      // Drawdown (using last_equity as proxy for peak)
      const peak = Math.max(parseFloat(acc.last_equity), parseFloat(acc.equity));
      const dd = checkDrawdown(peak, parseFloat(acc.equity));
      console.log(`Drawdown:     ${pct(dd.percent)} [${dd.level.toUpperCase()}] (kill: ${pct(config.maxDrawdownPct)})`);

      console.log();
      console.log('Position Concentration:');
      if (positions.length === 0) {
        console.log('  No positions.');
      } else {
        for (const p of positions) {
          const conc = checkPositionConcentration(parseFloat(p.market_value), portfolioValue, config);
          console.log(`  ${p.symbol.padEnd(6)} ${pct(conc.percent).padStart(7)} ${conc.ok ? '' : '*** OVER LIMIT ***'}`);
        }
      }

      console.log();
      console.log('Limits:');
      console.log(`  Max per trade:   ${pct(config.maxCapitalPerTradePct)} = ${fmt(portfolioValue * config.maxCapitalPerTradePct)}`);
      console.log(`  Max position:    ${pct(config.maxPositionPct)} = ${fmt(portfolioValue * config.maxPositionPct)}`);
      console.log(`  Daily loss halt: ${pct(config.dailyLossLimitPct)}`);
      console.log(`  Kill switch:     ${pct(config.maxDrawdownPct)}`);
      break;
    }

    case 'risk-check': {
      const symbol = args[0]?.toUpperCase();
      const qty = parseInt(args[1]);
      const side = args[2] || 'buy';
      const price = args[3] ? parseFloat(args[3]) : undefined;

      if (!symbol || !qty) { console.error('Usage: risk-check <SYMBOL> <QTY> <SIDE> [price]'); return; }

      const acc = await alpaca.getAccount();
      const positions = await alpaca.getPositions();
      const snap = await alpaca.getSnapshot(symbol);
      const currentPrice = price || snap.latestTrade?.Price || 0;
      const config = getDefaultRiskConfig();

      const check = validateOrder(
        { symbol, qty, side, type: 'market', time_in_force: 'day' },
        acc, positions, currentPrice, config
      );

      console.log(`Risk check: ${side.toUpperCase()} ${qty} ${symbol} @ ${fmt(currentPrice)}`);
      console.log(`Order value: ${fmt(qty * currentPrice)}`);
      console.log(`Allowed: ${check.allowed ? 'YES' : 'NO'}`);
      if (check.warnings.length > 0) check.warnings.forEach(w => console.log(`  Warning: ${w}`));
      if (check.errors.length > 0) check.errors.forEach(e => console.log(`  Error: ${e}`));
      if (check.suggestedQty !== undefined) console.log(`  Suggested qty: ${check.suggestedQty}`);
      break;
    }

    case 'analyze': {
      const symbol = args[0]?.toUpperCase();
      if (!symbol) { console.error('Usage: analyze <SYMBOL>'); return; }
      if (!CLAUDE_API_KEY) {
        console.error('Set CLAUDE_API_KEY env var for AI analysis.');
        return;
      }

      console.log(`Analyzing ${symbol}...`);
      const acc = await alpaca.getAccount();
      const positions = await alpaca.getPositions();
      const position = positions.find((p: any) => p.symbol === symbol) || null;

      const bars: any[] = [];
      const iter = alpaca.getBarsV2(symbol, { timeframe: '1Hour', limit: 20 });
      for await (const bar of iter) {
        bars.push({ t: bar.Timestamp, o: bar.OpenPrice, h: bar.HighPrice, l: bar.LowPrice, c: bar.ClosePrice, v: bar.Volume });
      }

      const result = await analyzePosition(
        CLAUDE_API_KEY,
        symbol,
        position ? { qty: position.qty, avg_entry_price: position.avg_entry_price, current_price: position.current_price, unrealized_pl: position.unrealized_pl, side: position.side } : null,
        { portfolio_value: acc.portfolio_value, equity: acc.equity, cash: acc.cash },
        bars
      );

      console.log();
      console.log(`=== ${symbol} Analysis ===`);
      console.log(`Recommendation: ${result.recommendation.toUpperCase()}`);
      console.log(`Confidence:     ${result.confidence}`);
      console.log(`Timeframe:      ${result.timeframe}`);
      console.log(`Reasoning:      ${result.reasoning}`);
      if (result.risks.length > 0) {
        console.log('Risks:');
        result.risks.forEach(r => console.log(`  - ${r}`));
      }
      break;
    }

    case 'history': {
      const period = args[0] || '1M';
      const tfMap: Record<string, string> = { '1D': '5Min', '1W': '15Min', '1M': '1D', '3M': '1D', '1Y': '1D' };
      const history = await alpaca.getPortfolioHistory({ period, timeframe: tfMap[period] || '1D' });

      console.log(`Portfolio History (${period}):`);
      console.log('Date          Equity         P&L');
      for (let i = 0; i < history.timestamp.length; i++) {
        const date = new Date(history.timestamp[i] * 1000).toLocaleDateString();
        const eq = fmt(history.equity[i]);
        const pl = history.profit_loss[i];
        console.log(`${date.padEnd(13)} ${eq.padStart(14)}  ${(pl >= 0 ? '+' : '') + fmt(pl)}`);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.log('Commands: account, positions, orders, quote, bars, search, buy, sell, cancel, risk, risk-check, analyze, history');
  }
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
