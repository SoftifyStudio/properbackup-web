/**
 * DB helper — runs SQL on the remote PostgreSQL via SSH + docker exec.
 */
import { execSync } from 'child_process';

const SSH_KEY = '/home/ubuntu/.ssh/tskey';
const SSH_CMD = `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no root@properbackup-test-server.softify.com.pl`;

export function sql(query) {
  const escaped = query.replace(/'/g, "'\\''");
  const cmd = `${SSH_CMD} "docker exec properbackup-db psql -U properbackup -t -A -c '${escaped}'"`;
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 15_000 }).trim();
  } catch (e) {
    console.error('SQL error:', e.message);
    return '';
  }
}

export function getUser(email) {
  const row = sql(
    `SELECT id, email, trial_expires_at, subscription_plan, subscription_expires_at, ever_subscribed, email_verified, stripe_customer_id, subscription_cancel_at_period_end, stripe_card_fingerprint, subscription_payment_status, stripe_subscription_id FROM users WHERE email = '${email}'`
  );
  if (!row) return null;
  const cols = row.split('|');
  return {
    id: cols[0],
    email: cols[1],
    trialExpiresAt: cols[2] || null,
    subscriptionPlan: cols[3] || null,
    subscriptionExpiresAt: cols[4] || null,
    everSubscribed: cols[5] === 't',
    emailVerified: cols[6] === 't',
    stripeCustomerId: cols[7] || null,
    cancelAtPeriodEnd: cols[8] === 't',
    stripeCardFingerprint: cols[9] || null,
    subscriptionPaymentStatus: cols[10] || null,
    stripeSubscriptionId: cols[11] || null,
  };
}

export function verifyEmail(email) {
  sql(`UPDATE users SET email_verified = TRUE WHERE email = '${email}'`);
}

export function setTrialExpired(email) {
  sql(`UPDATE users SET trial_expires_at = NOW() - INTERVAL '1 second' WHERE email = '${email}'`);
}

export function setSubscriptionExpired(email) {
  sql(`UPDATE users SET subscription_expires_at = NOW() - INTERVAL '1 second' WHERE email = '${email}'`);
}

export function setSubscriptionPastDue(email) {
  sql(`UPDATE users SET subscription_payment_status = 'past_due', subscription_expires_at = NOW() + INTERVAL '7 days' WHERE email = '${email}'`);
}

export function clearSubscriptionPaymentStatus(email) {
  sql(`UPDATE users SET subscription_payment_status = NULL WHERE email = '${email}'`);
}

export function getAuditLog(userId, action) {
  return sql(
    `SELECT action, details FROM subscription_audit_log WHERE user_id = '${userId}' AND action = '${action}' ORDER BY created_at DESC LIMIT 1`
  );
}

export function getStripeEventIdempotency(eventId) {
  return sql(
    `SELECT stripe_event_id FROM stripe_event_idempotency WHERE stripe_event_id = '${eventId}'`
  );
}

export function clearAllTestCardFingerprints() {
  sql(`UPDATE users SET stripe_card_fingerprint = NULL WHERE email LIKE 'e2e-money-%@properbackup.dev'`);
}

export function deleteUser(email) {
  const userId = sql(`SELECT id FROM users WHERE email = '${email}'`);
  if (userId) {
    sql(`DELETE FROM subscription_audit_log WHERE user_id = '${userId}'`);
    sql(`DELETE FROM stripe_event WHERE user_id = '${userId}'`);
    sql(`DELETE FROM users WHERE email = '${email}'`);
  }
}
