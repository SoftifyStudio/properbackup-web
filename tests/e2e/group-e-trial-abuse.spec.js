import { test, expect } from '@playwright/test';
import { register, login, getSubscription } from './helpers/api.js';
import { getUser, verifyEmail } from './helpers/db.js';
import { loginUI, goToSubscription } from './helpers/auth.js';
import { fillStripeCheckout } from './helpers/stripe-checkout.js';
import { uniqueEmail, TEST_PASSWORD } from './helpers/fixtures.js';

test.describe('GRUPA E: Ochrona przed oszustwami (Trial Abuse Prevention)', () => {
  test('Test 7: Próba użycia tej samej karty na drugim koncie', async ({ page, browser }) => {
    test.setTimeout(300_000); // 5 minutes — two full checkout flows
    // --- Step 1: Account A — activate trial with card 4242 ---
    const emailA = uniqueEmail('e7-acctA');
    const regA = await register(emailA, TEST_PASSWORD);
    verifyEmail(emailA);

    await loginUI(page, emailA, TEST_PASSWORD);
    await goToSubscription(page);
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Start free"), button:has-text("Rozpocznij darmowy")').first().click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page.waitForTimeout(3000);
    await fillStripeCheckout(page);
    // Wait more for redirect + webhook processing
    await page.waitForTimeout(10000);

    // Verify via API (more reliable than DB polling)
    const loginA = await login(emailA, TEST_PASSWORD);
    let subA = await getSubscription(loginA.token);
    let retries = 0;
    while (!subA.active && retries < 20) {
      await page.waitForTimeout(2000);
      subA = await getSubscription(loginA.token);
      retries++;
    }
    expect(subA.active).toBe(true);
    expect(subA.plan).toBe('monthly');

    await goToSubscription(page);
    await page.screenshot({ path: 'test-results/test7-accountA-active.png', fullPage: true });

    // --- Step 2: Account B — try same card 4242 ---
    const emailB = uniqueEmail('e7-acctB');
    await register(emailB, TEST_PASSWORD);
    verifyEmail(emailB);

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();

    await loginUI(page2, emailB, TEST_PASSWORD);
    await goToSubscription(page2);
    await page2.locator('input[type="checkbox"]').click();
    await page2.waitForTimeout(500);
    await page2.locator('button:has-text("Start free"), button:has-text("Rozpocznij darmowy")').first().click();
    await page2.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page2.waitForTimeout(3000);
    await fillStripeCheckout(page2);
    await page2.waitForTimeout(10000);

    // --- Step 3: Verify result ---
    // Backend now checks card fingerprint and cancels duplicate trial subscriptions.
    const loginB = await login(emailB, TEST_PASSWORD);
    let subB = await getSubscription(loginB.token);

    // Give webhook time to process + backend to detect abuse and cancel
    let retries2 = 0;
    while (retries2 < 15) {
      await page2.waitForTimeout(2000);
      subB = await getSubscription(loginB.token);
      // Stop once we see the result stabilize
      if (retries2 > 5) break;
      retries2++;
    }

    // Account B should NOT have active subscription (fingerprint-blocked)
    expect(subB.active).toBe(false);
    expect(subB.status).toMatch(/pending_payment|expired/);

    test.info().annotations.push({
      type: 'note',
      description: `Trial abuse BLOCKED: Account B status=${subB.status}, active=${subB.active}. Card fingerprint matched Account A.`,
    });

    await page2.screenshot({ path: 'test-results/test7-accountB-result.png', fullPage: true });
    await ctx2.close();
  });
});
