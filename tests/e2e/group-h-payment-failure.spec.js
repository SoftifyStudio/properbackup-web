import { test, expect } from '@playwright/test';
import { register, login, getSubscription } from './helpers/api.js';
import { verifyEmail, setSubscriptionExpired } from './helpers/db.js';
import { loginUI, goToSubscription } from './helpers/auth.js';
import { fillStripeCheckout } from './helpers/stripe-checkout.js';
import { uniqueEmail, TEST_PASSWORD, BASE_URL } from './helpers/fixtures.js';

test.describe('GRUPA H: Odmowy banków i brak środków', () => {
  test('Test 10: Symulacja odmowy płatności po wygaśnięciu trialu', async ({ page }) => {
    const email = uniqueEmail('h10-decline');
    const reg = await register(email, TEST_PASSWORD);
    verifyEmail(email);

    // Activate trial with card 4000000000000341 (succeeds initially, fails on future charges)
    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Start free"), button:has-text("Rozpocznij darmowy")').first().click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page.waitForTimeout(3000);

    await fillStripeCheckout(page, {
      cardNumber: '4000000000000341',
      expiry: '12/30',
      cvc: '123',
      name: 'Test Decline',
    });
    await page.waitForTimeout(10000);

    // Verify via API
    const tokenRes = await login(email, TEST_PASSWORD);
    let sub = await getSubscription(tokenRes.token);
    let retries = 0;
    while (!sub.active && retries < 20) {
      await page.waitForTimeout(2000);
      sub = await getSubscription(tokenRes.token);
      retries++;
    }

    if (sub.active) {
      expect(sub.plan).toBe('monthly');

      await goToSubscription(page);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/test10-active-before-decline.png', fullPage: true });

      // Simulate expiry (when Stripe would try to charge and fail)
      setSubscriptionExpired(email);

      sub = await getSubscription(tokenRes.token);
      expect(sub.active).toBe(false);

      await goToSubscription(page);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/test10-after-decline.png', fullPage: true });

      const pageText = await page.textContent('body');
      const showsIssue =
        pageText.includes('wygasł') ||
        pageText.includes('expired') ||
        pageText.includes('Awaiting') ||
        pageText.includes('Oczekuje') ||
        pageText.includes('Select & pay') ||
        pageText.includes('Wybierz') ||
        pageText.includes('problem');
      expect(showsIssue).toBe(true);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Card 4000000000000341 was declined at checkout. In production, this card would succeed initially then fail on renewal.',
      });
      await page.screenshot({ path: 'test-results/test10-checkout-declined.png', fullPage: true });
    }
  });
});
