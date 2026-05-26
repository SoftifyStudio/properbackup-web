/**
 * DB helper — runs SQL on the remote PostgreSQL via SSH + docker exec.
 */
import { execSync } from 'child_process';

const SSH_CMD = 'ssh -i /home/ubuntu/.ssh/test_server_key_fixed -o StrictHostKeyChecking=no root@properbackup-test-server.softify.com.pl';

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
    `SELECT id, email, trial_expires_at, subscription_plan, subscription_expires_at, ever_subscribed, email_verified, stripe_customer_id, subscription_cancel_at_period_end FROM users WHERE email = '${email}'`
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

export function setTrialExpiresAt(email, timestamp) {
  sql(`UPDATE users SET trial_expires_at = '${timestamp}' WHERE email = '${email}'`);
}

export function setSubscriptionExpiresAt(email, timestamp) {
  sql(`UPDATE users SET subscription_expires_at = '${timestamp}' WHERE email = '${email}'`);
}

export function setSubscriptionPastDue(email) {
  // Set past_due status and extend expiry by 7 days (grace period)
  sql(`UPDATE users SET subscription_payment_status = 'past_due', subscription_expires_at = NOW() + INTERVAL '7 days' WHERE email = '${email}'`);
}

export function clearSubscriptionPaymentStatus(email) {
  sql(`UPDATE users SET subscription_payment_status = NULL WHERE email = '${email}'`);
}

export function clearCardFingerprints() {
  sql(`UPDATE users SET stripe_card_fingerprint = NULL`);
}

export function deleteUser(email) {
  sql(`DELETE FROM users WHERE email = '${email}'`);
}
