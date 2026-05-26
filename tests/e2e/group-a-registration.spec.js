import { test, expect } from '@playwright/test';
import { register, getSubscription } from './helpers/api.js';
import { getUser, verifyEmail } from './helpers/db.js';
import { loginUI, goToSubscription } from './helpers/auth.js';
import { uniqueEmail, TEST_PASSWORD, BASE_URL } from './helpers/fixtures.js';

test.describe('GRUPA A: Rejestracja i stan oczekiwania', () => {
  test('Test 1: Rejestracja nowego konta i stan braku dostępu (Pending Payment)', async ({ page }) => {
    const email = uniqueEmail('a1-register');

    // --- Step 1: Register via API ---
    const regResult = await register(email, TEST_PASSWORD);
    expect(regResult.token).toBeTruthy();
    expect(regResult.email).toBe(email);

    // --- Step 2: Verify email in DB (simulate email click) ---
    verifyEmail(email);

    // --- Step 3: Check DB — trial_expires_at should be NULL ---
    const dbUser = getUser(email);
    expect(dbUser).not.toBeNull();
    expect(dbUser.trialExpiresAt).toBeNull();
    expect(dbUser.subscriptionPlan).toBeNull();
    expect(dbUser.everSubscribed).toBe(false);

    // --- Step 4: Login via browser ---
    await loginUI(page, email, TEST_PASSWORD);

    // --- Step 5: Navigate to subscription ---
    await goToSubscription(page);

    // --- Step 6: Verify trial banner is visible (EN or PL) ---
    const banner = page.locator('text=/Provide a payment card|Podaj kartę płatniczą/');
    await expect(banner).toBeVisible({ timeout: 10_000 });

    // --- Step 7: Verify "Start free trial" button is disabled ---
    const trialBtn = page.locator('button:has-text("Start free"), button:has-text("Rozpocznij darmowy")');
    await expect(trialBtn.first()).toBeVisible();
    await expect(trialBtn.first()).toBeDisabled();

    // --- Step 8: Verify API returns trialEligible ---
    const sub = await getSubscription(regResult.token);
    expect(sub.status).toBe('pending_payment');
    expect(sub.plan).toBe('none');
    expect(sub.trialEligible).toBe(true);

    // --- Step 9: Verify subscription is not active ---
    expect(sub.active).toBe(false);

    await page.screenshot({ path: 'test-results/test1-pending-payment.png', fullPage: true });
  });
});
