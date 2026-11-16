import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const marker = "/* 毎日のルーティン：日付ごとの完了状態を端末内に保存 */";
const markerAt = html.indexOf(marker);
assert.notEqual(markerAt, -1, "Daily routine module marker must exist.");
const scriptAt = html.indexOf("(function(){", markerAt);
const scriptEnd = html.indexOf("</script>", scriptAt);
assert.ok(scriptAt > markerAt && scriptEnd > scriptAt, "Daily routine script must be extractable.");
const source = html.slice(scriptAt, scriptEnd);

class Element {
  constructor(tag = "div") {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.value = "";
    this.textContent = "";
    this.hidden = false;
    this.checked = false;
    this.className = "";
  }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  setAttribute(name, value) { this.attributes[name] = value; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  querySelector(selector) { return selector === 'button[type="submit"]' ? this.submitButton : null; }
  focus() {}
}

function createHarness({ raw = null, date = "2026-11-16", confirmResult = true, failNextSet = false } = {}) {
  let stored = raw;
  let shouldFail = failNextSet;
  const localStorage = {
    getItem(key) { assert.equal(key, "kokoroDailyRoutinesV1"); return stored; },
    setItem(key, value) {
      assert.equal(key, "kokoroDailyRoutinesV1");
      if (shouldFail) { shouldFail = false; throw new Error("quota exceeded"); }
      stored = value;
    },
    removeItem(key) { assert.equal(key, "kokoroDailyRoutinesV1"); stored = null; }
  };
  const ids = ["dailyRoutineForm", "dailyRoutineInput", "dailyRoutineList",
    "dailyRoutineStatus", "dailyRoutineProgress", "dailyRoutineEmpty", "dailyRoutinesDate"];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  elements.dailyRoutineForm.submitButton = new Element("button");
  const document = {
    getElementById(id) { return elements[id] || null; },
    createElement(tag) { return new Element(tag); }
  };
  const FixedDate = class extends Date {
    constructor(...args) {
      super(...(args.length ? args : [date + "T12:00:00"]));
    }
    static now() { return new Date(date + "T12:00:00").getTime(); }
  };
  vm.runInNewContext(source, {
    document, localStorage, Date: FixedDate, Intl, JSON, Object, Array, Set,
    Number, String, RegExp, Math, Error, console: { error() {} },
    crypto: { randomUUID: () => "routine-test-id" },
    confirm: () => confirmResult
  });
  return {
    elements,
    get stored() { return stored; },
    state() { return stored === null ? null : JSON.parse(stored); }
  };
}

test("adds a routine and persists a bounded, validated record", () => {
  const h = createHarness();
  const { dailyRoutineForm: form, dailyRoutineInput: input, dailyRoutineList: list } = h.elements;
  input.value = "朝に水を飲む";
  form.listeners.submit({ preventDefault() {} });
  assert.equal(h.state().routines.length, 1);
  assert.equal(h.state().routines[0].title, "朝に水を飲む");
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[1].textContent, "朝に水を飲む");
  assert.equal(input.value, "");
});

test("completion is stored against the local calendar date and can be unchecked", () => {
  const h = createHarness();
  const form = h.elements.dailyRoutineForm;
  h.elements.dailyRoutineInput.value = "本を読む";
  form.listeners.submit({ preventDefault() {} });
  let checkbox = h.elements.dailyRoutineList.children[0].children[0];
  checkbox.checked = true;
  checkbox.listeners.change();
  assert.deepEqual(h.state().completions, { "2026-11-16": ["routine-test-id"] });
  checkbox = h.elements.dailyRoutineList.children[0].children[0];
  checkbox.checked = false;
  checkbox.listeners.change();
  assert.deepEqual(h.state().completions, { "2026-11-16": [] });
});

test("removing a routine also removes its completion references", () => {
  const seed = JSON.stringify({
    version: 1,
    routines: [{ id: "routine-1", title: "片づける", createdAt: 1760000000000 }],
    completions: { "2026-11-16": ["routine-1"] }
  });
  const h = createHarness({ raw: seed });
  const remove = h.elements.dailyRoutineList.children[0].children[2];
  remove.listeners.click();
  assert.equal(h.state().routines.length, 0);
  assert.deepEqual(h.state().completions, { "2026-11-16": [] });
});

test("malformed saved data fails closed without replacing the stored value", () => {
  const h = createHarness({ raw: "{not-json" });
  assert.equal(h.elements.dailyRoutineForm.hidden, true);
  assert.equal(h.stored, "{not-json");
  assert.match(h.elements.dailyRoutineStatus.textContent, /上書きを止めています/);
});

test("a failed write restores the previous saved value and leaves the UI unchanged", () => {
  const seed = JSON.stringify({ version: 1, routines: [], completions: {} });
  const h = createHarness({ raw: seed, failNextSet: true });
  h.elements.dailyRoutineInput.value = "保存失敗テスト";
  h.elements.dailyRoutineForm.listeners.submit({ preventDefault() {} });
  assert.equal(h.stored, seed);
  assert.equal(h.state().routines.length, 0);
  assert.match(h.elements.dailyRoutineStatus.textContent, /保存できませんでした/);
});

test("rejects a 31st routine without changing saved data", () => {
  const routines = Array.from({ length: 30 }, (_, index) => ({
    id: "routine-" + index, title: "習慣" + index, createdAt: 1760000000000 + index
  }));
  const seed = JSON.stringify({ version: 1, routines, completions: {} });
  const h = createHarness({ raw: seed });
  h.elements.dailyRoutineInput.value = "追加できない項目";
  h.elements.dailyRoutineForm.listeners.submit({ preventDefault() {} });
  assert.equal(h.state().routines.length, 30);
  assert.equal(h.elements.dailyRoutineStatus.textContent, "登録できるのは30件までです。");
});
