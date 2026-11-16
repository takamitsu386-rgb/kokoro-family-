import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('functions/index.js', 'utf8');
const html = readFileSync('index.html', 'utf8');

assert.match(source, /function snsFeatureEnabled\(res\)[\s\S]*?process\.env\.SNS_ENABLED === "true"[\s\S]*?return false;/,
  'SNS endpoints must fail closed unless an explicit release flag is enabled.');

for (const name of ['submitReport', 'publicTimeline', 'searchPublicProfiles']) {
  const start = source.indexOf(`exports.${name} = onRequest(`);
  assert.ok(start >= 0, `${name} endpoint must exist.`);
  const next = source.indexOf('\nexports.', start + 1);
  const endpoint = source.slice(start, next < 0 ? source.length : next);
  assert.match(endpoint, /if \(!snsFeatureEnabled\(res\)\) return;/,
    `${name} must be disabled until SNS safeguards and human moderation are ready.`);
}

assert.match(html, /id="sns"[^>]*hidden|id="sns"[^>]*aria-hidden="true"/,
  'SNS UI must remain hidden from the MVP navigation and page.');
console.log('SNS server-side fail-closed gates and hidden MVP UI checks passed.');
