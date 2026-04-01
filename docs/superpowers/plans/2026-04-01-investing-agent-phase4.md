# Phase 4: Packaging + Polish

**Date:** 2026-04-01
**Status:** In Progress

## Tasks

### Task 1: ErrorBoundary Component
- React error boundary to catch crashes gracefully
- Shows user-friendly error message with retry option
- Tests

### Task 2: Logging (electron-log)
- Install electron-log
- Create logger module
- Add logging to key operations (startup, orders, errors)

### Task 3: Auto-Update Mechanism
- Simple version check against GitHub releases
- Show notification when update available
- Download link (no auto-install — keep it simple)

### Task 4: electron-builder Configuration
- electron-builder.yml for Windows .exe
- App icon (placeholder SVG-to-ICO)
- Build scripts in package.json

### Task 5: Settings Enhancement
- Add Claude API key management to Settings page
- Show risk configuration (read-only for now)

### Task 6: Final Polish
- Version bump to 1.0.0
- Clean up any TypeScript warnings
- Final full test suite run
