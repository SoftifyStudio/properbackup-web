/**
 * Helper to fill in Stripe Checkout form with test card.
 * Works with Stripe's newer layout (direct inputs, no iframes).
 */
export async function fillStripeCheckout(page, {
  cardNumber = '4242424242424242',
  expiry = '12/30',
  cvc = '123',
  name = 'Test User',
  zip = '10001',
} = {}) {
  // Wait for Stripe checkout page to load
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Uncheck "Save my information" (Stripe Link) — it requires phone number
  const saveCheckbox = page.locator('#enableStripePass');
  if (await saveCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (await saveCheckbox.isChecked()) {
      await saveCheckbox.uncheck();
      await page.waitForTimeout(1000);
    }
  }

  // Card number field
  const cardInput = page.locator('#cardNumber, input[name="cardNumber"]');
  await cardInput.waitFor({ state: 'visible', timeout: 15_000 });
  await cardInput.click();
  for (const digit of cardNumber) {
    await page.keyboard.type(digit, { delay: 50 });
  }
  await page.waitForTimeout(500);

  // Expiry field
  const expiryInput = page.locator('#cardExpiry, input[name="cardExpiry"]');
  await expiryInput.click();
  for (const ch of expiry) {
    await page.keyboard.type(ch, { delay: 50 });
  }
  await page.waitForTimeout(500);

  // CVC field
  const cvcInput = page.locator('#cardCvc, input[name="cardCvc"]');
  await cvcInput.click();
  for (const ch of cvc) {
    await page.keyboard.type(ch, { delay: 50 });
  }
  await page.waitForTimeout(500);

  // Cardholder name
  const nameInput = page.locator('#billingName, input[name="billingName"]');
  if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nameInput.fill(name);
  }
  await page.waitForTimeout(500);

  // ZIP/Postal code (required for US)
  const zipInput = page.locator('#billingPostalCode, input[name="billingPostalCode"]');
  if (await zipInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await zipInput.fill(zip);
  }
  await page.waitForTimeout(1000);

  // Click "Start trial" / "Subscribe" / "Pay" button
  const submitBtn = page.locator('button:has-text("Start trial"), button:has-text("Subscribe"), button:has-text("Pay")').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await submitBtn.click();

  // Wait for processing + redirect back to our app
  await page.waitForURL(/properbackup|softify/, { timeout: 90_000 });
}
