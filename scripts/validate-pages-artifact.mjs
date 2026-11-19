import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const workflow = readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
const html = readFileSync('index.html', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
const serviceWorker = readFileSync('sw.js', 'utf8');

assert.ok(!/^permissions:\s*\n(?:  .*\n)+/m.test(workflow),
  'Pages write and OIDC permissions must not be granted at workflow scope.');
assert.ok(/  build:\s*\n    # The build only reads source and the existing Pages configuration\.\s*\n    permissions:\s*\n      contents: read\s*\n      pages: read/m.test(workflow),
  'Pages build must have only source-read and Pages-read permissions.');
assert.ok(/  deploy:\s*\n    # Only the gated deployment job receives Pages deployment and OIDC permissions\.\s*\n    permissions:\s*\n      pages: write\s*\n      id-token: write/m.test(workflow),
  'Only the gated deploy job may receive Pages-write and OIDC permissions.');
assert.ok(workflow.includes('mkdir -p _site') &&
  workflow.includes('cp index.html manifest.webmanifest icon.svg sw.js _site/'),
  'Pages build must stage only the four required static app files.');
assert.ok(workflow.includes("if: ${{ github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/development-kokoro-app' && vars.KOKORO_PUBLIC_RELEASE_APPROVED == 'true' }}"),
  'Public Pages deployment must require manual dispatch from the release branch and explicit release approval.');
assert.ok(workflow.includes('uses: actions/upload-pages-artifact@v3') &&
  workflow.includes('path: _site'),
  'Pages artifact must upload the staging directory, never the repository root.');
assert.ok(!workflow.includes('path: .\n'),
  'Pages workflow must not publish the full repository root.');
assert.ok(manifest.start_url === './' && manifest.scope === './',
  'PWA manifest must remain relative to the project Pages subpath.');
assert.ok(html.includes('rel="manifest"') && html.includes('href="./manifest.webmanifest"'),
  'The app must reference its staged manifest.');
assert.ok(serviceWorker.includes('const APP_SHELL=["./","./index.html","./manifest.webmanifest","./icon.svg"]'),
  'The service worker app shell must use files included in the Pages artifact.');

console.log('GitHub Pages artifact is restricted to the static app shell and requires manual release dispatch.');
