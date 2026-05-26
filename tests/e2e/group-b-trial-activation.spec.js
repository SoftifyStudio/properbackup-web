import { test, expect } from '@playwright/test';
import { register, getSubscription, createCheckout } from './helpers/api.js';
import { getUser, verifyEmail } from './helpers/db.js';
import { loginUI, goToSubscription } from './helpers/auth.js';
import { fillStripeCheckout } from './helpers/stripe-checkout.js';
import { uniqueEmail, TEST_PASSWORD, BASE_URL } from './helpers/fixtures.js';

test.describe('GRUPA B: Aktywacja trialu i Stripe Checkout', () => {
  test('Test 2: Generowanie sesji Checkout z parametrami Trial', async ({ page }) => {
    const email = uniqueEmail('b2-checkout');
    const reg = await register(email, TEST_PASSWORD);
    verifyEmail(email);

    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);

    // Check consent checkbox
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(500);

    // Verify trial button is now enabled
    const trialBtn = page.locator('button:has-text("Start free"), button:has-text("Rozpocznij darmowy")');
    await expect(trialBtn.first()).toBeEnabled();

    // Verify via API that checkout session has trial params
    const checkout = await createCheckout(reg.token, 'monthly');
    expect(checkout.checkoutUrl).toContain('checkout.stripe.com');
    expect(checkout.sessionId).toBeTruthy();

    await page.screenshot({ path: 'test-results/test2-checkout-ready.png', fullPage: true });
  });

  test('Test 3: Pomyślna płatność kartą testową i aktywacja usług', async ({ page }) => {
    const email = uniqueEmail('b3-pay');
    const reg = await register(email, TEST_PASSWORD);
    verifyEmail(email);

    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(500);

    // Click trial button
    const trialBtn = page.locator('button:has-text("Start free"), button:has-text("Rozpocznij darmowy")');
    await trialBtn.first().click();

    // Should redirect to Stripe
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page.waitForTimeout(3000);

    // Fill Stripe Checkout
    await fillStripeCheckout(page);

    // Wait for redirect + webhook
    await page.waitForTimeout(5000);

    // Verify DB
    let dbUser = getUser(email);
    let retries = 0;
    while (!dbUser?.subscriptionPlan && retries < 15) {
      await page.waitForTimeout(2000);
      dbUser = getUser(email);
      retries++;
    }

    expect(dbUser.subscriptionPlan).toBe('monthly');
    expect(dbUser.subscriptionExpiresAt).toBeTruthy();
    expect(dbUser.everSubscribed).toBe(true);

    // Verify UI — blue banner should be gone
    await page.goto(`${BASE_URL}/account/subscription`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const banner = page.locator('text=/Provide a payment card|Podaj kartę płatniczą/');
    await expect(banner).not.toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/test3-active-trial.png', fullPage: true });
  });
});
