import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const functions = readFileSync('functions/index.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
const indexes = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));
const rules = readFileSync('firestore.rules', 'utf8');

const start = functions.indexOf('exports.publicTimeline = onRequest(');
const end = functions.indexOf('const reportReviewStatuses', start);
assert.ok(start >= 0 && end > start, 'The public timeline endpoint must exist before report-review handlers.');
const endpoint = functions.slice(start, end);
assert.match(endpoint, /verifyIdToken\(match\[1\], true\)/,
  'The timeline must verify the Firebase token and revocation state.');
assert.match(endpoint, /where\("visibility", "==", "public"\)/,
  'The timeline query must select public posts only.');
assert.match(endpoint, /where\("status", "==", "active"\)/,
  'Deleted posts must never enter the timeline.');
assert.match(endpoint, /orderBy\("createdAt", "desc"\)\s*\.limit\(50\)/,
  'The timeline must be newest-first and bounded to 50 source posts.');
assert.match(endpoint, /users"\)\.doc\(decoded\.uid\)\.collection\("blocks"\)/,
  'The viewer block list must be checked server-side.');
assert.match(endpoint, /users\/\$\{uid\}\/blocks\/\$\{decoded\.uid\}/,
  'The reverse block list must be checked server-side.');
assert.match(endpoint, /viewerBlocks\.has\(authorUid\) \|\| author\.blocksViewer\.exists/,
  'Either direction of a block must hide the post.');
assert.match(endpoint, /profile\.visibility !== "public"/,
  'Other users must have a public profile to appear in the feed.');
assert.match(endpoint, /nickname:[\s\S]*?avatarId,[\s\S]*?text: post\.text,[\s\S]*?createdAtMs:/,
  'The endpoint must return only the intended display fields.');
assert.doesNotMatch(endpoint, /email|phone|address/,
  'The public timeline must not return contact or address data.');

const rewrite = firebase.hosting?.rewrites?.find(item => item.source === '/api/sns-public-timeline');
assert.equal(rewrite?.function?.functionId, 'publicTimeline',
  'Hosting must route the timeline API to the correct function.');
assert.equal(rewrite?.function?.region, 'asia-northeast1',
  'The timeline rewrite must use the deployed Functions region.');
const timelineIndex = indexes.indexes.find(item =>
  item.collectionGroup === 'posts' &&
  item.fields.some(field => field.fieldPath === 'visibility') &&
  item.fields.some(field => field.fieldPath === 'status') &&
  item.fields.some(field => field.fieldPath === 'createdAt')
);
assert.ok(timelineIndex, 'A composite index must support public active posts ordered by creation time.');

assert.match(rules, /allow list: if signedIn\(\)\s*&&\s*resource\.data\.authorUid == request\.auth\.uid;/,
  'Direct client collection queries must remain owner-only; public feed access belongs on the filtered server endpoint.');
assert.match(html, /id="snsRefreshTimeline"/,
  'Signed-in users need a public timeline refresh control.');
assert.match(html, /id="snsTimelineList"/,
  'The public timeline needs a dedicated rendering target.');
assert.match(html, /async function snsLoadPublicTimeline\(user, authGeneration = snsAuthGeneration\)/,
  'The client timeline loader must be bound to the current auth generation.');
const loaderStart = html.indexOf('async function snsLoadPublicTimeline(');
const loaderEnd = html.indexOf('async function snsLoadBlocks(', loaderStart);
assert.ok(loaderStart >= 0 && loaderEnd > loaderStart, 'The client timeline loader must be bounded.');
const loader = html.slice(loaderStart, loaderEnd);
assert.match(loader, /await user\.getIdToken\(\)/,
  'Timeline requests must use the current Firebase ID token.');
assert.match(loader, /snsAuthGeneration !== authGeneration/,
  'A stale account generation must not render a timeline response.');
assert.match(html, /snsTimelineList\.replaceChildren\(\)/,
  'Timeline rendering must clear stale content before displaying new results.');
assert.match(html, /この投稿者を通報/,
  'Timeline cards must provide a direct reporting path for other users.');

console.log('Validated authenticated public timeline, two-way block filtering, public profile gating, routing, index, and client generation guards.');
