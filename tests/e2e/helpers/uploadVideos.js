#!/usr/bin/env node
/**
 * Auto-upload Playwright videos to properbackup-docs repo.
 *
 * Usage:
 *   node tests/e2e/helpers/uploadVideos.js
 *
 * Copies .webm recordings from test-results/ to ../properbackup-docs/e2e-videos/recovery/
 * with proper naming (testNN-<description>.webm).
 */
import { readdirSync, copyFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';

const RESULTS_DIR = join(dirname(new URL(import.meta.url).pathname), '..', 'test-results', 'recovery-qa');
const DOCS_DIR = join(dirname(new URL(import.meta.url).pathname), '..', '..', '..', '..', 'properbackup-docs', 'e2e-videos', 'recovery');

// Map directory name fragments (from Playwright's truncated names) to test output names
// Order matters: more specific patterns first to avoid ambiguous matches
const KEYWORD_MAP = [
  { keywords: ['planning', 'modal'], name: 'test11-recovery-start' },
  { keywords: ['checkbox', 'dry'], name: 'test12-dry-run-preview' },
  { keywords: ['unaffected', 'lockdown'], name: 'test14-other-server-banner' },
  { keywords: ['cancelled', 'cancel'], name: 'test15-cancel-during-restoring' },
  { keywords: ['instant-ready', 'tier'], name: 'test16-cold-tier-thaw' },
  { keywords: ['concurrent', '409'], name: 'test17-concurrent-recovery-409' },
  { keywords: ['visible'], name: 'test18-pre-recovery-rollback' },  // before test13 (both have "done")
  { keywords: ['sha-256', 'verified'], name: 'test13-confirm-and-restore' },
];

function findVideos(dir) {
  const videos = [];
  if (!existsSync(dir)) return videos;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      videos.push(...findVideos(fullPath));
    } else if (entry.name === 'video.webm') {
      videos.push(fullPath);
    }
  }
  return videos;
}

function main() {
  console.log(`Scanning ${RESULTS_DIR} for videos...`);
  const videos = findVideos(RESULTS_DIR);
  console.log(`Found ${videos.length} video(s).`);

  if (!existsSync(DOCS_DIR)) {
    mkdirSync(DOCS_DIR, { recursive: true });
  }

  for (const videoPath of videos) {
    const parentDir = basename(dirname(videoPath));

    // Match test by keywords in directory name
    const dirLower = parentDir.toLowerCase();
    let matched = false;
    for (const { keywords, name } of KEYWORD_MAP) {
      if (keywords.some(k => dirLower.includes(k))) {
        const dest = join(DOCS_DIR, `${name}.webm`);
        copyFileSync(videoPath, dest);
        const size = statSync(dest).size;
        console.log(`  ${name}.webm (${(size / 1024).toFixed(1)} KB)`);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const dest = join(DOCS_DIR, `${parentDir}.webm`);
      copyFileSync(videoPath, dest);
      console.log(`  ${parentDir}.webm (unmatched)`);
    }
  }

  console.log(`\nVideos copied to: ${DOCS_DIR}`);
}

main();
