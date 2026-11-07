import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('functions/index.js', 'utf8');
const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
const html = readFileSync('index.html', 'utf8');

assert.match(source, /async function verifyAdminRequest\(req, res\)/,
  'Admin endpoints must share the server-side authentication check.');
assert.match(source, /verifyIdToken\(match\[1\], true\)/,
  'Admin requests must verify token validity and revocation.');
assert.match(source, /decoded\.admin !== true/,
  'Only a verified Firebase admin custom claim may access reports.');
assert.match(source, /\.where\("status",\s*"==",\s*status\)\s*\.limit\(50\)/,
  'Report listing must be status-filtered and capped.');
assert.match(source, /tx\.get\(reportRef\)[\s\S]*?snapshot\.data\(\)\.status !== "pending"/,
  'Only pending reports may be reviewed.');
assert.match(source, /reviewedBy:\s*admin\.uid[\s\S]*?reviewedAt:\s*Timestamp\.now\(\)/,
  'Review actions must record the reviewer and timestamp.');
assert.doesNotMatch(source, /setCustomUserClaims|admin:\s*true/,
  'Application endpoints must never grant admin privileges.');
for (const [path, functionId] of [
  ['/api/admin/reports', 'adminListReports'],
  ['/api/admin/update-report', 'adminUpdateReport']
]) {
  const rewrite = config.hosting?.rewrites?.find(item => item.source === path);
  assert.equal(rewrite?.function?.functionId, functionId,
    `Missing Hosting rewrite for ${path}.`);
  assert.equal(rewrite?.function?.region, 'asia-northeast1',
    `Incorrect region for ${path}.`);
}

assert.match(html, /id="snsAdminPanel" hidden/,
  'The admin review panel must remain hidden by default.');
assert.match(html, /tokenInfo\.claims\?\.admin === true[\s\S]*?snsAdminPanel\.hidden = false/,
  'The admin review panel must be revealed only after a verified admin claim is read.');
assert.match(html, /fetch\(path,\s*\{[\s\S]*?Authorization.*Bearer/,
  'Admin requests must send the signed-in Firebase ID token to the server.');
assert.match(html, /snsAdminRequest\("\/api\/admin\/reports"/,
  'The admin panel must load reports through the protected server endpoint.');
assert.match(html, /snsAdminRequest\("\/api\/admin\/update-report"/,
  'The admin panel must update reports through the protected server endpoint.');

// Report submission must remain authenticated, bounded, and server-only.
assert.match(source, /exports\\.submitReport = onRequest\\(/,
  'Report submission must be handled by a server-side endpoint.');
assert.match(source, /verifyIdToken\\(match\\[1\\], true\\)/,
  'Report submission must verify the Firebase ID token and revocation.');
assert.match(source, /targetUid === decoded\\.uid/,
  'Users must not be able to report themselves.');
assert.match(source, /reportCategories\\.has\\(category\\)/,
  'Report reasons must use the server-side allowlist.');
assert.match(source, /timeZone:\\s*"Asia\\/Tokyo"/,
  'The daily report quota must use the Tokyo calendar day.');
assert.match(source, /if \\(count >= 5\\) return false/,
  'The report endpoint must enforce the daily per-user quota.');
assert.match(source, /tx\\.create\\(reportRef/,
  'Report creation and quota accounting must be atomic.');
const rules = readFileSync('firestore.rules', 'utf8');
assert.match(rules, /match \\/reports\\/\\{reportId\\}\\s*\\{\\s*allow read, write: if false;/,
  'Clients must not read or modify report records.');
assert.match(rules, /match \\/users\\/\\{userId\\}\\/reportUsage\\/\\{dayKey\\}\\s*\\{\\s*allow read, write: if false;/,
  'Clients must not inspect or alter report quota counters.');

console.log('Report submission protections and admin review authorization checks passed.');
