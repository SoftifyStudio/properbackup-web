/**
 * Helper to fill in Stripe Checkout form with test card.
 */
export async function fillStripeCheckout(page, {
  cardNumber = '4242424242424242',
  expiry = '12/30',
  cvc = '123',
  name = 'Test User',
  zip = '10001',
} = {}) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Uncheck "Save my information" (Stripe Link)
  const saveCheckbox = page.locator('#enableStripePass');
  if (await saveCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (await saveCheckbox.isChecked()) {
      await saveCheckbox.uncheck();
      await page.waitForTimeout(1000);
    }
  }

  // Card number
  const cardInput = page.locator('#cardNumber, input[name="cardNumber"]');
  await cardInput.waitFor({ state: 'visible', timeout: 15_000 });
  await cardInput.click();
  for (const digit of cardNumber) {
    await page.keyboard.type(digit, { delay: 50 });
  }
  await page.waitForTimeout(500);

  // Expiry
  const expiryInput = page.locator('#cardExpiry, input[name="cardExpiry"]');
  await expiryInput.click();
  for (const ch of expiry) {
    await page.keyboard.type(ch, { delay: 50 });
  }
  await page.waitForTimeout(500);

  // CVC
  const cvcInput = page.locator('#cardCvc, input[name="cardCvc"]');
  await cvcInput.click();
  for (const ch of cvc) {
    await page.keyboard.type(ch, { delay: 50 });
  }
  await page.waitForTimeout(500);

  // Name
  const nameInput = page.locator('#billingName, input[name="billingName"]');
  if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nameInput.fill(name);
  }
  await page.waitForTimeout(500);

  // ZIP
  const zipInput = page.locator('#billingPostalCode, input[name="billingPostalCode"]');
  if (await zipInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await zipInput.fill(zip);
  }
  await page.waitForTimeout(1000);

  // Submit
  const submitBtn = page.locator('button:has-text("Start trial"), button:has-text("Subscribe"), button:has-text("Pay")').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await submitBtn.click();

  // Wait for redirect back
  await page.waitForURL(/properbackup|softify/, { timeout: 90_000 });
}

/**
 * Fill Stripe Checkout with a card that will be DECLINED.
 * Does NOT wait for redirect — waits for the decline error message on Stripe's page.
 * Returns the error text shown by Stripe.
 */
export async function fillStripeCheckoutExpectDecline(page, {
  cardNumber = '4000000000000002',
  expiry = '12/30',
  cvc = '123',
  name = 'Test User',
  zip = '10001',
} = {}) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  const saveCheckbox = page.locator('#enableStripePass');
  if (await saveCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (await saveCheckbox.isChecked()) {
      await saveCheckbox.uncheck();
      await page.waitForTimeout(1000);
    }
  }

  const cardInput = page.locator('#cardNumber, input[name="cardNumber"]');
  await cardInput.waitFor({ state: 'visible', timeout: 15_000 });
  await cardInput.click();
  for (const digit of cardNumber) {
    await page.keyboard.type(digit, { delay: 50 });
  }
  await page.waitForTimeout(500);

  const expiryInput = page.locator('#cardExpiry, input[name="cardExpiry"]');
  await expiryInput.click();
  for (const ch of expiry) {
    await page.keyboard.type(ch, { delay: 50 });
  }
  await page.waitForTimeout(500);

  const cvcInput = page.locator('#cardCvc, input[name="cardCvc"]');
  await cvcInput.click();
  for (const ch of cvc) {
    await page.keyboard.type(ch, { delay: 50 });
  }
  await page.waitForTimeout(500);

  const nameInput = page.locator('#billingName, input[name="billingName"]');
  if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nameInput.fill(name);
  }
  await page.waitForTimeout(500);

  const zipInput = page.locator('#billingPostalCode, input[name="billingPostalCode"]');
  if (await zipInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await zipInput.fill(zip);
  }
  await page.waitForTimeout(1000);

  const submitBtn = page.locator('button:has-text("Start trial"), button:has-text("Subscribe"), button:has-text("Pay")').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await submitBtn.click();

  // Wait for decline error to appear (Stripe shows error inline, no redirect)
  // After submit, button shows "Processing" temporarily, then error message appears.
  // Some cards (expired, CVC) show errors immediately before/after submit.
  await page.waitForTimeout(8000);

  // Stripe shows errors in various containers. Search broadly for error text.
  const errorLocator = page.locator(
    ':text-matches("declined|error occurred|insufficient|expired|incorrect|security code|processing your card|unable to process|different card|can.t be used", "i"):not(button)'
  ).first();
  await errorLocator.waitFor({ state: 'visible', timeout: 30_000 });
  const errorText = await errorLocator.textContent();
  return errorText;
}
