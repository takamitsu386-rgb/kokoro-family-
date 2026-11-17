import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const marker = "/* 今日の予定：お部屋データ・Firebase同期とは独立した端末内保存 */";
const markerAt = html.indexOf(marker);
const scriptEnd = html.indexOf("</script>", markerAt);
assert.ok(markerAt >= 0 && scriptEnd > markerAt, "Today Plan module must be extractable.");
const source = html.slice(markerAt, scriptEnd);

class Element {
  constructor(id = "element") {
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.value = "";
    this.files = [];
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.childElementCount = 0;
    this.className = "";
  }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  setAttribute(name, value) { this.attributes[name] = value; }
  append(...items) {
    this.children.push(...items);
    this.childElementCount = this.children.length;
  }
  replaceChildren(...items) {
    this.children = [...items];
    this.childElementCount = this.children.length;
  }
  focus() {}
  click() { this.clicked = true; }
  remove() { this.removed = true; }
}

function createHarness({ raw = null, confirmResult = true, failNextSet = false } = {}) {
  let stored = raw;
  let shouldFail = failNextSet;
  let uuid = 0;
  const localStorage = {
    getItem(key) {
      assert.equal(key, "kokoroTodayTasksV1");
      return stored;
    },
    setItem(key, value) {
      assert.equal(key, "kokoroTodayTasksV1");
      if (shouldFail) {
        shouldFail = false;
        throw new Error("quota exceeded");
      }
      stored = value;
    },
    removeItem(key) {
      assert.equal(key, "kokoroTodayTasksV1");
      stored = null;
    }
  };
  const ids = [
    "todayTaskForm", "todayTaskInput", "todayTaskList", "todayMiniList",
    "todayTaskStatus", "todayTaskEmpty", "todayMiniSummary", "todayPlanDate",
    "exportTodayTasks", "importTodayTasksFile", "importTodayTasksPreview",
    "importTodayTasksButton", "deleteTodayTasks"
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const body = new Element("body");
  const document = {
    body,
    getElementById(id) { return elements[id] || null; },
    createElement(tag) { return new Element(tag); }
  };
  const readers = [];
  class MockFileReader {
    constructor() { readers.push(this); this.result = null; }
    readAsText(file) { this.file = file; }
  }
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : ["2026-11-17T12:00:00.000Z"]));
    }
    static now() { return Date.parse("2026-11-17T12:00:00.000Z"); }
  }
  const confirm = () => confirmResult;
  const crypto = { randomUUID: () => "task-" + (++uuid) };
  vm.runInNewContext(source, {
    document, localStorage, Date: FixedDate, Intl, JSON, Object, Array, Set,
    Number, String, RegExp, Math, Error, TextEncoder, Blob, FileReader: MockFileReader,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    setTimeout() {},
    window: { crypto },
    crypto, confirm, prompt: () => null,
    console: { error() {} }
  });
  return {
    elements, readers,
    get stored() { return stored; },
    state() { return stored === null ? null : JSON.parse(stored); }
  };
}

function validTask(id = "imported-task", title = "読み込んだ予定") {
  return {
    id, title, isCompleted: false, createdAt: 100, updatedAt: 100, completedAt: null
  };
}

test("adds a task and persists it under the local date", () => {
  const h = createHarness();
  h.elements.todayTaskInput.value = "宿題を確認する";
  h.elements.todayTaskForm.listeners.submit({ preventDefault() {} });
  assert.equal(h.state().days["2026-11-17"].length, 1);
  assert.equal(h.state().days["2026-11-17"][0].title, "宿題を確認する");
  assert.equal(h.elements.todayTaskInput.value, "");
  assert.equal(h.elements.todayTaskList.children[0].children[1].textContent, "宿題を確認する");
});

test("completion changes are persisted and rendered again", () => {
  const h = createHarness();
  h.elements.todayTaskInput.value = "本を読む";
  h.elements.todayTaskForm.listeners.submit({ preventDefault() {} });
  const checkbox = h.elements.todayTaskList.children[0].children[0];
  checkbox.checked = true;
  checkbox.listeners.change();
  const task = h.state().days["2026-11-17"][0];
  assert.equal(task.isCompleted, true);
  assert.equal(task.completedAt, Date.parse("2026-11-17T12:00:00.000Z"));
  assert.match(h.elements.todayMiniList.children[0].textContent, /本を読む/);
});

test("malformed saved data fails closed without replacing the original value", () => {
  const h = createHarness({ raw: "{not-json" });
  h.elements.todayTaskInput.value = "追加しない予定";
  h.elements.todayTaskForm.listeners.submit({ preventDefault() {} });
  assert.equal(h.stored, "{not-json");
  assert.match(h.elements.todayTaskStatus.textContent, /保存データを確認できない/);
});

test("a failed storage write preserves the saved data and input draft", () => {
  const seed = JSON.stringify({ version: 1, days: {} });
  const h = createHarness({ raw: seed, failNextSet: true });
  h.elements.todayTaskInput.value = "保存失敗時の入力";
  h.elements.todayTaskForm.listeners.submit({ preventDefault() {} });
  assert.equal(h.stored, seed);
  assert.equal(h.elements.todayTaskInput.value, "保存失敗時の入力");
  assert.match(h.elements.todayTaskStatus.textContent, /保存できませんでした/);
});

test("valid import previews first and replaces data only after confirmation", () => {
  const existing = { version: 1, days: { "2026-11-17": [validTask("old", "既存予定")] } };
  const h = createHarness({ raw: JSON.stringify(existing) });
  const fileInput = h.elements.importTodayTasksFile;
  fileInput.files = [{ size: 100 }];
  fileInput.listeners.change();
  const reader = h.readers[0];
  reader.result = JSON.stringify({
    app: "kokoro-family-today-tasks", version: 1,
    days: { "2026-11-18": [validTask()] }
  });
  reader.onload();
  assert.equal(h.elements.importTodayTasksButton.disabled, false);
  assert.match(h.elements.importTodayTasksPreview.textContent, /予定 1件/);
  h.elements.importTodayTasksButton.listeners.click();
  assert.deepEqual(Object.keys(h.state().days), ["2026-11-18"]);
  assert.equal(h.state().days["2026-11-18"][0].title, "読み込んだ予定");
});

test("an older file read cannot replace the preview for a newer selection", () => {
  const h = createHarness();
  const fileInput = h.elements.importTodayTasksFile;
  fileInput.files = [{ size: 10, name: "older.json" }];
  fileInput.listeners.change();
  const olderReader = h.readers[0];
  fileInput.files = [{ size: 10, name: "newer.json" }];
  fileInput.listeners.change();
  const newerReader = h.readers[1];
  olderReader.result = JSON.stringify({
    app: "kokoro-family-today-tasks", version: 1,
    days: { "2026-11-17": [validTask("old", "古いファイル")] }
  });
  olderReader.onload();
  assert.equal(h.elements.importTodayTasksButton.disabled, true);
  newerReader.result = JSON.stringify({
    app: "kokoro-family-today-tasks", version: 1,
    days: { "2026-11-18": [validTask("new", "新しいファイル")] }
  });
  newerReader.onload();
  assert.equal(h.elements.importTodayTasksButton.disabled, false);
  h.elements.importTodayTasksButton.listeners.click();
  assert.equal(h.state().days["2026-11-18"][0].title, "新しいファイル");
});

test("invalid calendar dates are rejected during import preview", () => {
  const h = createHarness();
  const fileInput = h.elements.importTodayTasksFile;
  fileInput.files = [{ size: 10 }];
  fileInput.listeners.change();
  const reader = h.readers[0];
  reader.result = JSON.stringify({
    app: "kokoro-family-today-tasks", version: 1,
    days: { "2026-02-30": [validTask()] }
  });
  reader.onload();
  assert.equal(h.elements.importTodayTasksButton.disabled, true);
  assert.match(h.elements.importTodayTasksPreview.textContent, /内容に問題があります/);
  assert.equal(h.stored, null);
});

test("deleting all local plan data requires confirmation and removes only its own key", () => {
  const seed = JSON.stringify({ version: 1, days: { "2026-11-17": [validTask()] } });
  const h = createHarness({ raw: seed });
  h.elements.deleteTodayTasks.listeners.click();
  assert.equal(h.stored, null);
  assert.match(h.elements.todayTaskStatus.textContent, /すべて削除しました/);
});

test("canceling the import confirmation leaves existing data untouched", () => {
  const existing = { version: 1, days: { "2026-11-17": [validTask("keep", "残す予定")] } };
  const h = createHarness({ raw: JSON.stringify(existing), confirmResult: false });
  const fileInput = h.elements.importTodayTasksFile;
  fileInput.files = [{ size: 10 }];
  fileInput.listeners.change();
  const reader = h.readers[0];
  reader.result = JSON.stringify({
    app: "kokoro-family-today-tasks", version: 1,
    days: { "2026-11-18": [validTask()] }
  });
  reader.onload();
  h.elements.importTodayTasksButton.listeners.click();
  assert.equal(h.state().days["2026-11-17"][0].title, "残す予定");
  assert.equal(h.state().days["2026-11-18"], undefined);
});
