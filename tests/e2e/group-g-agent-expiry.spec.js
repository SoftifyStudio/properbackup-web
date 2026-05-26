import { test, expect } from '@playwright/test';
import { register, login, getSubscription } from './helpers/api.js';
import { verifyEmail, setSubscriptionExpired } from './helpers/db.js';
import { loginUI, goToSubscription } from './helpers/auth.js';
import { fillStripeCheckout } from './helpers/stripe-checkout.js';
import { uniqueEmail, TEST_PASSWORD, BASE_URL } from './helpers/fixtures.js';

test.describe('GRUPA G: Interakcja z agentem i wygasanie', () => {
  test('Test 9: Wygaśnięcie trialu — blokada dostępu i UI', async ({ page }) => {
    const email = uniqueEmail('g9-expire');
    const reg = await register(email, TEST_PASSWORD);
    verifyEmail(email);

    // Activate trial
    await loginUI(page, email, TEST_PASSWORD);
    await goToSubscription(page);
    await page.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Start free"), button:has-text("Rozpocznij darmowy")').first().click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page.waitForTimeout(3000);
    await fillStripeCheckout(page);
    await page.waitForTimeout(10000);

    // Verify active state via API
    const tokenRes = await login(email, TEST_PASSWORD);
    let sub = await getSubscription(tokenRes.token);
    let retries = 0;
    while (!sub.active && retries < 20) {
      await page.waitForTimeout(2000);
      sub = await getSubscription(tokenRes.token);
      retries++;
    }
    expect(sub.active).toBe(true);
    expect(sub.plan).toBe('monthly');

    await goToSubscription(page);
    await page.screenshot({ path: 'test-results/test9-before-expire.png', fullPage: true });

    // Simulate expiry in DB
    setSubscriptionExpired(email);

    // Verify API returns inactive
    sub = await getSubscription(tokenRes.token);
    expect(sub.active).toBe(false);

    // Verify UI shows expiry
    await goToSubscription(page);
    await page.waitForTimeout(3000);
    const pageContent = await page.textContent('body');
    const hasExpiredIndicator =
      pageContent.includes('wygasł') ||
      pageContent.includes('expired') ||
      pageContent.includes('Awaiting') ||
      pageContent.includes('Oczekuje') ||
      pageContent.includes('pending') ||
      pageContent.includes('Select & pay') ||
      pageContent.includes('Wybierz');
    expect(hasExpiredIndicator).toBe(true);

    await page.screenshot({ path: 'test-results/test9-after-expire.png', fullPage: true });
  });
});
