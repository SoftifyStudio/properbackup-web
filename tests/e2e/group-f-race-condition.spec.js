import { test, expect } from '@playwright/test';
import { register, getSubscription, createCheckout, verifySession } from './helpers/api.js';
import { verifyEmail } from './helpers/db.js';
import { loginUI, goToSubscription } from './helpers/auth.js';
import { uniqueEmail, TEST_PASSWORD, BASE_URL } from './helpers/fixtures.js';

test.describe('GRUPA F: Asynchroniczność i wyścigi (Race Conditions)', () => {
  test('Test 8: Szybki powrót użytkownika przed przetworzeniem Webhooka', async ({ page }) => {
    const email = uniqueEmail('f8-race');
    const reg = await register(email, TEST_PASSWORD);
    verifyEmail(email);

    // Create checkout session via API (not completing it)
    const checkout = await createCheckout(reg.token, 'monthly');
    expect(checkout.sessionId).toBeTruthy();

    // Simulate fast redirect — go to subscription BEFORE webhook
    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);

    // No 403 or crash
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('403');
    expect(pageContent).not.toContain('Forbidden');

    // Still shows trial-eligible state
    const sub = await getSubscription(reg.token);
    expect(sub.status).toBe('pending_payment');

    const banner = page.locator('text=/Provide a payment card|Podaj kartę płatniczą/');
    await expect(banner).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: 'test-results/test8-race-condition.png', fullPage: true });

    // verify-session endpoint doesn't crash
    const verifyRes = await verifySession(reg.token, checkout.sessionId);
    expect(verifyRes.status).toBeLessThan(500);
  });
});
