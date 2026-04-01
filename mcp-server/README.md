# Investing Agent MCP Server

Use your Alpaca paper trading account directly from Claude Code. Place trades, check positions, run risk analysis, and get AI-powered trade recommendations — all through natural language.

## What You Get

13 tools available to Claude:

| Tool | What it does |
|------|-------------|
| `get_account` | Portfolio value, equity, cash, buying power |
| `get_positions` | Open positions with P&L |
| `get_orders` | Recent order history |
| `get_quote` | Real-time price quote |
| `get_bars` | OHLCV price bars for technical analysis |
| `search_assets` | Search tradable stocks by name/ticker |
| `buy` | Buy shares (with automatic risk validation) |
| `sell` | Sell shares |
| `cancel_order` | Cancel a pending order |
| `risk_check` | Pre-trade risk validation without placing an order |
| `risk_status` | Current risk dashboard (drawdown, daily loss, concentration) |
| `analyze` | Claude AI trade analysis with buy/sell/hold recommendation |
| `portfolio_history` | Portfolio equity over time |

## Setup (2 minutes)

### 1. Clone and install

```bash
git clone https://github.com/JoseLugo-AI/investing-agent.git
cd investing-agent
npm install
```

### 2. Get Alpaca API keys

1. Sign up at [alpaca.markets](https://alpaca.markets) (free)
2. Go to [Paper Trading Dashboard](https://app.alpaca.markets/paper/dashboard/overview)
3. Click "API Keys" > "Generate New Key"
4. Save your Key ID and Secret Key

### 3. Add to Claude Code

Add this to your Claude Code MCP settings (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "investing-agent": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/investing-agent/mcp-server/index.ts"],
      "env": {
        "ALPACA_KEY_ID": "your-key-id",
        "ALPACA_SECRET_KEY": "your-secret-key",
        "CLAUDE_API_KEY": "your-anthropic-key"
      }
    }
  }
}
```

Replace `/absolute/path/to/investing-agent` with the actual path where you cloned the repo.

`CLAUDE_API_KEY` is optional — only needed for the `analyze` tool.

### 4. Use it

Restart Claude Code, then just talk to it:

```
> "What's my portfolio looking like?"
> "Buy 5 shares of AAPL"
> "Run a risk check on buying 10 shares of NVDA at $140"
> "Analyze MSFT for me"
> "Show me the daily bars for GOOGL"
> "What's my drawdown at?"
```

## Risk Engine

Every buy order goes through the risk engine automatically. If a trade violates any limit, it's blocked before it reaches Alpaca:

- **2% max capital per trade** — limits single-trade exposure
- **3% daily loss halt** — stops all buying for the day
- **20% max drawdown kill switch** — kills trading entirely
- **3% single position limit** — prevents overconcentration

When a trade is blocked, Claude will tell you why and suggest a safe quantity.

## Paper Trading Only

This connects to Alpaca's **paper trading** environment. No real money is involved. Your account starts with $100K in virtual funds.

## Troubleshooting

**"Missing ALPACA_KEY_ID or ALPACA_SECRET_KEY"**
Check your MCP config — the env vars need to be in the `env` block, not shell exports.

**"CLAUDE_API_KEY not set"**
The `analyze` tool needs an Anthropic API key. All other tools work without it.

**Tools not showing up in Claude Code**
Make sure the path in `args` is absolute, not relative. Run `npx tsx /your/path/mcp-server/index.ts` manually to check for errors.
