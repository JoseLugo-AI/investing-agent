# Phase 3: Risk Engine + Claude AI Analysis

**Date:** 2026-04-01
**Status:** In Progress

## Overview

Add risk management engine and Claude AI analysis to protect a new trader from catastrophic losses and provide AI-powered trade insights.

## Tasks

### Task 1: Risk Constants + Types
- Create `src/shared/risk-constants.ts` with all risk parameters
- Add risk-related types to `src/renderer/types.ts`
- Files: risk-constants.ts, types.ts

### Task 2: Risk Engine (Core Logic)
- Create `src/main/risk-engine.ts` — pure functions, no side effects
- `validateOrder()` — pre-trade check against all limits
- `calculateKellySize()` — fractional Kelly position sizing
- `checkDailyLoss()` — 3% daily loss limit
- `checkDrawdown()` — weekly 5%, max 20% kill switch
- `checkPositionConcentration()` — 3% single, 30% sector
- Tests first in `src/main/__tests__/risk-engine.test.ts`

### Task 3: Claude Analyzer (Backend)
- Install `@anthropic-ai/sdk`
- Create `src/main/claude-analyzer.ts`
- API key storage (same keystore pattern as Alpaca)
- `analyzePosition()` function with structured prompt
- Parse Claude response into typed AnalysisResult
- Tests in `src/main/__tests__/claude-analyzer.test.ts`

### Task 4: IPC Integration
- Wire risk engine + Claude analyzer into ipc-handlers
- New channels: `validate-order`, `check-risk-status`, `analyze-position`, `save-claude-key`, `has-claude-key`
- Update preload.ts and api.ts

### Task 5: RiskPanel Component
- Shows current risk metrics (daily loss, drawdown, position limits)
- Color-coded status indicators (green/yellow/red)
- Tests in `src/renderer/components/__tests__/RiskPanel.test.tsx`

### Task 6: AIAnalysis Component
- Shows Claude's analysis for selected position/symbol
- Recommendation badge (buy/sell/hold)
- Confidence indicator
- Reasoning + risks display
- Tests in `src/renderer/components/__tests__/AIAnalysis.test.tsx`

### Task 7: RiskGate Integration
- Pre-trade risk validation overlay on OrderConfirmDialog
- Shows warnings/errors before order confirmation
- Block orders that violate hard limits
- Tests in `src/renderer/components/__tests__/RiskGate.test.tsx`

### Task 8: Dashboard Integration
- Add RiskPanel and AIAnalysis to Dashboard layout
- Wire up risk validation in order flow
- Integration test updates

## Success Criteria
- All new tests pass
- All existing 68 tests still pass
- Risk engine blocks orders exceeding limits
- Claude analyzer returns structured analysis
- Dashboard shows risk metrics and AI analysis
