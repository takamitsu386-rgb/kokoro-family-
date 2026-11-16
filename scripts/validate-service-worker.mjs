import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const sw = readFileSync('sw.js', 'utf8');

assert.match(sw, /const CACHE_NAME\s*=\s*"kokoro-family-v\d+"/,
  'The service worker cache must use a versioned app-specific name.');
assert.match(sw, /const CACHE_PREFIX\s*=\s*"kokoro-family-"/,
  'The service worker must use an app-specific cache prefix.');
assert.match(sw, /const APP_SHELL\s*=\s*\["\.\/","\.\/index\.html","\.\/manifest\.webmanifest","\.\/icon\.svg"\]/,
  'The offline app shell must include the entry page, manifest, and icon.');
assert.match(sw, /event\.waitUntil\(caches\.open\(CACHE_NAME\)\.then\(cache=>cache\.addAll\(APP_SHELL\)\)\)/,
  'Installation must wait for the app shell to be cached.');
assert.match(sw, /keys\.filter\(key=>key\.startsWith\(CACHE_PREFIX\)&&key!==CACHE_NAME\)/,
  'Activation may delete only outdated caches belonging to this app.');
assert.match(sw, /if\(event\.request\.method!=="GET"\|\|new URL\(event\.request\.url\)\.origin!==self\.location\.origin\)return/,
  'Non-GET and cross-origin requests must bypass the service worker cache.');
assert.match(sw, /if\(isAppNavigation\)[\s\S]*?fetch\(event\.request\)[\s\S]*?cache\.put\(event\.request,copy\)[\s\S]*?cache\.match\(event\.request\)[\s\S]*?cache\.match\("\.\/index\.html"\)/,
  'App navigation must prefer fresh content and fall back to cached app HTML offline.');
assert.match(sw, /cached\|\|fetch\(event\.request\)/,
  'Same-origin static resources must use cache-first retrieval.');
console.log('Service Worker cache isolation, app-shell install, request scope, and offline fallbacks passed.');
