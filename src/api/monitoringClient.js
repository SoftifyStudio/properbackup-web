/**
 * Client functions for monitoring, notifications, and backup scheduling.
 */
import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

function headers(token) {
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** GET /monitoring/servers — agent health status for all user's servers */
export async function fetchMonitoringServers(token) {
  const res = await fetch(`${BASE_URL}/monitoring/servers`, { headers: headers(token) });
  if (!res.ok) throw new Error(`monitoring failed: ${res.status}`);
  return res.json();
}

/** GET /notifications/settings */
export async function fetchNotificationSettings(token) {
  const res = await fetch(`${BASE_URL}/notifications/settings`, { headers: headers(token) });
  if (!res.ok) throw new Error(`notification settings failed: ${res.status}`);
  return res.json();
}

/** POST /notifications/settings */
export async function updateNotificationSettings(token, settings) {
  const res = await fetch(`${BASE_URL}/notifications/settings`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`update notification settings failed: ${res.status}`);
  return res.json();
}

/** GET /servers/{id}/backup-schedule */
export async function fetchBackupSchedule(serverId, token) {
  const res = await fetch(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/backup-schedule`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`backup schedule failed: ${res.status}`);
  return res.json();
}

/** POST /servers/{id}/backup-schedule */
export async function updateBackupSchedule(serverId, token, schedule) {
  const res = await fetch(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/backup-schedule`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(schedule),
  });
  if (!res.ok) throw new Error(`update backup schedule failed: ${res.status}`);
  return res.text();
}

/** GET /account/storage — storage quota */
export async function fetchStorageQuota(token) {
  const res = await fetch(`${BASE_URL}/account/storage`, { headers: headers(token) });
  if (!res.ok) throw new Error(`storage quota failed: ${res.status}`);
  return res.json();
}
