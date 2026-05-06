---
name: testing-properbackup-web
description: Test ProperBackup web UI components (AgentIndexBanner, ErrorBoundary, i18n). Use when verifying web panel changes or agent status UI.
---

# Testing ProperBackup Web UI

## Prerequisites

- Node.js installed
- `npm install` in `properbackup-web` root

## Running the Dev Server

```bash
cd properbackup-web
npm run dev
# Vite starts on port 5173 (or next available)
```

The app uses `bufferConfig.js` to determine the buffer API URL:
- In dev mode: proxies `/api` to `http://127.0.0.1:37100`
- Without a running buffer, the app falls into **fixture mode** with mock data

## Testing AgentIndexBanner (Progress Bar Component)

The `AgentIndexBanner` component renders different states based on `agentStatus` props:

| Phase | Visual | Key Props |
|-------|--------|-----------|
| `indexing` + totalFiles/scannedFiles | Determinate blue fill bar with percentage | `agentStatus.totalFiles`, `agentStatus.scannedFiles`, `agentStatus.currentFile` |
| `indexing` without progress | Indeterminate shimmer animation | Just `phase: 'indexing'` |
| `uploading` | Shimmer animation | `phase: 'uploading'` |
| `idle` | Solid green full-width bar | `phase: 'idle'` |
| `waiting` | Amber pulsing bar | `phase: 'waiting'` |
| `null` agentStatus | "No signal" fallback | No agentStatus prop |

### Creating a Test Harness

To test without a buffer backend, create a test harness page:

1. Create `test-harness.html` in the project root with `overflow: auto !important` styles (the main `index.css` sets `overflow: hidden` on html/body which prevents scrolling)
2. Create `src/test-harness.jsx` that imports `I18nProvider` and `AgentIndexBanner` with mock data scenarios
3. Access at `http://localhost:{port}/test-harness.html`

**Important**: The `index.css` sets `overflow: hidden` on `html`, `body`, and `#root`. Test harness HTML must override this with `!important` styles to enable scrolling.

### i18n Testing

The app supports `pl` (Polish) and `en` (English). Locale is stored in `localStorage` key `properbackup.locale`. To test:
- Add a locale toggle component using `useI18n()` hook's `setLocale()` method
- Or set `localStorage.setItem('properbackup.locale', 'pl')` and reload

Key i18n keys to verify:
- `backups.agentPhase.indexing` → PL: "Indeksowanie", EN: "Indexing"
- `backups.agentPhase.uploading` → PL: "Tworzenie kopii", EN: "Backing up"
- `backups.agentPhase.idle` → PL: "Indeks aktualny", EN: "Index ready"
- `backups.agentProgressCount` → PL: "{{scanned}} / {{total}} plików ({{pct}}%)"

### ErrorBoundary Testing

Wrap a component that throws an error inside `<ErrorBoundary>` to verify:
- Red error card appears with error message
- "Try again" button is present
- Other components on the page are unaffected

## Responsive Testing

To test mobile layout:
```bash
wmctrl -r :ACTIVE: -b remove,maximized_vert,maximized_horz
xdotool getactivewindow windowsize 400 700 windowmove 0 0
```

The `AgentIndexBanner` layout should stack vertically at narrow widths — timestamp section moves below the phase heading.

## Architecture Notes

- **4 repos** work together: `properbackup-web` (React UI), `properbackup-buffer` (JVM backend), `properbackup-agent` (JVM client), `properbackup-shared` (Kotlin multiplatform shared code)
- Agent reports scan progress via `POST /agent/status` with `totalFiles`, `scannedFiles`, `currentFile`
- Buffer stores in `machine_agent_status` table and returns via `GET /servers/{id}/inventory` → `agentStatus`
- Web polls `agentStatus` every ~1s and file list every ~4s
- Progress reporting is throttled at 800ms intervals in the agent

## No CI

These repos currently have no CI configured. Build verification must be done locally.
