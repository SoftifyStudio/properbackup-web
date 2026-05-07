---
name: testing-properbackup-web
description: How to set up, run, and test the ProperBackup web panel locally and via Docker stack.
---

# Testing ProperBackup Web Panel

## Dev Server Setup

1. Install dependencies: `npm install` in the repo root
2. Start dev server: `npx vite --host 0.0.0.0 --port 5175`
3. The dev server proxies API requests to the buffer at `http://localhost:7100` (configured in `vite.config.js`)
4. If port 5175 is taken, Vite auto-increments (5176, 5177, etc.)

## Docker Stack

The full stack lives in `SoftifyStudio/properbackup-stack`:
```bash
docker compose up
```
This starts 5 services:
- **db** (PostgreSQL 16) — port 5432
- **buffer** (Kotlin/Javalin API + SSE) — port 7100
- **web** (React/Vite + nginx) — port 8080
- **agent** (VPS simulation) — scans files, uploads to buffer
- **storage** (restrictive gateway) — port 9000, upload-only, 900MB chunks

## Login Credentials

- Email: `demo@properbackup.com`
- Password: Use the secret `PROPERBACKUP_DEMO_PASSWORD` if available, otherwise check with the user

## Key Test Scenarios

### Tab Structure
- Only 4 tabs: Files, Timeline, Activity, Settings
- Files is the default landing tab

### Files Tab (OneDrive-style)
- Breadcrumb navigation ("My Server > folder > subfolder")
- Columns: Name, Modified, Status
- Status filters: All, Current, Changed, New, Deleted (with counts)
- Deep folder navigation (6+ levels)

### Timeline Tab
- Shows snapshots with Active/Deleted badges
- Click snapshot: "Time travel to this moment" bar + "Restore to this moment" button
- Click again to deselect
- Filter: All / Active / Deleted
- Falls back silently to 12 fixture snapshots when buffer is down (NO error banner)

### Activity Tab
- Newest entries at top (reverse chronological)
- LIVE indicator with green dot
- Batch update entries are expandable (click chevron to see file list)
- Shows phases, file changes, log entries

### Settings Tab
- "Default: entire system backup" info banner when no folders configured
- No error banner when buffer is unreachable

### Error Suppression (Critical)
- **Zero error banners** across all tabs — this is a hard business requirement
- When buffer is down, all components fall back silently to fixture/demo data
- The Connected indicator is hardcoded to always show green "Connected"
- Test by stopping `pb-buffer` container and verifying no red/orange/yellow banners appear

### Agent Connectivity
- Agent auto-registers with buffer on startup
- If buffer restarts, agent re-registers automatically
- The `docker-entrypoint-agent.sh` script handles auto-registration

## Build Verification

```bash
npx vite build
```
No CI is configured — verify locally before pushing.

## Companion Repos
- **Buffer**: `SoftifyStudio/properbackup-buffer` (SSE endpoint PR #4)
- **Stack**: `SoftifyStudio/properbackup-stack` (Docker orchestration)
- **Agent**: `SoftifyStudio/properbackup-agent`
- **Shared**: `SoftifyStudio/properbackup-shared`
