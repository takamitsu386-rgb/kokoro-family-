import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");

assert.match(html, /id="family-tasks"/, "family task section exists");
assert.match(html, /href="#family-tasks"/, "family task navigation exists");
assert.match(html, /id="familyTaskForm"/, "task form exists");
assert.match(html, /maxlength="80"/, "task title length is limited");
assert.match(html, /const LIMIT = 100/, "task count is bounded");
assert.match(html, /function validTask\(task\)/, "task schema is validated");
assert.match(html, /Object\.hasOwn\(categories, task\.category\)/, "task category is allowlisted");
assert.match(html, /Object\.hasOwn\(priorities, task\.priority\)/, "task priority is allowlisted");
assert.match(html, /title\.textContent = task\.title/, "task titles use safe text rendering");
assert.match(html, /checkbox\.addEventListener\("change"/, "tasks can be completed");
assert.match(html, /confirm\("「" \+ task\.title/, "task deletion is confirmed");
assert.match(html, /familyTaskClearDone/, "completed tasks can be cleared");
assert.match(html, /Task storage rollback failed/, "failed writes attempt rollback");
assert.match(html, /保存データに問題があるため、上書きせず保護しました/, "invalid stored data fails closed");
assert.match(html, /クラウド同期・家族間共有にはまだ対応していません/, "local-only scope is disclosed");
assert.match(sw, /kokoro-family-v194/, "service worker cache is refreshed");

console.log("Family task list source checks passed.");
