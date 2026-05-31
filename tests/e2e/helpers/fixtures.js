/**
 * Test fixtures — shared utilities for generating test data.
 */

export function uniqueEmail(prefix = 'e2e') {
  return `e2e-money-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@properbackup.dev`;
}

export const TEST_PASSWORD = process.env.PROPERBACKUP_TEST_ACCOUNT_PASSWORD || 'E2eTestPass123!';

export const BASE_URL = process.env.E2E_BASE_URL || 'http://properbackup-test-server.softify.com.pl';
