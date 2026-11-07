import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('functions/index.js', 'utf8');
const config = JSON.parse(readFileSync('firebase.json', 'utf8'));

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

console.log('Admin report review authorization and routing checks passed.');
