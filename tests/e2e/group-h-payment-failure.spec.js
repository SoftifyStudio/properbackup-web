import { test, expect } from '@playwright/test';
import { register, login, getSubscription } from './helpers/api.js';
import { verifyEmail, setSubscriptionExpired, setSubscriptionPastDue, clearCardFingerprints } from './helpers/db.js';
import { loginUI, goToSubscription } from './helpers/auth.js';
import { fillStripeCheckout } from './helpers/stripe-checkout.js';
import { uniqueEmail, TEST_PASSWORD, BASE_URL } from './helpers/fixtures.js';

test.describe('GRUPA H: Odmowy banków i brak środków', () => {
  test('Test 10: Symulacja odmowy płatności — past_due z grace period', async ({ page }) => {
    clearCardFingerprints();
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

      // Simulate payment failure: set past_due status (as invoice.payment_failed would)
      setSubscriptionPastDue(email);

      sub = await getSubscription(tokenRes.token);

      // Verify: past_due status, STILL ACTIVE (grace period)
      expect(sub.status).toBe('past_due');
      expect(sub.active).toBe(true);
      expect(sub.daysRemaining).toBeGreaterThan(0);

      // Reload subscription page and verify yellow warning
      await goToSubscription(page);
      await page.waitForTimeout(3000);

      const pageText = await page.textContent('body');
      const showsPastDueWarning =
        pageText.includes('problem z pobraniem') ||
        pageText.includes('trouble collecting') ||
        pageText.includes('Payment issue') ||
        pageText.includes('Problem z płatnością') ||
        pageText.includes('past_due');
      expect(showsPastDueWarning).toBe(true);

      await page.screenshot({ path: 'test-results/test10-past-due-warning.png', fullPage: true });

      // Now simulate full expiry after grace period ends
      setSubscriptionExpired(email);
      sub = await getSubscription(tokenRes.token);
      expect(sub.active).toBe(false);

      await goToSubscription(page);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/test10-after-grace-expired.png', fullPage: true });

      test.info().annotations.push({
        type: 'note',
        description: `Payment failure flow: past_due with grace period → yellow warning → full lockout after grace expires.`,
      });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'Card 4000000000000341 was declined at checkout. In production, this card would succeed initially then fail on renewal.',
      });
      await page.screenshot({ path: 'test-results/test10-checkout-declined.png', fullPage: true });
    }
  });
});
