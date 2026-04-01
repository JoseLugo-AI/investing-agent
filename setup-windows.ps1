# =============================================================
# AI Investing Agent — Windows Setup Script
# Run this in PowerShell as Administrator
# =============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " AI Investing Agent — Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will set up everything you need:" -ForegroundColor White
Write-Host "  1. WSL2 (Linux on Windows)" -ForegroundColor Gray
Write-Host "  2. Node.js" -ForegroundColor Gray
Write-Host "  3. Claude Code CLI" -ForegroundColor Gray
Write-Host "  4. The investing agent" -ForegroundColor Gray
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Run this as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell -> 'Run as administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# --- Step 1: Install WSL2 ---
Write-Host "[1/5] Checking WSL2..." -ForegroundColor Yellow

$wslInstalled = $false
try {
    $wslList = wsl --list --quiet 2>$null
    if ($wslList -match "Ubuntu") {
        $wslInstalled = $true
        Write-Host "  WSL2 with Ubuntu already installed." -ForegroundColor Green
    }
} catch {}

if (-not $wslInstalled) {
    Write-Host "  Installing WSL2 + Ubuntu (this may take a few minutes)..." -ForegroundColor White
    wsl --install -d Ubuntu
    Write-Host ""
    Write-Host "  WSL2 is installing. Your computer needs to RESTART." -ForegroundColor Yellow
    Write-Host "  After restart:" -ForegroundColor Yellow
    Write-Host "    1. Ubuntu will open and ask you to create a username/password" -ForegroundColor Yellow
    Write-Host "    2. After that, run this script AGAIN" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to restart now"
    Restart-Computer
    exit 0
}

# Enable mirrored networking (so you can access the dashboard)
$wslConfigPath = "$env:USERPROFILE\.wslconfig"
if (-not (Test-Path $wslConfigPath)) {
    Write-Host "  Enabling mirrored networking..." -ForegroundColor White
    @"
[wsl2]
networkingMode=mirrored
"@ | Set-Content $wslConfigPath
    Write-Host "  Done. (WSL restart needed later)" -ForegroundColor Green
}

# --- Step 2: Get Alpaca keys ---
Write-Host ""
Write-Host "[2/5] Alpaca Paper Trading Keys" -ForegroundColor Yellow
Write-Host "  Your dad will give you these. Ask him!" -ForegroundColor White
Write-Host ""

$alpacaKeyId = Read-Host "  Enter Alpaca Key ID (starts with PK)"
$alpacaSecret = Read-Host "  Enter Alpaca Secret Key (starts with SK)"

if (-not $alpacaKeyId -or -not $alpacaSecret) {
    Write-Host "  ERROR: Both keys are required." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# --- Step 3: Setup inside WSL ---
Write-Host ""
Write-Host "[3/5] Setting up inside WSL..." -ForegroundColor Yellow

$wslSetupScript = @"
#!/bin/bash
set -e

echo ""
echo "=== Setting up inside Linux ==="
echo ""

# Install Node.js 20 if not present
if ! command -v node &> /dev/null; then
    echo "[*] Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "[*] Node.js already installed: `$(node --version)"
fi

# Install Claude Code CLI if not present
if ! command -v claude &> /dev/null; then
    echo "[*] Installing Claude Code CLI..."
    npm install -g @anthropic-ai/claude-code
else
    echo "[*] Claude Code already installed"
fi

# Clone the repo if not present
if [ ! -d ~/investing-agent ]; then
    echo "[*] Cloning the investing agent..."
    git clone https://github.com/JoseLugo-AI/investing-agent.git ~/investing-agent
else
    echo "[*] Repo already cloned, pulling latest..."
    cd ~/investing-agent && git pull
fi

# Install dependencies
echo "[*] Installing dependencies..."
cd ~/investing-agent && npm install

# Create .alpaca-env file
echo "[*] Saving Alpaca keys..."
cat > ~/.alpaca-env << ENVEOF
ALPACA_KEY_ID=$alpacaKeyId
ALPACA_SECRET_KEY=$alpacaSecret
ENVEOF
chmod 600 ~/.alpaca-env

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Log into Claude Code: run 'claude' and follow the login prompts"
echo "  2. Start the dashboard: run 'cd ~/investing-agent && ./start.sh'"
echo ""
"@

# Write the script to a temp file and run it in WSL
$tempFile = [System.IO.Path]::GetTempFileName()
$wslSetupScript | Set-Content -Path $tempFile -NoNewline
$wslPath = wsl wslpath -u ($tempFile -replace '\\', '/')
wsl bash $wslPath
Remove-Item $tempFile

# --- Step 4: Create start script ---
Write-Host ""
Write-Host "[4/5] Creating start script..." -ForegroundColor Yellow

$startScript = @'
#!/bin/bash
cd ~/investing-agent
export $(cat ~/.alpaca-env | xargs)
echo ""
echo "Starting the AI Investing Agent dashboard..."
echo "Open your browser to: http://localhost:5010"
echo "Press Ctrl+C to stop."
echo ""
npm run dev:web
'@

wsl bash -c "echo '$startScript' > ~/investing-agent/start.sh && chmod +x ~/investing-agent/start.sh"

Write-Host "  Done." -ForegroundColor Green

# --- Step 5: Claude login reminder ---
Write-Host ""
Write-Host "[5/5] Almost done!" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Two things left to do manually:" -ForegroundColor White
Write-Host ""
Write-Host "  1. LOG INTO CLAUDE CODE:" -ForegroundColor Cyan
Write-Host "     Open Ubuntu from Start Menu, then type:" -ForegroundColor White
Write-Host "       claude" -ForegroundColor Yellow
Write-Host "     Follow the login prompts with your Claude account." -ForegroundColor White
Write-Host ""
Write-Host "  2. START THE DASHBOARD:" -ForegroundColor Cyan
Write-Host "     In Ubuntu, type:" -ForegroundColor White
Write-Host "       cd ~/investing-agent && ./start.sh" -ForegroundColor Yellow
Write-Host "     Then open http://localhost:5010 in your browser." -ForegroundColor White
Write-Host ""
Write-Host "That's it! The Agent tab in the dashboard lets you" -ForegroundColor Gray
Write-Host "start/stop the trading agent and watch it work." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to finish"
