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
assert.match(source, /new Set\(\["reviewed",\s*"actioned",\s*"dismissed"\]\)/,
  'The server must allow only the three supported terminal review states.');
assert.match(source, /\.where\("status",\s*"==",\s*status\)\s*\.orderBy\("createdAt",\s*"desc"\)\s*\.limit\(50\)/,
  'Report listing must be status-filtered, newest-first, and capped.');
const indexes = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));
assert.ok(indexes.indexes.some(index =>
  index.collectionGroup === 'reports' &&
  index.queryScope === 'COLLECTION' &&
  JSON.stringify(index.fields) === JSON.stringify([
    { fieldPath: 'status', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'DESCENDING' }
  ])
), 'The report queue composite index must match its status/newest-first query.');
assert.equal(config.firestore?.indexes, 'firestore.indexes.json',
  'Firebase must be configured to deploy the report queue composite index.');
assert.match(source, /tx\.get\(reportRef\)[\s\S]*?snapshot\.data\(\)\.status !== "pending"/,
  'Only pending reports may be reviewed.');
assert.match(source, /reviewedBy:\s*admin\.uid[\s\S]*?reviewedAt:\s*Timestamp\.now\(\)/,
  'Review actions must record the reviewer and timestamp.');
assert.doesNotMatch(source, /setCustomUserClaims|admin:\s*true/,
  'Application endpoints must never grant admin privileges.');
for (const [path, functionId] of [
  ['/api/submit-report', 'submitReport'],
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
assert.match(html, /id="snsAdminFilter"[\s\S]*?value="pending"[\s\S]*?value="reviewed"[\s\S]*?value="actioned"[\s\S]*?value="dismissed"/,
  'The admin review panel must expose all supported report review states.');
assert.match(html, /snsAdminFilter\.addEventListener\("change"/,
  'Changing the report review state must reload the selected queue.');
assert.match(html, /if \(report\.status === "pending"\)[\s\S]*?admin\/update-report/,
  'Only pending reports may show review action buttons.');
assert.match(html, /tokenInfo\.claims\?\.admin === true[\s\S]*?snsAdminPanel\.hidden = false/,
  'The admin review panel must be revealed only after a verified admin claim is read.');
assert.match(html, /fetch\(path,\s*\{[\s\S]*?Authorization.*Bearer/,
  'Admin requests must send the signed-in Firebase ID token to the server.');
assert.match(html, /snsAdminRequest\("\/api\/admin\/reports"/,
  'The admin panel must load reports through the protected server endpoint.');
assert.match(html, /snsAdminRequest\("\/api\/admin\/update-report"/,
  'The admin panel must update reports through the protected server endpoint.');

// Report submission must remain authenticated, bounded, and server-only.
assert.match(source, /exports\.submitReport = onRequest\(/,
  'Report submission must be handled by a server-side endpoint.');
assert.match(source, /verifyIdToken\(match\[1\], true\)/,
  'Report submission must verify the Firebase ID token and revocation.');
assert.match(source, /targetUid === decoded\.uid/,
  'Users must not be able to report themselves.');
assert.match(source, /reportCategories\.has\(category\)/,
  'Report reasons must use the server-side allowlist.');
assert.match(source, /timeZone:\s*"Asia\/Tokyo"/,
  'The daily report quota must use the Tokyo calendar day.');
assert.match(source, /if \(count >= 5\) return false/,
  'The report endpoint must enforce the daily per-user quota.');
assert.match(source, /tx\.create\(reportRef/,
  'Report creation and quota accounting must be atomic.');
assert.match(source, /if \(req\.method !== "POST"\)[\s\S]*?405/,
  'Report and admin endpoints must reject non-POST requests.');
assert.match(source, /origin && !allowedOrigins\.has\(origin\)/,
  'Report and admin endpoints must reject unapproved browser origins.');
assert.match(source, /await getAuth\(\)\.getUser\(targetUid\)/,
  'A report target must identify an existing Firebase user.');
assert.match(source, /Number\.isSafeInteger\(storedCount\)[\s\S]*?\? storedCount : 5/,
  'Malformed daily quota counters must fail closed.');
assert.match(source, /if \(count >= 5\) return false/,
  'The quota limit must be checked inside the same transaction as report creation.');
const rules = readFileSync('firestore.rules', 'utf8');
assert.match(rules, /match \/reports\/\{reportId\}\s*\{\s*allow read, write: if false;/,
  'Clients must not read or modify report records.');
assert.match(rules, /match \/users\/\{userId\}\/reportUsage\/\{dayKey\}\s*\{\s*allow read, write: if false;/,
  'Clients must not inspect or alter report quota counters.');

const reportHandlerStart = html.indexOf('snsSubmitReport.addEventListener("click"');
const reportHandlerEnd = html.indexOf('snsSaveProfile.addEventListener("click"', reportHandlerStart);
assert.ok(reportHandlerStart >= 0 && reportHandlerEnd > reportHandlerStart,
  'The SNS report submission handler must exist.');
const reportHandler = html.slice(reportHandlerStart, reportHandlerEnd);
assert.ok(reportHandler.includes('if (!snsUser || snsUser.uid !== user.uid) return;') &&
  reportHandler.indexOf('await fetch("/api/submit-report"') < reportHandler.indexOf('const data = await response.json()'),
  'Report responses must be discarded before parsing when the signed-in account changes.');
const reportCatchIndex = reportHandler.indexOf('catch (error) {');
const reportCatch = reportHandler.slice(reportCatchIndex);
assert.ok(reportCatchIndex >= 0 &&
  reportCatch.includes('if (!snsUser || snsUser.uid !== user.uid) return;') &&
  reportCatch.includes('snsReportNotice.textContent = error.message'),
  'Report errors must not overwrite the notice belonging to a newly signed-in account.');

// User-controlled SNS content and identifiers must be rendered as text, never parsed as HTML.
const postRendererStart = html.indexOf('function snsRenderPosts(items)');
const postRendererEnd = html.indexOf('\nasync function snsLoadProfile', postRendererStart);
assert.ok(postRendererStart >= 0 && postRendererEnd > postRendererStart,
  'The SNS post renderer must exist.');
const postRenderer = html.slice(postRendererStart, postRendererEnd);
assert.match(postRenderer, /body\.textContent = item\.text/,
  'SNS post text must be inserted as plain text.');
assert.doesNotMatch(postRenderer, /innerHTML|insertAdjacentHTML/,
  'SNS post content must never be interpreted as markup.');

const adminRendererStart = html.indexOf('function snsRenderAdminReports(reports)');
const adminRendererEnd = html.indexOf('\nasync function snsLoadAdminReports', adminRendererStart);
assert.ok(adminRendererStart >= 0 && adminRendererEnd > adminRendererStart,
  'The admin report renderer must exist.');
const adminRenderer = html.slice(adminRendererStart, adminRendererEnd);
assert.match(adminRenderer, /heading\.textContent = snsReportCategoryLabels\[report\.category\]/,
  'Report categories must be rendered as plain text.');
assert.match(adminRenderer, /detail\.textContent = .*report\.reporterUid.*report\.targetUid/,
  'Report identifiers must be rendered as plain text.');
assert.doesNotMatch(adminRenderer, /innerHTML|insertAdjacentHTML/,
  'Report metadata must never be interpreted as markup.');

const blockRendererStart = html.indexOf('async function snsLoadBlocks(user, authGeneration = snsAuthGeneration)');
const blockRendererEnd = html.indexOf('\nasync function snsEditPost', blockRendererStart);
assert.ok(blockRendererStart >= 0 && blockRendererEnd > blockRendererStart,
  'The block-list renderer must exist.');
const blockRenderer = html.slice(blockRendererStart, blockRendererEnd);
assert.match(blockRenderer, /label\.textContent = snapshot\.id/,
  'Blocked user identifiers must be rendered as plain text.');
assert.doesNotMatch(blockRenderer, /innerHTML|insertAdjacentHTML/,
  'Blocked user identifiers must never be interpreted as markup.');


assert.match(html, /let snsAdminLoadGeneration = 0/,
  'Admin report queue loads must have an independent latest-request generation.');
assert.match(html, /snsAdminLoadGeneration !== loadGeneration/,
  'Older admin report queue responses must not overwrite a newer filter or refresh result.');
assert.match(html, /snsAuthGeneration !== authGeneration \\|\\| snsAdminLoadGeneration !== loadGeneration/,
  'Admin report queue responses must be discarded after same-UID auth transitions.');
assert.match(html, /snsAdminUpdatingReports\\.has\\(report\\.id\\)/,
  'Repeated review clicks for the same report must be blocked while its update is pending.');
assert.match(html, /snsAdminUpdatingReports\\.add\\(report\\.id\\)/,
  'A report must be locked before sending its review update.');
assert.match(html, /if \(snsAuthGeneration === authGeneration\) snsAdminUpdatingReports\.delete\(report\.id\)/,
  'An old auth session must not release a newer session report lock.');
assert.match(html, /snsAdminUpdatingReports\\.delete\\(report\\.id\\)/,
  'A report review lock must always be released after the request.');
assert.match(html, /snsAdminUpdatingReports\\.clear\\(\\)/,
  'Report review locks must be cleared when auth state changes.');

console.log('Report submission, admin authorization, and SNS text-rendering safety checks passed.');
