import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const workflow = readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
const html = readFileSync('index.html', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
const serviceWorker = readFileSync('sw.js', 'utf8');

assert.match(workflow, /mkdir -p _site[\s\S]*?cp index\.html manifest\.webmanifest icon\.svg sw\.js _site\//,
  'Pages build must stage only the four required static app files.');
assert.match(workflow, /deploy:\s*\n\s*# Public deployment stays disabled until the release checklist is approved\.\n\s*if: \$\{\{\s*vars\.KOKORO_PUBLIC_RELEASE_APPROVED\s*==\s*'true'\s*\}\}/,
  'Public Pages deployment must require an explicit release approval variable.');
assert.match(workflow, /uses: actions\/upload-pages-artifact@v3[\s\S]*?with:[\s\S]*?path: _site(?:\n|$)/,
  'Pages artifact must upload the staging directory, never the repository root.');
assert.doesNotMatch(workflow, /path:\s*\.\s*(?:\n|$)/,
  'Pages workflow must not publish the full repository root.');
assert.ok(manifest.start_url === './' && manifest.scope === './',
  'PWA manifest must remain relative to the project Pages subpath.');
assert.match(html, /rel=["']manifest["'][^>]*href=["']\.\/manifest\.webmanifest["']/,
  'The app must reference its staged manifest.');
assert.match(serviceWorker, /const APP_SHELL\s*=\s*\["\.\/","\.\/index\.html","\.\/manifest\.webmanifest","\.\/icon\.svg"\]/,
  'The service worker app shell must use files included in the Pages artifact.');

console.log('GitHub Pages artifact is restricted to the static app shell and gated on release approval.');
