import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const functions = readFileSync('functions/index.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
const indexes = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));

const start = functions.indexOf('exports.searchPublicProfiles = onRequest(');
const end = functions.indexOf('const reportReviewStatuses', start);
assert.ok(start >= 0 && end > start, 'Public profile search endpoint must exist.');
const endpoint = functions.slice(start, end);
assert.match(endpoint, /verifyIdToken\(match\[1\], true\)/, 'Search requires a non-revoked Firebase ID token.');
assert.match(endpoint, /prefix\.length < 2 \|\| prefix\.length > 24/, 'Search prefix must be bounded.');
assert.match(endpoint, /where\("visibility", "==", "public"\)/, 'Only public profiles may be searched.');
assert.match(endpoint, /orderBy\("nickname"\)[\s\S]*?startAt\(prefix\)[\s\S]*?endAt\(prefix \+ "\\uf8ff"\)[\s\S]*?limit\(30\)/, 'Search must fetch a bounded candidate set for post-query block filtering.');
assert.match(endpoint, /candidates\.filter\([\s\S]*?\)\.slice\(0, 10\)/, 'Search must return at most ten profiles after reverse-block filtering.');
assert.match(endpoint, /count >= 30/, 'Daily search rate limit must be enforced.');
assert.match(endpoint, /viewerBlocks\.docs\.some/, 'The viewer block list must be excluded.');
assert.match(endpoint, /users\/\$\{item\.id\}\/blocks\/\$\{decoded\.uid\}/, 'Reverse blocks must be excluded.');
assert.match(endpoint, /uid: item\.id,[\s\S]*?nickname:[\s\S]*?avatarId:/, 'Only UID, nickname, and allowlisted avatar are returned.');
assert.doesNotMatch(endpoint, /email|phone|address|photoURL/, 'Contact information must never be returned.');

const rewrite = firebase.hosting?.rewrites?.find(item => item.source === '/api/sns-search-profiles');
assert.equal(rewrite?.function?.functionId, 'searchPublicProfiles', 'Hosting rewrite must target profile search.');
assert.equal(rewrite?.function?.region, 'asia-northeast1', 'Profile search must use the Functions region.');
assert.ok(indexes.indexes.some(item =>
  item.collectionGroup === 'profiles'
  && item.fields.some(field => field.fieldPath === 'visibility')
  && item.fields.some(field => field.fieldPath === 'nickname')
), 'Profile prefix search composite index must exist.');

for (const id of ['snsProfileSearchInput', 'snsProfileSearchButton', 'snsProfileSearchStatus', 'snsProfileSearchResults']) {
  assert.match(html, new RegExp('id="' + id + '"'), 'Profile search UI element missing: ' + id);
}
assert.match(html, /fetch\("\/api\/sns-search-profiles"/, 'Client must call the authenticated search endpoint.');
assert.match(html, /snsFriendUid\.value = item\.uid/, 'Search result must only prefill the friend request target.');
assert.match(html, /snsAuthGeneration !== authGeneration/, 'Search results must be isolated across account switches.');

console.log('Public profile search privacy, rate limit, block filtering, indexes, and UI checks passed.');
