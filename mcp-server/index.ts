#!/usr/bin/env node
/**
 * Investing Agent MCP Server
 *
 * Exposes paper trading tools (Alpaca) + risk engine + Claude AI analysis
 * as an MCP server for Claude Code integration.
 *
 * Usage:
 *   ALPACA_KEY_ID=PK... ALPACA_SECRET_KEY=SK... npx tsx mcp-server/index.ts
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createAlpacaClient, AlpacaClient } from '../src/main/alpaca-client';
import { validateOrder, checkDailyLoss, checkDrawdown, getDefaultRiskConfig } from '../src/main/risk-engine';
import { analyzePosition } from '../src/main/claude-analyzer';

// --- Init ---

const keyId = process.env.ALPACA_KEY_ID;
const secretKey = process.env.ALPACA_SECRET_KEY;
const claudeKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';

if (!keyId || !secretKey) {
  console.error('Missing ALPACA_KEY_ID or ALPACA_SECRET_KEY environment variables.');
  process.exit(1);
}

const client: AlpacaClient = createAlpacaClient(keyId, secretKey);

// --- Tool definitions ---

const TOOLS = [
  {
    name: 'get_account',
    description: 'Get paper trading account summary: portfolio value, equity, cash, buying power, daily P&L, day trade count.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_positions',
    description: 'List all open positions with symbol, quantity, average entry price, current price, market value, and unrealized P&L.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_orders',
    description: 'List recent orders (up to 20) with symbol, side, quantity, type, status, fill price, and submission time.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_quote',
    description: 'Get real-time quote for a symbol including last price, bid, and ask.',
    inputSchema: {
      type: 'object' as const,
      properties: { symbol: { type: 'string', description: 'Ticker symbol (e.g. AAPL, NVDA)' } },
      required: ['symbol'],
    },
  },
  {
    name: 'get_bars',
    description: 'Get price bars (OHLCV) for a symbol. Useful for technical analysis.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol' },
        timeframe: { type: 'string', description: 'Bar timeframe: 1Min, 5Min, 15Min, 1Hour, 1Day. Default: 1Day', default: '1Day' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'search_assets',
    description: 'Search for tradable assets by name or symbol. Returns up to 10 matches.',
    inputSchema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Search query (company name or ticker)' } },
      required: ['query'],
    },
  },
  {
    name: 'buy',
    description: 'Place a buy order. Uses market order by default, or limit order if limit_price is provided. All orders go through the risk engine first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol to buy' },
        qty: { type: 'number', description: 'Number of shares' },
        limit_price: { type: 'number', description: 'Limit price (optional — omit for market order)' },
        time_in_force: { type: 'string', description: 'day or gtc (default: day)', default: 'day' },
      },
      required: ['symbol', 'qty'],
    },
  },
  {
    name: 'sell',
    description: 'Place a sell order. Uses market order by default, or limit order if limit_price is provided.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol to sell' },
        qty: { type: 'number', description: 'Number of shares' },
        limit_price: { type: 'number', description: 'Limit price (optional — omit for market order)' },
        time_in_force: { type: 'string', description: 'day or gtc (default: day)', default: 'day' },
      },
      required: ['symbol', 'qty'],
    },
  },
  {
    name: 'cancel_order',
    description: 'Cancel a pending order by its order ID.',
    inputSchema: {
      type: 'object' as const,
      properties: { order_id: { type: 'string', description: 'The order ID to cancel' } },
      required: ['order_id'],
    },
  },
  {
    name: 'risk_check',
    description: 'Run pre-trade risk validation without placing an order. Checks daily loss limits, drawdown, position concentration, and buying power.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol' },
        qty: { type: 'number', description: 'Quantity' },
        side: { type: 'string', description: 'buy or sell' },
        price: { type: 'number', description: 'Current price per share (for risk calculations)' },
      },
      required: ['symbol', 'qty', 'side', 'price'],
    },
  },
  {
    name: 'risk_status',
    description: 'Get current risk dashboard: daily loss %, drawdown level, largest position concentration, and whether trading is halted.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'analyze',
    description: 'Get AI-powered trade analysis for a symbol using Claude. Provides buy/sell/hold recommendation, confidence level, reasoning, risks, and suggested timeframe. Requires CLAUDE_API_KEY.',
    inputSchema: {
      type: 'object' as const,
      properties: { symbol: { type: 'string', description: 'Ticker symbol to analyze' } },
      required: ['symbol'],
    },
  },
  {
    name: 'portfolio_history',
    description: 'Get portfolio equity history over time.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: { type: 'string', description: 'Time period: 1D, 1W, 1M, 3M, 1Y. Default: 1M', default: '1M' },
        timeframe: { type: 'string', description: 'Data resolution: 5Min, 15Min, 1H, 1D. Default: 1D', default: '1D' },
      },
    },
  },
];

// --- Tool handlers ---

async function handleTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_account':
      return JSON.stringify(await client.getAccount(), null, 2);

    case 'get_positions':
      return JSON.stringify(await client.getPositions(), null, 2);

    case 'get_orders':
      return JSON.stringify(await client.getOrders(), null, 2);

    case 'get_quote':
      return JSON.stringify(await client.getQuote(args.symbol as string), null, 2);

    case 'get_bars':
      return JSON.stringify(await client.getBars(args.symbol as string, (args.timeframe as string) || '1Day'), null, 2);

    case 'search_assets':
      return JSON.stringify(await client.searchAssets(args.query as string), null, 2);

    case 'buy':
    case 'sell': {
      const side = name;
      const symbol = args.symbol as string;
      const qty = args.qty as number;
      const limitPrice = args.limit_price as number | undefined;
      const tif = (args.time_in_force as string) || 'day';

      // Risk check before placing order
      const quote = await client.getQuote(symbol);
      const price = limitPrice || quote?.latestTrade?.p || quote?.last?.price || 0;
      const [account, positions] = await Promise.all([client.getAccount(), client.getPositions()]);

      const order = {
        symbol,
        qty,
        side,
        type: limitPrice ? 'limit' : 'market',
        time_in_force: tif,
        limit_price: limitPrice,
      };

      if (side === 'buy') {
        const riskCheck = validateOrder(order, account, positions, price, getDefaultRiskConfig());
        if (!riskCheck.allowed) {
          return JSON.stringify({
            blocked: true,
            errors: riskCheck.errors,
            warnings: riskCheck.warnings,
            suggestedQty: riskCheck.suggestedQty,
          }, null, 2);
        }
        if (riskCheck.warnings.length > 0) {
          // Proceed but include warnings
          const result = await client.createOrder(order);
          return JSON.stringify({ order: result, warnings: riskCheck.warnings }, null, 2);
        }
      }

      const result = await client.createOrder(order);
      return JSON.stringify(result, null, 2);
    }

    case 'cancel_order':
      await client.cancelOrder(args.order_id as string);
      return JSON.stringify({ success: true, message: `Order ${args.order_id} cancelled.` });

    case 'risk_check': {
      const [acct, pos] = await Promise.all([client.getAccount(), client.getPositions()]);
      const check = validateOrder(
        { symbol: args.symbol as string, qty: args.qty as number, side: args.side as string, type: 'market', time_in_force: 'day' },
        acct, pos, args.price as number, getDefaultRiskConfig()
      );
      return JSON.stringify(check, null, 2);
    }

    case 'risk_status': {
      const [acct, pos] = await Promise.all([client.getAccount(), client.getPositions()]);
      const portfolioValue = parseFloat(acct.portfolio_value);
      const daily = checkDailyLoss(acct);
      const peakEquity = Math.max(parseFloat(acct.equity), parseFloat(acct.last_equity));
      const dd = checkDrawdown(peakEquity, parseFloat(acct.equity));
      const largestPosition = pos.reduce((max: number, p: any) =>
        Math.max(max, parseFloat(p.market_value || '0')), 0);
      return JSON.stringify({
        dailyLossPercent: (daily.lossPercent * 100).toFixed(2) + '%',
        dailyLossHalted: daily.halted,
        drawdownPercent: (dd.percent * 100).toFixed(2) + '%',
        drawdownLevel: dd.level,
        largestPositionPercent: portfolioValue > 0 ? ((largestPosition / portfolioValue) * 100).toFixed(2) + '%' : '0%',
        positionCount: pos.length,
        portfolioValue: `$${portfolioValue.toLocaleString()}`,
      }, null, 2);
    }

    case 'analyze': {
      if (!claudeKey) throw new Error('CLAUDE_API_KEY or ANTHROPIC_API_KEY not set. AI analysis unavailable.');
      const [acct, pos, bars] = await Promise.all([
        client.getAccount(),
        client.getPositions(),
        client.getBars(args.symbol as string, '1Day', 20),
      ]);
      const position = pos.find((p: any) => p.symbol === args.symbol) || null;
      const result = await analyzePosition(claudeKey, args.symbol as string, position, acct, bars);
      return JSON.stringify(result, null, 2);
    }

    case 'portfolio_history': {
      const period = (args.period as string) || '1M';
      const timeframe = (args.timeframe as string) || '1D';
      return JSON.stringify(await client.getPortfolioHistory(period, timeframe), null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// --- Server setup ---

const server = new Server(
  { name: 'investing-agent', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await handleTool(request.params.name, (request.params.arguments || {}) as Record<string, unknown>);
    return { content: [{ type: 'text', text: result }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP server error:', error);
  process.exit(1);
});
