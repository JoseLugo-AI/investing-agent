# AI Trading Agent Strategy Research
**Date:** 2026-04-02  
**Status:** Research complete — actionable findings for implementation

---

## Executive Summary

After extensive research across academic papers, open-source frameworks, and documented trading results, here is what actually works, what is theoretical, and what gives an LLM-based agent a real edge.

**The honest truth:** Most active strategies underperform buy-and-hold S&P 500. Only 9-14% of professional fund managers beat the index over 10-20 years. The strategies below are the documented exceptions — but none are guaranteed.

---

## 1. AI Trading Agent Frameworks with Documented Results

### TradingAgents (TauricResearch) — Multi-Agent LLM Framework
- **Architecture:** Fundamental analyst, sentiment analyst, news analyst, technical analyst, bull/bear researchers (debate), trader agent, risk management team, portfolio manager
- **Claimed returns:** Up to 30.5% annualized
- **Data sources:** Stock prices, news, social media sentiment, insider transactions, SEC filings, earnings calls
- **Evaluation period:** Jan-Mar 2024 (training), Jun-Nov 2024 (trading)
- **LLM support:** Claude 4.x, GPT-5.x, Gemini 3.x (configurable)
- **Status:** Open source, v0.2.3 (Mar 2026)
- **CAVEAT:** GitHub issues flag look-ahead bias concerns in backtesting. Framework is "for research purposes" per their disclaimer.
- **Source:** [github.com/TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents), [arXiv:2412.20138](https://arxiv.org/abs/2412.20138)

### MarketSenseAI 2.0 — Best Documented LLM Trading Results
- **Architecture:** RAG + LLM agents processing SEC filings, earnings calls, news, fundamentals, macro reports
- **Results on S&P 100 (Jan 2023 - Dec 2024):**
  - Market-cap weighted: **125.9% cumulative return** vs 73.5% S&P 100 index
  - Equal weighted: **55.7%** vs 42.3% equal-weighted S&P 100
- **Method:** Chain-of-Agents (CoA) for large financial documents, HyDE-based retrieval for macro context
- **Key insight:** Not high-frequency trading — monthly stock selection/rebalancing
- **PROVEN:** This is the strongest documented evidence of LLM agents beating the market
- **Source:** [arXiv:2502.00415](https://arxiv.org/abs/2502.00415)

### FinMem — Layered Memory LLM Agent
- **Architecture:** Profiling module, layered memory (short/mid/long term), decision-making module
- **Results:** Outperforms buy-and-hold, FinGPT, and DRL agents on AMZN, COIN with positive cumulative returns and superior Sharpe ratios
- **Key innovation:** Adjustable "cognitive span" — how far back the agent remembers affects performance
- **Published:** ICLR Workshop LLM Agents 2024, IEEE
- **Source:** [arXiv:2311.13743](https://arxiv.org/abs/2311.13743)

### FINCON — NeurIPS 2024
- **Architecture:** Manager-analyst hierarchy mimicking investment firms, conceptual verbal reinforcement
- **Results:** 57% cumulative return, Sharpe ratio 0.825
- **Strength:** Works across bull (GOOG, MSFT), bear (NIO), and mixed (TSLA) conditions
- **Lower max drawdown than competitors**
- **Source:** [NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/hash/f7ae4fe91d96f50abc2211f09b6a7e49-Abstract-Conference.html)

### AI-Trader Benchmark (HKUDS) — Reality Check
- **What it is:** First fully-automated, live, data-uncontaminated evaluation benchmark
- **Key finding:** "General intelligence does not automatically translate to effective trading capability" — most LLM agents showed poor returns and weak risk management in truly live conditions
- **Risk control capability determines cross-market robustness**
- **More success in highly liquid markets than policy-driven ones**
- **Source:** [arXiv:2512.10971](https://arxiv.org/abs/2512.10971), [ai4trade.ai](https://ai4trade.ai)

### FinRL / FinRL-X — Reinforcement Learning Framework
- **Architecture:** DRL agents (A2C, DDPG, PPO, SAC, TD3) for portfolio allocation
- **Mature ecosystem:** Production-oriented FinRL-X with Alpaca integration, risk controls
- **Not LLM-based** but proven DRL approach for position sizing and timing
- **Source:** [github.com/AI4Finance-Foundation/FinRL](https://github.com/AI4Finance-Foundation/FinRL)

---

## 2. Quantitative Strategies with Proven Track Records

### Momentum (PROVEN — decades of evidence)
- **Method:** Go long the top 20% performers over last 6-12 months, rebalance monthly
- **Evidence:** Discovered in early 1990s, still works post-discovery
- **Win rate:** 40-50% (relies on big wins, not frequency)
- **Edge:** Behavioral — investors underreact to positive information
- **Best implementation:** 6-month lookback, monthly rebalance, skip the most recent month (short-term reversal effect)
- **Risk:** Momentum crashes hard in regime changes (2009, 2020 March)

### Mean Reversion (PROVEN — in specific conditions)
- **Win rate:** 60-70% (many small wins, occasional large loss)
- **Best for:** Range-bound markets, high-liquidity equities with low news flow
- **Algorithms:** CWMR (Confidence Weighted Mean Reversion), PAMR (Passive-Aggressive Mean Reversion) achieve high Sharpe ratios
- **Risk:** Gets destroyed during regime changes and trending markets

### Combined Momentum + Mean Reversion (BEST APPROACH)
- **Key insight:** Use regime detection to switch between strategies
- **Trending market → momentum strategy**
- **Range-bound market → mean reversion strategy**
- **This is where the LLM agent adds real value — detecting which regime we are in**

### Factor Investing (PROVEN — long-term)
- **Size + Value factors:** Consistently outperform S&P 500 when applied within it
- **Quality factor:** Low debt, high ROE, stable earnings — provides downside protection
- **Implementation:** Screen for factors, weight by conviction, rebalance quarterly

---

## 3. Technical Indicator Combinations That Outperform

### Tier 1: Highest documented win rates

| Combination | Win Rate | Avg Return/Trade | Notes |
|---|---|---|---|
| RSI + MACD | 77% | ~5% | Best two-indicator combo |
| MACD + Bollinger Bands | 78% | 1.4% after costs | High win rate, smaller gains |
| RSI + MACD + Bollinger Bands | 73-77% | 6.1% | Triple confirmation reduces false signals |
| RSI + MACD + Volume | 74% | 6.1% | Volume as confirmation layer |

### Tier 2: Specific parameters that work

**RSI Settings:**
- Period: 14 (standard)
- Oversold: < 30 (buy signal)
- Overbought: > 70 (sell signal)
- Better: Use RSI < 40 for momentum entries (less oversold but trending up)

**MACD Settings:**
- Fast: 12, Slow: 26, Signal: 9 (standard)
- Crossover + histogram direction for confirmation

**Bollinger Bands:**
- Period: 20, StdDev: 2.0 (standard)
- Mean reversion: Buy at lower band, sell at upper band
- Breakout: Buy on close above upper band with volume

**ATR (Average True Range) — Critical for position sizing:**
- Period: 14 for swing trading
- Stop loss: 2x ATR below entry
- Position size = (Account risk $) / (2x ATR)
- Trailing stop: Chandelier Exit = Highest High(22) - 3x ATR(22)

### Individual indicators alone: 40-60% win rate. Combined: 73-78%.

---

## 4. LLM-Specific Advantages Over Traditional Quant

### What an LLM can do that traditional quant cannot:

**A. Sentiment Analysis from News (STRONGEST EVIDENCE)**
- Study of 965,375 US financial news articles (2010-2023)
- LLM sentiment prediction accuracy: **74.4%** (vs 50.1% for dictionary-based)
- Long-short strategy based on LLM sentiment: **Sharpe ratio 3.05**
- Aug 2021 - Jul 2023: **355% gain** from sentiment-based long-short
- This is the single strongest documented LLM edge
- **Source:** [Sentiment trading with large language models](https://arxiv.org/abs/2412.19245)

**B. Earnings Call Analysis (DOCUMENTED ALPHA)**
- LLMs extract communication style features from earnings calls
- "Proactive & On Topic" executives: **+247 basis points alpha annualized**
- "Reactive & Off Topic" executives: **-256 basis points alpha**
- Captures forward-looking guidance, managerial tone, strategic outlook
- Not available from numerical data alone
- **Source:** [Alexandria Technology](https://www.alexandriatechnology.com/sec-filings)

**C. SEC Filing Parsing**
- 10-Q, 10-K reports contain buried risk factors, footnotes, disclosure changes
- LLMs can detect subtle changes in language between filings (risk escalation signals)
- Traditional quant ignores these entirely

**D. Multi-Source Synthesis**
- LLMs combine price data + news + filings + macro reports + social sentiment into a unified assessment
- This "holistic analysis" is what MarketSenseAI 2.0 does and it beat the S&P 100 by 52%

**E. Regime Detection via Narrative**
- LLMs can read Fed minutes, FOMC statements, economic reports
- Detect policy shifts before they show up in price data
- Traditional quant only sees numbers; LLMs see the story

---

## 5. What Actually Beats Buy-and-Hold S&P 500

### The honest answer: Very few things, consistently.

**What works:**
1. **LLM-based stock selection with monthly rebalancing** — MarketSenseAI proved this (125.9% vs 73.5%)
2. **Momentum with regime awareness** — avoid momentum during crashes
3. **Letting winners run** — Morningstar found that buying a basket and never trimming winners beat the S&P 500 over 30 years
4. **Factor-based approaches** — size + value within S&P 500
5. **Sentiment-driven long-short** — 355% gain documented, Sharpe 3.05

**What does NOT work:**
1. Overtrading — frequency kills returns via costs and mistiming
2. Constant rebalancing — trimming winners is the #1 mistake
3. Pure technical analysis without context — indicators alone are coin flips
4. Trying to time the market short-term — even AI agents mostly fail at this (AI-Trader benchmark)

### The realistic edge for your agent:
- **Stock SELECTION, not timing** — pick better stocks, hold longer
- **Sentiment as a filter** — only buy when LLM sentiment is positive, only sell when negative
- **Risk management as the differentiator** — the AI-Trader benchmark showed risk control is what separates winners from losers

---

## 6. Risk-Adjusted Returns — What Good Looks Like

| Metric | Poor | Acceptable | Good | Excellent |
|---|---|---|---|---|
| Sharpe Ratio | < 0.5 | 0.5 - 1.0 | 1.0 - 2.0 | > 2.0 |
| Max Drawdown | > 30% | 15-30% | 10-15% | < 10% |
| Win Rate | < 45% | 45-55% | 55-65% | > 65% |
| Profit Factor | < 1.0 | 1.0-1.5 | 1.5-2.5 | > 2.5 |
| Annual Return | < SPY | SPY +2-5% | SPY +5-15% | SPY +15%+ |

### Target for your agent:
- **Sharpe Ratio > 1.0** (risk-adjusted, after costs)
- **Max Drawdown < 20%** (survivable)
- **Win Rate > 55%** (with proper position sizing, this compounds)
- **Beat SPY by 5-10% annually** (realistic, not fantasy)

---

## 7. Position Sizing and Portfolio Management

### Kelly Criterion — The Math

```
Kelly % = W - [(1 - W) / R]

Where:
W = Win probability (e.g., 0.60)
R = Win/Loss ratio (e.g., 1.5)
```

**Example:** 60% win rate, 1.5:1 reward/risk = Kelly says bet 33% of capital

### In Practice: Use FRACTIONAL Kelly

- **Full Kelly:** Maximum growth but 50-70% drawdowns during losing streaks. No one can stomach this.
- **Half Kelly:** ~75% of full Kelly's growth rate but dramatically lower drawdowns. This is what professionals use.
- **Quarter Kelly:** Very conservative, still beats most approaches.
- **CFA recommendation:** Never risk more than 2% of capital on a single trade.

### Position Sizing Formula (ATR-Based)
```
Position Size = (Account * Risk%) / (Entry - Stop Loss)
Stop Loss = Entry - (2 * ATR(14))
Risk% = 1-2% of account per trade (quarter to half Kelly)
```

### Portfolio Approaches — What the Evidence Says

| Approach | Annualized Return | Volatility | Sharpe | Max DD |
|---|---|---|---|---|
| Equal Weight | 11.47% | 10.72% | 1.07 | -5.83% |
| Risk Parity | 15.60% | 9.90% | 1.57 | -4.76% |

- **Risk parity outperforms equal weight 84% of the time** by avg 5.51%
- Risk parity = weight inversely proportional to volatility
- In strong bull markets, equal weight can outperform (more exposure to high-beta)

### Recommended approach for your agent:
1. **Risk parity weighting** as default (lower vol assets get bigger allocation)
2. **ATR-based position sizing** per trade (normalize risk across positions)
3. **Max 5% of portfolio in any single position**
4. **Max 20% in any single sector**
5. **Half-Kelly for conviction trades, quarter-Kelly for standard**

---

## 8. Market Regime Detection

### Hidden Markov Model (HMM) — Industry Standard

- **States:** Bull, Bear, Sideways (3-state model)
- **Observable inputs:** Returns, volatility, spreads, drawdowns
- **Backtest result:** NIFTY 50 (2018-2024): Sharpe 1.05, Sortino 1.51, 44.83% cumulative return
- **Source:** [Multiple academic papers](https://www.quantifiedstrategies.com/hidden-markov-model-market-regimes-how-hmm-detects-market-regimes-in-trading-strategies/)

### Implementation for Your Agent

**Simple regime detection (implementable now with OHLCV data):**

1. **VIX level:**
   - VIX < 15: Bull/low vol → momentum strategies
   - VIX 15-25: Normal → balanced approach
   - VIX 25-35: Elevated → reduce position sizes, tighten stops
   - VIX > 35: Crisis → cash or inverse, no new longs

2. **Moving Average Regime:**
   - Price > 200 SMA AND 50 SMA > 200 SMA → Bull
   - Price < 200 SMA AND 50 SMA < 200 SMA → Bear
   - Mixed signals → Sideways

3. **Volatility Regime (ATR-based):**
   - ATR(14) < ATR(50) → Low vol → mean reversion works
   - ATR(14) > ATR(50) → High vol → momentum/trend works
   - Ratio > 1.5 → Extreme → reduce size, widen stops

4. **LLM Narrative Regime (your unique edge):**
   - Feed Claude: Fed minutes, FOMC statements, economic data releases
   - Ask: "Is the current macro environment supportive of risk assets?"
   - Use as confirmation layer on top of quantitative signals

### Strategy Switching Rules:
- **Bull regime:** Momentum, buy breakouts, full position sizes
- **Bear regime:** Defensive quality stocks, smaller positions, wider stops, consider hedging
- **Sideways regime:** Mean reversion, pairs trading, range-bound strategies
- **Crisis regime:** Go to cash or minimal positions, wait for regime change signal

---

## 9. Recommended Implementation Strategy for Your Agent

### Phase 1: Foundation (Implement First)
1. **Sentiment-driven stock selection** — Use Claude to analyze news for your watchlist daily. Sentiment prediction accuracy of 74.4% is the strongest documented edge.
2. **Technical confirmation** — RSI + MACD + volume as entry confirmation (77% win rate when combined)
3. **ATR-based position sizing** — Normalize risk across all trades at 1-2% of account
4. **Simple regime detection** — 50/200 SMA + VIX level to determine strategy mode

### Phase 2: Enhancement
5. **Earnings call analysis** — Before/after earnings, have Claude analyze the transcript for tone, forward guidance, evasiveness
6. **SEC filing change detection** — Compare current 10-Q language to previous quarter, flag risk factor changes
7. **Risk parity portfolio weighting** — Weight positions inversely to their ATR/volatility
8. **Trailing stops** — Chandelier Exit (Highest High - 3x ATR) for letting winners run

### Phase 3: Advanced
9. **Multi-agent debate** — Bull/bear Claude agents argue each trade (TradingAgents architecture)
10. **Memory system** — Track what worked and what failed, adjust confidence (FinMem architecture)
11. **Macro regime via LLM** — Feed Fed minutes, employment data, CPI to Claude for regime assessment
12. **Adaptive strategy switching** — Automatically shift between momentum/mean-reversion based on detected regime

### What NOT to build:
- High-frequency trading (Alpaca latency makes this impossible)
- Pure technical analysis bots (proven to underperform)
- Anything that trades more than a few times per week (overtrading kills returns)
- Prediction of specific prices or targets (no one can do this reliably)

---

## 10. Specific Implementation Parameters

### Entry Rules (Combined Signal)
```
BUY when ALL of:
  1. Claude sentiment score > 0.6 (positive) on recent news
  2. RSI(14) < 40 AND rising (not oversold, but momentum turning up)
  3. MACD histogram > 0 or crossing above signal line
  4. Price above 200 SMA (bull regime confirmed)
  5. Volume > 20-day average volume (institutional participation)
```

### Exit Rules
```
SELL when ANY of:
  1. Trailing stop hit: Price < Highest High(22) - 3 * ATR(22)
  2. Claude sentiment flips to < 0.3 (negative) on significant news
  3. RSI(14) > 75 AND MACD histogram declining (overbought + momentum fading)
  4. Fundamental deterioration detected in earnings/filing
```

### Position Sizing
```
risk_per_trade = 0.015  # 1.5% of account
stop_distance = 2 * ATR(14)
shares = (account_value * risk_per_trade) / stop_distance
max_position = account_value * 0.05  # Never more than 5% in one stock
shares = min(shares, max_position / current_price)
```

### Portfolio Rules
```
max_positions = 10-15
max_sector_weight = 0.20  # 20%
rebalance_frequency = monthly  # Don't overtrade
cash_reserve = 0.10  # Always keep 10% cash for opportunities
regime = detect_regime(vix, sma_50, sma_200, atr_14, atr_50)
```

---

## Sources

### Academic Papers & Research
- [TradingAgents: Multi-Agent LLM Framework](https://arxiv.org/abs/2412.20138)
- [MarketSenseAI 2.0: LLM Agents for Stock Analysis](https://arxiv.org/abs/2502.00415)
- [FinMem: LLM Trading Agent with Layered Memory](https://arxiv.org/abs/2311.13743)
- [FINCON: Synthesized LLM Multi-Agent System (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/hash/f7ae4fe91d96f50abc2211f09b6a7e49-Abstract-Conference.html)
- [AI-Trader: Benchmarking Autonomous Agents in Real-Time Markets](https://arxiv.org/abs/2512.10971)
- [Sentiment Trading with Large Language Models](https://arxiv.org/abs/2412.19245)
- [FinRL: Financial Reinforcement Learning](https://github.com/AI4Finance-Foundation/FinRL)

### Strategy & Indicator Research
- [MACD + Bollinger Bands: 78% Win Rate](https://www.quantifiedstrategies.com/macd-and-bollinger-bands-strategy/)
- [Mean Reversion Strategies Backtest](https://www.quantifiedstrategies.com/mean-reversion-trading-strategy/)
- [HMM Market Regime Detection](https://www.quantifiedstrategies.com/hidden-markov-model-market-regimes-how-hmm-detects-market-regimes-in-trading-strategies/)
- [ATR Position Sizing Guide](https://quantstrategy.io/blog/using-atr-to-adjust-position-size-volatility-based-risk/)

### Benchmarks & Platforms
- [AI-Trader Live Benchmark](https://ai4trade.ai)
- [Alpaca Trading API](https://alpaca.markets)
- [FinRL-X Production Trading](https://github.com/AI4Finance-Foundation/FinRL-Trading)

### Risk & Portfolio
- [Kelly Criterion in Practice](https://www.alphatheory.com/blog/kelly-criterion-in-practice-1)
- [Risk Parity vs Equal Weight](https://www.indexologyblog.com/2018/08/22/equal-weight-versus-equal-risk-contribution-strategies-performance-comparison/)
- [LLM Earnings Call Alpha](https://www.alexandriatechnology.com/sec-filings)
