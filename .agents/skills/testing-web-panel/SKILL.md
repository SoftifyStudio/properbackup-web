---
name: testing-properbackup-web
description: Test the ProperBackup web panel UI end-to-end. Use when verifying file browser, timeline, activity log, or settings changes.
---

# Testing ProperBackup Web Panel

## Dev Server Setup

```bash
cd /home/ubuntu/repos/properbackup-web
npm install
npx vite --host 0.0.0.0 --port 5175
```

The app runs at `http://localhost:5175`. Vite proxies `/api` requests to `http://127.0.0.1:7100` (buffer service).

## Devin Secrets Needed

No secrets required — demo credentials are hardcoded for development.

## Login

- Email: `demo@properbackup.com`
- Password: `ProperBackup2026!`
- These are fixture credentials that work without the buffer API running

## Buffer API (Optional)

The buffer API runs on port 7100. If it's not running:
- File list falls back to fixture data from the inventory API response
- Timeline falls back to 12 demo snapshots (fixture data)
- Activity log shows 14 fixture events
- Settings shows "Default: entire system backup" without errors
- All error banners are suppressed — the UI should never show 404/500 errors

To run the full stack with buffer: use `docker compose up` from the `properbackup-stack` repo.

## Key Test Areas

### Files Tab (OneDrive Web style)
- Golden folder icons (`#dcb67a`)
- Status dots (6px) + text labels (Synced/Modified/Deleted/New) — NOT pill badges
- Breadcrumb: "My files" root in blue (`#0078d4`), chevron separators
- Row height 48px, font sizes 14px/13px/12px
- Hover highlight on mouse enter (`#f3f2f1`)
- Column headers: Name, Modified, Status — sortable
- Navigate deep into folders: data > backup-source > home > daniel > mc-server

### Timeline Tab
- Shows 12 fixture snapshots with Active/Deleted badges
- Click a snapshot → auto-switches to Files tab with amber time-travel bar
- Time-travel bar: "Viewing snapshot [date]" + "Restore to this moment" + "Back to Live"
- Amber badge appears in breadcrumb with snapshot date
- "Back to Live" returns to normal live view
- Note: Time-travel is UI-only — file list content doesn't change based on selected snapshot (backend endpoint needed)

### Activity Tab
- Newest events at top
- LIVE indicator
- Batch update rows are expandable (click chevron to see file list)
- Shows phases (Idle, Scanning, Uploading), file events, log entries

### Settings Tab
- "Default: entire system backup" info banner
- Folder path input + Add button
- No error banners when buffer is down

## Common Issues

- If Timeline shows "No snapshots yet", the buffer API might be returning an empty array. The fixture fallback triggers on both API errors AND empty results.
- If login fails with network error, the buffer API might not be responding. Check if port 7100 is accessible.
- The connection indicator always shows "Connected" (hardcoded for demo). In production this should reflect actual SSE status.
- Session is stored in sessionStorage — refreshing the page keeps you logged in, but closing the tab loses the session.

## Build Verification

```bash
npx vite build  # Should complete with 0 errors
```

No lint or typecheck commands are configured.
