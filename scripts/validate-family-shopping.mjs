import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
assert.match(html, /id="family-shopping"/);
assert.match(html, /href="#family-shopping"/);
assert.match(html, /id="familyShoppingForm"/);
assert.match(html, /maxlength="60"/);
assert.match(html, /const KEY = "kokoroFamilyShoppingV1", LIMIT = 100/);
assert.match(html, /function validEntry\(item\)/);
assert.match(html, /Object\.hasOwn\(categories,item\.category\)/);
assert.match(html, /checkbox\.addEventListener\("change"/);
assert.match(html, /name\.textContent=item\.name/);
assert.match(html, /Shopping list rollback failed/);
assert.match(html, /購入済みの/);
assert.match(html, /クラウド同期・家族間共有には未対応です/);
assert.match(sw, /kokoro-family-v242/);
console.log("Family shopping list source checks passed.");

assert.match(html,/id="familyShoppingSubmit"/);
assert.match(html,/id="familyShoppingCancel"/);
assert.match(html,/textContent="編集"/);
assert.match(html,/function resetEditor\(\)/);
assert.match(html,/editingId\?\{/);
assert.match(html,/Object\.hasOwn\(categories,categoryInput\.value\)/);
assert.match(sw,/kokoro-family-v242/);

assert.match(html,/id="familyShoppingExport"/);
assert.match(html,/id="familyShoppingExportStatus"/);
assert.match(html,/CSVを書き出す/);
assert.match(html,/const safe=value=>/);
assert.match(html,/return \/\^[\\s\]\*\[=\+\\-@\]\/\.test\(text\)/);
assert.match(html,/new Blob\(\[csv\]/);
assert.match(html,/text\/csv;charset=utf-8/);
assert.match(html,/購入済み/);
assert.match(sw,/kokoro-family-v242/);

assert.match(html,/id="familyShoppingImportFile"/);
assert.match(html,/accept="\.csv,text\/csv"/);
assert.match(html,/importFile\.addEventListener\("change",async\(\)=>/);
assert.match(html,/const parseCSV=text=>/);
assert.match(html,/unclosed quote/);
assert.match(html,/categoryByLabel/);
assert.match(html,/登録日時は取り込み時刻になります/);
assert.match(html,/Shopping CSV import failed/);
assert.match(sw,/kokoro-family-v242/);

assert.match(html,/replace\(\/\^\\uFEFF\/,""\)/);
assert.match(html,/ch==="\\n"\|\|ch==="\\r"/);
assert.match(html,/ch==="\\r"&&text\[i\+1\]==="\\n"/);
assert.match(html,/finally\{importFile\.value="";\}/);

assert.match(html, /id="familyShoppingCategoryFilter"/, "shopping category filter exists");
assert.match(html, /id="familyShoppingSearch"/, "shopping keyword search exists");
assert.match(html, /id="familyShoppingResetFilters"/, "shopping filter reset exists");
assert.match(html, /categoryFilter===\"all\"\|\|item\.category===categoryFilter/, "shopping category filter is applied");
assert.match(html, /item\.quantity\.toLocaleLowerCase\(\)\.includes\(query\)/, "shopping search includes quantity memo");
assert.match(html, /resetFiltersButton\.addEventListener\("click"/, "shopping filter reset is wired");
assert.match(sw, /kokoro-family-v242/, "service worker cache is refreshed");

assert.match(html, /id="familyShoppingSort"/, "shopping sort selector exists");
assert.match(html, /a\.name\.localeCompare\(b\.name,"ja"\)/, "shopping list can sort by Japanese item name");
assert.match(html, /categories\[a\.category\]\.localeCompare\(categories\[b\.category\],"ja"\)/, "shopping list can sort by category");
assert.match(html, /sortInput\.value="newest"/, "shopping filter reset restores newest-first sorting");

assert.match(html,/id="familyShoppingModeToggle"/,"shopping mode toggle exists");
assert.match(html,/shoppingMode\?!item\.bought/,"shopping mode hides purchased entries");
assert.match(html,/if\(shoppingMode\)return categories\[a\.category\]/,"shopping mode sorts by category then name");
assert.match(html,/modeToggle\.addEventListener\("click"/,"shopping mode toggle is wired");
assert.match(html,/modeStatus\.textContent=shoppingMode/,"shopping mode announces its state");
assert.match(html,/if\(!shoppingMode\)actions\.append\(edit,remove\)/,"shopping mode hides edit and delete actions");
assert.match(sw,/kokoro-family-v242/,"service worker cache is refreshed");
