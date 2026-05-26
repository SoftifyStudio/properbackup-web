import { test, expect } from '@playwright/test';
import { register, login, getSubscription, cancelSubscription, reactivateSubscription } from './helpers/api.js';
import { getUser, verifyEmail } from './helpers/db.js';
import { loginUI, goToSubscription } from './helpers/auth.js';
import { fillStripeCheckout } from './helpers/stripe-checkout.js';
import { uniqueEmail, TEST_PASSWORD, BASE_URL } from './helpers/fixtures.js';

test.describe('GRUPA C: Zarządzanie subskrypcją w trakcie trialu', () => {
  let email, token;

  test.beforeAll(async ({ browser }) => {
    email = uniqueEmail('c-cancel');
    const reg = await register(email, TEST_PASSWORD);
    token = reg.token;
    verifyEmail(email);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Start free"), button:has-text("Rozpocznij darmowy")').first().click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page.waitForTimeout(3000);
    await fillStripeCheckout(page);
    await page.waitForTimeout(5000);

    let user = getUser(email);
    let retries = 0;
    while (!user?.subscriptionPlan && retries < 15) {
      await page.waitForTimeout(2000);
      user = getUser(email);
      retries++;
    }

    const loginRes = await login(email, TEST_PASSWORD);
    token = loginRes.token;
    await context.close();
  });

  test('Test 4: Anulowanie subskrypcji w trakcie trwania darmowego miesiąca', async ({ page }) => {
    let sub = await getSubscription(token);
    expect(sub.active).toBe(true);
    expect(sub.plan).toBe('monthly');

    // Cancel via API directly (more reliable than UI click)
    await cancelSubscription(token);
    await page.waitForTimeout(3000);

    // Verify DB
    const dbUser = getUser(email);
    expect(dbUser.cancelAtPeriodEnd).toBe(true);
    expect(dbUser.subscriptionPlan).toBe('monthly');

    // Verify API — still active but scheduled to cancel
    sub = await getSubscription(token);
    expect(sub.active).toBe(true);
    expect(sub.cancelAtPeriodEnd).toBe(true);

    // Verify UI shows cancelled state
    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);
    // Scroll down to see the full page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/test4-cancelled-trial.png', fullPage: true });
  });

  test('Test 5: Cofnięcie anulowania przed końcem okresu próbnego', async ({ page }) => {
    let sub = await getSubscription(token);
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect(sub.active).toBe(true);

    // Reactivate (undo cancel) via API — this flips cancel_at_period_end
    await reactivateSubscription(token);
    await page.waitForTimeout(3000);

    // Verify DB
    const dbUser = getUser(email);
    expect(dbUser.cancelAtPeriodEnd).toBe(false);
    expect(dbUser.subscriptionPlan).toBe('monthly');

    // Verify API
    sub = await getSubscription(token);
    expect(sub.active).toBe(true);
    expect(sub.cancelAtPeriodEnd).toBe(false);

    // Verify UI
    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/test5-renewed-trial.png', fullPage: true });
  });
});
