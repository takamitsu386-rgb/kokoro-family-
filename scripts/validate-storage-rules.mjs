import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../firebase.json", import.meta.url), "utf8"));
const rules = readFileSync(new URL("../storage.rules", import.meta.url), "utf8");

assert.equal(config.storage?.rules, "storage.rules",
  "Firebase config must deploy the explicit Storage rules file.");
assert.match(rules, /rules_version\s*=\s*'2'\s*;/);
assert.match(rules, /service\s+firebase\.storage\s*\{/);
assert.match(rules, /match\s+\/b\/\{bucket\}\/o\s*\{/);
assert.match(rules, /match\s+\/\{allPaths=\*\*\}\s*\{/);
assert.match(rules, /allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/);
assert.doesNotMatch(rules, /allow\s+(?:read|write|read\s*,\s*write)\s*:\s*if\s+true\b/);
console.log("Firebase Storage rules: configured and deny all client access.");
