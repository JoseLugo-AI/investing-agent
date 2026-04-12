# Setup Guide -- AI Investing Agent

This guide gets the AI investing agent running on your Windows computer.
No coding experience needed. Just follow each step.

Pick your path:

- **[Option A: I'm starting from scratch](#option-a-starting-from-scratch)** -- you don't have Claude Code yet
- **[Option B: I already have Claude Code](#option-b-i-already-have-claude-code)** -- you just want the agent

---

## Option A: Starting from scratch

This covers everything: WSL2, Node.js, Claude Code, and the agent itself.

### What you need

- Windows 10 or 11
- Internet connection
- A Claude account (Pro or Max) -- sign up at [claude.ai](https://claude.ai)
- Alpaca paper trading keys (free) -- sign up at [alpaca.markets](https://alpaca.markets)

### A1. Get your Alpaca keys

1. Go to [alpaca.markets](https://alpaca.markets) and create a free account
2. Switch to **Paper Trading** in the top-left dropdown
3. Go to the dashboard and click **API Keys** > **Generate New Key**
4. Save both the **Key ID** (starts with PK) and **Secret Key** (starts with SK) somewhere safe

### A2. Get a Claude subscription

1. Go to [claude.ai](https://claude.ai) and create an account
2. Subscribe to **Claude Pro** ($20/month) or **Claude Max** -- this powers the AI analysis

### A3. Run the setup script

1. Click the **Start** button and type **PowerShell**
2. Right-click **Windows PowerShell** and choose **Run as administrator**
3. Copy and paste this entire command, then hit Enter:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/JoseLugo-AI/investing-agent/main/setup-windows.ps1" -OutFile "$env:TEMP\setup.ps1"; & "$env:TEMP\setup.ps1"
```

4. The script will:
   - Install WSL2 (Linux on Windows) -- your computer may need to **restart**
   - If it restarts, open PowerShell as admin again and **run the same command**
   - Ask you for your Alpaca keys
   - Download and install everything else automatically

### A4. Log into Claude Code

1. Open **Ubuntu** from the Start Menu (it was installed by the setup script)
2. Type this and hit Enter:

```bash
claude
```

3. It will ask you to log in. Follow the instructions -- it opens a browser where you sign in with your Claude account.
4. Once logged in, you can close this for now.

### A5. Start the dashboard

1. Open **Ubuntu** from the Start Menu
2. Type this and hit Enter:

```bash
cd ~/investing-agent && ./start.sh
```

3. Wait about 5 seconds, then open your browser and go to:

```
http://localhost:5010
```

4. You should see the investing dashboard with three tabs: **Dashboard**, **Agent**, and **Settings**.

You're done. Jump to [Using the dashboard](#using-the-dashboard) below.

---

## Option B: I already have Claude Code

You already have Claude Code installed and a subscription. You just need the agent.

### What you need

- Claude Code CLI working (run `claude --version` to verify)
- Node.js 18+ (`node --version` to verify)
- Alpaca paper trading keys (free) -- sign up at [alpaca.markets](https://alpaca.markets) if you don't have them

### B1. Get your Alpaca keys

1. Go to [alpaca.markets](https://alpaca.markets) and create a free account (or log in)
2. Switch to **Paper Trading** in the top-left dropdown
3. Go to the dashboard and click **API Keys** > **Generate New Key**
4. Save both the **Key ID** (starts with PK) and **Secret Key** (starts with SK)

### B2. Clone and install

```bash
git clone https://github.com/JoseLugo-AI/investing-agent.git
cd investing-agent
npm install
```

### B3. Configure your keys

```bash
cat > ~/.alpaca-env << 'EOF'
ALPACA_KEY_ID=your-key-id-here
ALPACA_SECRET_KEY=your-secret-key-here
EOF
chmod 600 ~/.alpaca-env
```

Replace `your-key-id-here` and `your-secret-key-here` with your actual keys.

### B4. Start the dashboard

```bash
export $(cat ~/.alpaca-env | xargs)
npm run dev:web
```

Open `http://localhost:5010` in your browser. That's it.

---

## Using the dashboard

### Dashboard tab
- See your portfolio value, positions, P&L
- Click on any stock to see its price chart
- Click "Analyze" to get Claude's take on any position

### Agent tab
- Click **Start Agent** to turn on the autonomous trading agent
- Watch the **Activity Feed** to see what it's doing in real-time
- Click on any trade in the **Trade Log** to see why the agent made that decision
- **Tier Allocations** shows how the money is spread across Conservative, Moderate, and Aggressive strategies

### Settings tab
- Shows your connection status and risk limits

---

## Starting it again next time

Every time you want to use the dashboard:

1. Open your terminal (Ubuntu on Windows, or your regular terminal on Mac/Linux)
2. Type: `cd ~/investing-agent && ./start.sh`
3. Open `http://localhost:5010` in your browser

If you cloned to a different location, adjust the path accordingly.

---

## Updating to the latest version

```bash
cd ~/investing-agent && git pull && npm install
```

Then start it again with `./start.sh` (or `npm run dev:web` with your env loaded).

---

## Troubleshooting

**"Cannot connect" in the browser**
- Make sure the server is still running in your terminal. Don't close that window.

**"Claude command not found"**
- Run: `npm install -g @anthropic-ai/claude-code`

**Agent says "Analysis failed"**
- Make sure you're logged into Claude Code. Run `claude` in your terminal to check.

**Dashboard shows no data**
- Check that your Alpaca keys are correct. Run: `cat ~/.alpaca-env` to see them.
- The market is only open Mon-Fri 9:30 AM - 4:00 PM Eastern. Outside those hours, the agent will scan but not trade.
