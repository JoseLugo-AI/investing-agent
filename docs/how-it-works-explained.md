# How the AI Trading Agent Works
**Explained simply**

---

## Imagine you're picking players for a basketball team.

You wouldn't just grab random people off the street. You'd scout them first — read about them, watch their highlights, check their stats, and see if they fit your team's style.

That's exactly what this trading agent does, but with stocks instead of players.

---

## Step 1: "Who should I even look at?" (Sentiment)

Before buying any stock, the agent reads the news about it. Not the price chart — the actual news. Is the company launching cool stuff? Did they just crush their earnings? Or are people writing articles about how they're in trouble?

This is where Claude has a superpower. It can read hundreds of articles and tell you: "People are feeling good about this company" or "People are worried." A study tested this on almost a million news articles and it was right 74% of the time. That's way better than guessing.

**Rule: Only buy stocks that people feel good about. If the news is bad, don't touch it.**

---

## Step 2: "Is now a good time to buy?" (Technical Indicators)

OK so you found a good stock with positive news. But you don't just buy it at any price. You wait for the right moment. Think of it like buying sneakers — you know you want them, but you wait for the dip.

Three tools help with this:

- **RSI** — tells you if a stock is "on sale" (oversold) or "overpriced" (overbought). Like checking if sneakers are at retail or marked up on StockX.
- **MACD** — tells you if the stock's momentum is going up or down. Like checking if a player is improving or declining.
- **Volume** — tells you if a lot of people are buying. If volume is high and the price is going up, that's like a hype drop — real demand, not just one random buyer.

When ALL THREE say "buy" at the same time, you have a 77% chance of being right. Any single one alone? Just a coin flip.

**Rule: Only buy when RSI, MACD, and volume all agree. Three green lights, not one.**

---

## Step 3: "How much should I buy?" (Position Sizing)

This is the part most people skip, and it's why most people lose money.

Say you have $100. You wouldn't bet all $100 on one stock, right? But how much DO you bet?

The agent uses something called **ATR** — basically, how much a stock bounces around on a normal day. A calm stock like Walmart might move $2/day. A wild stock like Tesla might move $20/day.

The rule: **Risk the same dollar amount on every trade, no matter how wild the stock is.** If a stock is wild, you buy fewer shares. If it's calm, you buy more. That way, if you're wrong, you lose roughly the same amount every time — about 1.5% of your total money.

**Rule: Never let one bad trade hurt you more than 1.5%. The math handles how many shares to buy.**

---

## Step 4: "What's the weather like?" (Regime Detection)

The stock market has seasons, like weather:

- **Bull market** (sunny) — most stocks go up. You buy more, take bigger swings.
- **Bear market** (storm) — most stocks go down. You buy less, play defense, keep cash ready.
- **Sideways** (cloudy) — nothing's really moving. You play it safe.

The agent checks the "weather" using the VIX (a fear gauge) and moving averages (is the market trending up or down?). When it's stormy, the agent automatically gets more cautious — smaller bets, tighter safety nets.

**Rule: Don't play the same way in a storm as you do in sunshine.**

---

## Step 5: "When do I sell?" (Exit Rules)

This is where most people mess up. They sell winners too early ("I made 10%, let me lock it in!") and hold losers too long ("It'll come back...").

The agent has automatic rules:

- **Trailing stop** — as a stock goes up, the agent moves your safety net up with it. If the stock drops too far from its high, it sells automatically. You never give back all your gains.
- **Bad news** — if Claude reads news that flips negative, it sells.
- **Momentum dying** — if the technical indicators flip from green to red, it sells.

**Rule: Let your winners run. Cut your losers fast. No emotions.**

---

## Why this matters

Most people who trade stocks lose money because they:

1. Buy based on hype (no research)
2. Buy at the wrong time (no indicators)
3. Bet too much on one thing (no position sizing)
4. Don't adapt to market conditions (no regime detection)
5. Sell winners too early and hold losers too long (no exit rules)

This agent fixes all five. It's not magic — it's discipline. The research shows that the agents that make money aren't the smartest ones. They're the ones with the best rules.

---

That's the system. It's built so you can watch it work, read why it makes each decision, and learn how real money management works — before a single real dollar is on the line.
