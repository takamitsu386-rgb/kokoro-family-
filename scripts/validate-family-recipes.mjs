import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
const sw=await readFile(new URL("../sw.js",import.meta.url),"utf8");
assert.match(html,/id="family-recipes"/);
assert.match(html,/href="#family-recipes"/);
assert.match(html,/id="familyRecipesForm"/);
assert.match(html,/id="familyRecipesExport"/);
assert.match(html,/id="familyRecipesExportStatus"/);
assert.match(html,/id="familyRecipesImportFile"/);
assert.match(html,/id="familyRecipesImportStatus"/);
assert.match(html,/parseRecipeCsv/);
assert.match(html,/Family recipes CSV import failed/);
assert.match(html,/const header=\["料理名","分類","材料","作り方・コツ","登録日時","更新日時"\]/);
assert.match(html,/Family recipes CSV export failed/);
assert.match(html,/const KEY="kokoroFamilyRecipesV1",LIMIT=100/);
assert.match(html,/function validRecipe\(item\)/);
assert.match(html,/Object\.hasOwn\(categories,item\.category\)/);
assert.match(html,/ingredients\.length<=500/);
assert.match(html,/steps\.length<=1000/);
assert.match(html,/Family recipes rollback failed/);
assert.match(html,/上書きせず保護しました/);
assert.match(html,/クラウド同期・家族間共有には未対応です/);
assert.match(sw,/kokoro-family-v227/);
console.log("Family recipe notebook source checks passed.");

assert.match(html,/familyRecipesShoppingStatus/);
assert.match(html,/材料を買い物リストへ/);
assert.match(html,/kokoroFamilyShoppingV1/);
assert.match(html,/new Set\(current\.map\(x=>x\.id\)\)/);
assert.match(html,/上限100件に達しています/);
assert.match(html,/Recipe shopping import rollback failed/);
assert.match(sw,/kokoro-family-v227/);

assert.match(html,/id="familyRecipesMealStatus"/);
assert.match(html,/addToMeal\.textContent="献立に追加"/);
assert.match(html,/familyMealsForm/);
assert.match(html,/レシピノートから追加/);
assert.match(html,/actions\.append\(edit,addToMeal,addIngredients,remove\)/);
assert.match(sw,/kokoro-family-v227/);

assert.match(html, /option value="favorites">お気に入り/);
assert.match(html, /const FAVORITES_KEY="kokoroFamilyRecipeFavoritesV1"/);
assert.match(html, /favorites\.has\(x\.id\)/);
assert.match(html, /aria-pressed/);
assert.match(html, /Recipe favorite save failed/);
assert.match(sw, /kokoro-family-v227/);

assert.match(html, /id="familyRecipesSort"/);
assert.match(html, /option value="title">料理名順/);
assert.match(html, /option value="category">分類順/);
assert.match(html, /sortInput.addEventListener\("change",render\)/);
assert.match(html, /a\.title\.localeCompare\(b\.title,"ja"\)/);
assert.match(sw, /kokoro-family-v232/);

assert.match(html, /材料チェック（料理中に確認）/);
assert.match(html, /recipe\.ingredients\.split\(\/\\r\?\\n\/\)/);
assert.match(html, /チェックをすべて解除/);
assert.match(html, /checkbox\.addEventListener\("change"/);
assert.match(html, /li\.append\(title,ingredients,checklist,steps,actions\)/);
assert.match(sw, /kokoro-family-v235/);

assert.match(html, /準備済み \+checked\+\//);
assert.match(html, /updateChecklistProgress/);
assert.match(html, /checklistProgress\.textContent/);
assert.match(html, /checklist\.append\(checklistTitle,checklistProgress,checklistItems,resetChecklist\)/);
assert.match(sw, /kokoro-family-v236/);

assert.match(html, /調理ステップチェック/);
assert.match(html, /recipe\.steps\.split\(\/\\r\?\\n\//);
assert.match(html, /updateCookingProgress/);
assert.match(html, /完了 \+boxes\.filter\(input=>input\.checked\)\.length/);
assert.match(html, /ステップをすべて解除/);
assert.match(html, /cookingChecklist,actions/);
assert.match(sw, /kokoro-family-v238/);
