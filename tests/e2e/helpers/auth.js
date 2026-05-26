/**
 * Browser auth helpers — login/register via UI.
 */
import { BASE_URL } from './fixtures.js';

export async function loginUI(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Check if already logged in (redirected to panel)
  if (page.url().includes('/panel') || page.url().includes('/servers')) {
    return; // Already logged in
  }

  const emailInput = page.locator('input[autocomplete="username"]');
  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailInput.fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('form button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
  }
}

export async function goToSubscription(page) {
  await page.goto(`${BASE_URL}/account/subscription`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}
