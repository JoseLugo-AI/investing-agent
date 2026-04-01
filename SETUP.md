# Setup Guide — AI Investing Agent

This guide gets the AI investing agent running on your Windows computer.
No coding experience needed. Just follow each step.

---

## What you need before starting

- A Windows 10 or 11 computer
- Internet connection
- A Claude account (Pro or Max) — sign up at claude.ai
- Alpaca paper trading keys (your dad will give you these)

---

## Step 1: Run the setup script

1. Click the **Start** button and type **PowerShell**
2. Right-click **Windows PowerShell** and choose **Run as administrator**
3. Copy and paste this entire command, then hit Enter:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/JoseLugo-AI/investing-agent/main/setup-windows.ps1" -OutFile "$env:TEMP\setup.ps1"; & "$env:TEMP\setup.ps1"
```

4. The script will:
   - Install WSL2 (Linux on Windows) — your computer may need to **restart**
   - If it restarts, open PowerShell as admin again and **run the same command**
   - Ask you for Alpaca keys — type in what your dad gave you
   - Download and install everything else automatically

---

## Step 2: Log into Claude Code

1. Open **Ubuntu** from the Start Menu (it was installed by the setup script)
2. Type this and hit Enter:

```bash
claude
```

3. It will ask you to log in. Follow the instructions — it opens a browser where you sign in with your Claude account.
4. Once logged in, you can close this for now.

---

## Step 3: Start the dashboard

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

1. Open **Ubuntu** from Start Menu
2. Type: `cd ~/investing-agent && ./start.sh`
3. Open `http://localhost:5010` in your browser

---

## Updating to the latest version

If your dad pushes updates to the agent:

1. Open **Ubuntu**
2. Type:

```bash
cd ~/investing-agent && git pull && npm install
```

3. Then start it again with `./start.sh`

---

## Troubleshooting

**"Cannot connect" in the browser**
- Make sure `./start.sh` is still running in Ubuntu. Don't close that window.

**"Claude command not found"**
- Run: `npm install -g @anthropic-ai/claude-code`

**Agent says "Analysis failed"**
- Make sure you're logged into Claude Code. Run `claude` in Ubuntu to check.

**Dashboard shows no data**
- Check that your Alpaca keys are correct. Run: `cat ~/.alpaca-env` to see them.
- The market is only open Mon-Fri 9:30 AM - 4:00 PM Eastern. Outside those hours, the agent will scan but not trade (except the first time it starts).
