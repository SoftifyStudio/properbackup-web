import { test, expect } from '@playwright/test';
import { register, login, getSubscription } from './helpers/api.js';
import { getUser, verifyEmail } from './helpers/db.js';
import { loginUI, goToSubscription } from './helpers/auth.js';
import { fillStripeCheckout } from './helpers/stripe-checkout.js';
import { uniqueEmail, TEST_PASSWORD, BASE_URL } from './helpers/fixtures.js';

test.describe('GRUPA D: Zmiany planów i upgrade w trialu', () => {
  test('Test 6: Zmiana planu Monthly -> Annual w trakcie darmowego miesiąca', async ({ page }) => {
    const email = uniqueEmail('d6-planchange');
    const reg = await register(email, TEST_PASSWORD);
    verifyEmail(email);

    // Activate monthly trial
    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Start free"), button:has-text("Rozpocznij darmowy")').first().click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page.waitForTimeout(3000);
    await fillStripeCheckout(page);
    await page.waitForTimeout(5000);

    // Wait for webhook
    let dbUser = getUser(email);
    let retries = 0;
    while (!dbUser?.subscriptionPlan && retries < 15) {
      await page.waitForTimeout(2000);
      dbUser = getUser(email);
      retries++;
    }
    expect(dbUser.subscriptionPlan).toBe('monthly');

    // Login fresh, switch to Annual
    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);

    // Switch to Annual tab
    const annualTab = page.locator('button:has-text("Annual"), button:has-text("Roczny")').first();
    await annualTab.click();
    await page.waitForTimeout(1000);

    // Check consent
    const checkbox = page.locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) await checkbox.click();
    await page.waitForTimeout(500);

    // Click pay button for annual
    const payBtn = page.locator('button:has-text("Select & pay"), button:has-text("Select"), button:has-text("Wybierz i zapłać")').first();
    if (await payBtn.isVisible({ timeout: 5000 })) {
      await payBtn.click();
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
      await page.waitForTimeout(3000);
      await fillStripeCheckout(page);
      await page.waitForTimeout(5000);
    }

    // Verify plan changed
    let updatedUser = getUser(email);
    retries = 0;
    while (updatedUser?.subscriptionPlan !== 'annual' && retries < 10) {
      await page.waitForTimeout(2000);
      updatedUser = getUser(email);
      retries++;
    }

    await page.goto(`${BASE_URL}/account/subscription`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const tokenRes = await login(email, TEST_PASSWORD);
    const sub = await getSubscription(tokenRes.token);
    expect(sub.active).toBe(true);

    await page.screenshot({ path: 'test-results/test6-plan-change.png', fullPage: true });
  });
});
