import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync("index.html", "utf8");
const start = html.indexOf("/* 今日の予定：お部屋データ・Firebase同期とは独立した端末内保存 */");
const end = html.indexOf("</script>", start);
assert.ok(start >= 0 && end > start, "The Today Plan module must exist.");
const module = html.slice(start, end);

for (const id of [
  "today-plan", "todayPlanTitle", "todayPlanDate", "todayTaskForm",
  "todayTaskInput", "todayTaskList", "todayTaskEmpty", "todayTaskStatus",
  "todayMiniSummary", "todayMiniList", "exportTodayTasks",
  "importTodayTasksFile", "importTodayTasksPreview", "importTodayTasksButton",
  "deleteTodayTasks"
]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Missing Today Plan UI element: " + id);
}
assert.match(html, /href="#today-plan"/, "Today Plan must be reachable from app navigation.");
assert.match(html, /class="today-preview"/, "The home screen must show the Today Plan preview.");
assert.match(html, /予定データはこの端末内に保存されます/, "Local-only storage behavior must be disclosed.");
assert.match(html, /住所・電話番号・学校名などの個人情報は書かない/, "The task form must discourage entering identifying information.");

assert.match(module, /const STORAGE_KEY="kokoroTodayTasksV1"/, "Today Plan must use its own storage key.");
assert.match(module, /function validStore\(/, "Stored and imported task data must be validated.");
assert.match(module, /dates\.length>10000/, "The number of stored dates must be bounded.");
assert.match(module, /value\.days\[date\]\.length>1000/, "Tasks per day must be bounded.");
assert.match(module, /task\.title\.length>80/, "Task titles must be bounded.");
assert.match(module, /new TextEncoder\(\)\.encode\(raw\)\.length>512\*1024/, "Local storage size must be bounded.");
assert.match(module, /if\(request!==importRequest\)return/, "Stale file reads must not overwrite a newer import selection.");
assert.match(module, /new Blob\(\[JSON\.stringify\(payload,null,2\)\]/, "Task export must use a JSON file.");
assert.match(module, /if\(!confirm\("ファイル内の予定/, "Replacing existing task data must require confirmation.");
assert.match(module, /if\(!confirm\("今日だけでなく/, "Deleting all task data must require confirmation.");
assert.match(module, /localStorage\.removeItem\(STORAGE_KEY\)/, "The delete action must target only the Today Plan storage key.");
assert.match(module, /title\.textContent=task\.title/, "Task titles must be rendered as text.");
assert.doesNotMatch(module, /\.innerHTML\s*=|insertAdjacentHTML\s*\(/, "Task data must not be inserted as HTML.");

console.log("Today Plan UI, local storage, validation, import/export, and privacy checks passed.");
