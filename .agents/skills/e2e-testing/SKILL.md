---
name: e2e-playwright-tests
description: How to run the Playwright E2E test suite for ProperBackup subscription flows against the live test server.
---

# E2E Testing with Playwright

## Prerequisites

```bash
npx playwright install chromium
```

SSH key at `/home/ubuntu/.ssh/test_server_key_fixed` is required for DB verification (SSH into test server → docker exec psql).

## Running Tests

```bash
# All 10 tests (takes ~9 minutes)
npx playwright test

# Single group
npx playwright test tests/e2e/group-a-registration.spec.js

# Single test by name
npx playwright test -g "Test 3"
```

## Test Structure

- `tests/e2e/group-{a..h}-*.spec.js` — 8 spec files, 10 tests total
- `tests/e2e/helpers/api.js` — API client (register, login, getSubscription, etc.)
- `tests/e2e/helpers/db.js` — DB queries via SSH + docker exec
- `tests/e2e/helpers/auth.js` — Browser login helpers (handles bilingual UI)
- `tests/e2e/helpers/stripe-checkout.js` — Fills Stripe Checkout form
- `tests/e2e/helpers/fixtures.js` — Test email generator, constants

## Output

- Videos: `test-results/*/video.webm` (one per test)
- Screenshots: `test-results/*.png`
- HTML report: `playwright-report/` (`npx playwright show-report`)
- Traces: `test-results/*/trace.zip`

## Common Issues

1. **Two submit buttons on login page** — Use `form button[type="submit"]` not generic `button[type="submit"]`
2. **Stripe `networkidle` timeout** — Use `domcontentloaded` instead; Stripe keeps connections open
3. **Stripe Link checkbox** — Uncheck `#enableStripePass` to avoid phone number requirement
4. **ZIP code required** — Fill `#billingPostalCode` with `10001` for US region
5. **Bilingual selectors** — UI may show EN or PL. Use `button:has-text("English"), button:has-text("Polish")` pattern
6. **Already logged in** — After Stripe redirect, user is logged in. `loginUI()` handles this automatically
7. **`renewSubscription` vs `reactivateSubscription`** — `renew` creates new checkout; `reactivate` flips `cancel_at_period_end`

## Test Server

- URL: `http://properbackup-test-server.softify.com.pl`
- API: `http://properbackup-test-server.softify.com.pl/api/`
- Stripe: Test mode (sandbox), card `4242 4242 4242 4242`
- Decline card: `4000 0000 0000 0341`
- Test password: `E2eTestPass123!`
- Test emails: `*@properbackup.dev` (auto-generated, disposable)
