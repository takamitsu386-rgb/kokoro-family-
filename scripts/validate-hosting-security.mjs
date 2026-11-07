import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
const rules = config.hosting?.headers;
assert.ok(Array.isArray(rules), 'Firebase Hosting security headers must be configured.');
const wildcard = rules.find(rule => rule.source === '**');
assert.ok(wildcard && Array.isArray(wildcard.headers),
  'Baseline security headers must apply to all hosted app resources.');
const headers = new Map(wildcard.headers.map(({ key, value }) => [key.toLowerCase(), value]));
for (const [key, expected] of [
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['permissions-policy', 'camera=(), microphone=(), geolocation=()'],
  ['strict-transport-security', 'max-age=31536000']
]) {
  assert.equal(headers.get(key), expected, 'Missing or incorrect Hosting security header: ' + key);
}
console.log('Firebase Hosting baseline security headers passed.');
