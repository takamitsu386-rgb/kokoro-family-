import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const handlerStart = html.indexOf('function setBulkSavedRoomFavorites(enabled)');
assert.notEqual(handlerStart, -1, 'Bulk favorite handler must exist.');
const handlerEnd = html.indexOf('\nfunction duplicateBulkSavedRooms()', handlerStart);
assert.notEqual(handlerEnd, -1, 'Bulk favorite handler must end before bulk duplication.');
const handler = html.slice(handlerStart, handlerEnd);

assert.match(html, /onclick="setBulkSavedRoomFavorites\(true\)"/, 'Bulk favorite button is missing.');
assert.match(html, /onclick="setBulkSavedRoomFavorites\(false\)"/, 'Bulk unfavorite button is missing.');
assert.match(handler, /savedRoomData\(\)/, 'Saved room data must be read.');
assert.match(handler, /readSavedRoomPrefs\(\)/, 'Saved room preferences must be read.');
assert.match(handler, /bulkSavedRoomSelection/, 'Only selected rooms may be changed.');
assert.match(handler, /Object\.prototype\.hasOwnProperty\.call\(rooms,name\)/, 'Stale selections must be excluded.');
assert.match(handler, /new Set\(prefs\.favorites\)/, 'Favorite updates must avoid duplicates.');
assert.match(handler, /favorites\.add\(name\)/, 'Favorite mode must add selected rooms.');
assert.match(handler, /favorites\.delete\(name\)/, 'Unfavorite mode must remove selected rooms.');
assert.match(handler, /writeSavedRoomPrefs\(prefs\)/, 'Updated preferences must be persisted.');
assert.match(handler, /refreshSavedRooms\(\)/, 'The saved room view must refresh.');
assert.match(handler, /if\(!selected\.length\)/, 'Empty selections must be rejected.');

const duplicateStart = html.indexOf('function duplicateBulkSavedRooms()');
assert.notEqual(duplicateStart, -1, 'Bulk duplication handler must exist.');
const duplicateEnd = html.indexOf('function deleteBulkSavedRooms()', duplicateStart);
assert.notEqual(duplicateEnd, -1, 'Bulk duplication handler must end before bulk deletion.');
const duplicate = html.slice(duplicateStart, duplicateEnd);
assert.match(html, /onclick="duplicateBulkSavedRooms\(\)"/, 'Bulk duplication button is missing.');
assert.match(duplicate, /bulkSavedRoomSelection/, 'Bulk duplication must use the current selection.');
assert.match(duplicate, /validRoomData\(rooms\[name\]\)/, 'Only valid room data may be duplicated.');
assert.match(duplicate, /Object\.keys\(rooms\)\.length\+selected\.length>100/, 'The saved-room capacity must be enforced.');
assert.match(duplicate, /while\(Object\.prototype\.hasOwnProperty\.call\(nextRooms,candidate\)\)/, 'Duplicate names must be made unique.');
assert.match(duplicate, /JSON\.parse\(JSON\.stringify\(rooms\[name\]\)\)/, 'Room snapshots must be copied rather than shared by reference.');
assert.match(duplicate, /saveSavedRoomsWithUndo\(nextRooms\)/, 'Bulk duplication must be undoable.');
assert.match(duplicate, /bulkSavedRoomSelection\.clear\(\)/, 'The selection must move to the created copies.');
assert.match(duplicate, /refreshSavedRooms\(\)/, 'The saved room list must refresh after duplication.');
const exportStart = html.indexOf('function exportBulkSavedRooms()');
assert.notEqual(exportStart, -1, 'Bulk export handler must exist.');
const exportEnd = html.indexOf('function deleteBulkSavedRooms()', exportStart);
assert.notEqual(exportEnd, -1, 'Bulk export handler must end before bulk deletion.');
const exportHandler = html.slice(exportStart, exportEnd);
assert.ok(html.includes('onclick="exportBulkSavedRooms()"'), 'Bulk export button is missing.');
assert.match(exportHandler, /bulkSavedRoomSelection/, 'Bulk export must use selected rooms.');
assert.ok(exportHandler.includes('validRoomData(rooms[name])'), 'Only valid selected rooms may be exported.');
assert.match(exportHandler, /savedRoomPrefs:selectedPrefs/, 'Portable backup must include selected room preferences.');
assert.ok(exportHandler.includes('favorites:prefs.favorites.filter'), 'Selected favorites must be preserved.');
assert.ok(exportHandler.includes('categories:Object.fromEntries'), 'Selected categories must be preserved.');
assert.ok(exportHandler.includes('notes:Object.fromEntries'), 'Selected notes must be preserved.');
assert.match(exportHandler, /MAX_BACKUP_BYTES/, 'The backup size limit must be enforced.');
assert.match(exportHandler, /createObjectURL/, 'The export must create a downloadable file.');
const multiImportStart = html.indexOf('function importMultipleRoomsFromBackup()');
assert.notEqual(multiImportStart, -1, 'Multi-room backup import handler must exist.');
const multiImportEnd = html.indexOf('function importRoomBackup()', multiImportStart);
assert.notEqual(multiImportEnd, -1, 'Multi-room import handler must end before full backup import.');
const multiImport = html.slice(multiImportStart, multiImportEnd);
assert.ok(html.includes("bulkChoice.multiple=true"), 'Backup preview must allow multiple selection.');
assert.ok(html.includes('bulkButton.onclick=importMultipleRoomsFromBackup'), 'Multi-room import button must be wired.');
assert.ok(multiImport.includes('choice.selectedOptions'), 'Multi-room import must use selected entries only.');
assert.ok(multiImport.includes('validRoomData(data.savedRooms[sourceName])'), 'Imported room data must be validated.');
assert.ok(multiImport.includes('Object.keys(rooms).length+selected.length>100'), 'Saved-room capacity must be enforced.');
assert.ok(multiImport.includes('while(Object.prototype.hasOwnProperty.call(nextRooms,newName))'), 'Name collisions must be resolved.');
assert.ok(multiImport.includes('saveSavedRoomsWithUndo(nextRooms)'), 'Multi-room import must be undoable.');
assert.ok(multiImport.includes('refreshSavedRooms()'), 'Saved room list must refresh after multi-import.');
console.log('Bulk saved-room favorites, duplication, and portable export checks passed.');


const searchStart = html.indexOf('const searchField=document.getElementById(\'savedRoomSearch\')');
assert.notEqual(searchStart, -1, 'Saved room search must be integrated into refreshSavedRooms.');
const searchEnd = html.indexOf('const categoryNames=', searchStart);
assert.notEqual(searchEnd, -1, 'Saved room search setup must precede category rendering.');
const searchLogic = html.slice(searchStart, html.indexOf('const favorites=', searchStart));
assert.match(html, /id="savedRoomSearch"[^>]*oninput="refreshSavedRooms\(\)"/, 'Search input must refresh results while typing.');
assert.match(searchLogic, /name,categories\[name\].*notes\[name\]/, 'Search must include room names, categories, and notes.');
assert.match(searchLogic, /toLocaleLowerCase\('ja-JP'\)/, 'Search must be case-insensitive with Japanese locale handling.');
assert.match(html, /searchQuery\?'・検索：'/, 'The active search query must be reflected in the result count.');
console.log('Saved room search checks passed.');


const compareFn = html.indexOf('function compareSelectedSavedRooms(){');
assert.notEqual(compareFn, -1, 'Two-room comparison action must exist.');
assert.match(html, /選択した2部屋を比較/, 'Comparison control must be available beside bulk room management.');
assert.match(html, /selected\.length!==2/, 'Comparison must require exactly two selected rooms.');
assert.match(html, /wallColor.*floor/s, 'Comparison must include wall and floor appearance.');
assert.match(html, /data\.items\.length/, 'Comparison must include furniture counts.');
assert.match(html, /prefs\.categories.*prefs\.notes/s, 'Comparison must include category and notes.');
assert.match(html, /savedRoomCompare/, 'Comparison panel must be present in the room manager.');
const compareEnd = html.indexOf('function applyBulkSavedRoomCategory()', compareFn);
assert.notEqual(compareEnd, -1, 'Comparison handler must end before bulk categorization.');
const compareHandler = html.slice(compareFn, compareEnd);
assert.match(compareHandler, /setAttribute\('role','img'\)/, 'Each compared room must expose an accessible visual preview.');
assert.match(compareHandler, /data\.items\.slice\(0,60\)/, 'Comparison previews must render a bounded number of furniture items.');
assert.match(compareHandler, /matchMedia.*max-width:520px/, 'Comparison layout must adapt to narrow screens.');
assert.match(compareHandler, /new Map\(\)/, 'Furniture counts must be grouped by furniture type.');
assert.match(compareHandler, /家具の内訳：/, 'Each comparison card must show furniture breakdown.');
assert.match(compareHandler, /共通の家具種類：/, 'Comparison summary must identify shared furniture types.');
assert.match(compareHandler, /壁の色：.*床の色：/, 'Comparison summary must identify wall and floor color differences.');
assert.match(compareHandler, /だけ：/, 'Comparison summary must identify furniture unique to each room.');
assert.match(compareHandler, /textContent=/, 'User-controlled room data must be rendered as text.');
console.log('Saved room visual comparison and responsive summary checks passed.');

const cornerPlacementStart = html.indexOf('function placeSelectedAtCorner(corner){');
assert.notEqual(cornerPlacementStart, -1, 'Selected furniture must support quick corner placement.');
const cornerPlacementEnd = html.indexOf('function centerSelected()', cornerPlacementStart);
assert.notEqual(cornerPlacementEnd, -1, 'Corner placement handler must end before center placement.');
const cornerPlacement = html.slice(cornerPlacementStart, cornerPlacementEnd);
assert.match(cornerPlacement, /top-left.*top-right.*bottom-left.*bottom-right/s, 'All four room corners must be supported.');
assert.match(cornerPlacement, /room\.clientWidth.*room\.clientHeight/s, 'Corner placement must use the current room dimensions.');
assert.match(cornerPlacement, /autoSaveRoom\(\)/, 'Corner placement must persist the updated room.');
assert.match(cornerPlacement, /保存できなかった.*元の位置に戻しました/s, 'Failed saves must restore the original furniture position.');
assert.match(html, /placeSelectedAtCorner\('top-left'\)/, 'The top-left placement control must be available.');
assert.match(html, /placeSelectedAtCorner\('top-right'\)/, 'The top-right placement control must be available.');
assert.match(html, /placeSelectedAtCorner\('bottom-left'\)/, 'The bottom-left placement control must be available.');
assert.match(html, /placeSelectedAtCorner\('bottom-right'\)/, 'The bottom-right placement control must be available.');
console.log('Selected furniture corner placement checks passed.');

const furnitureExportStart = html.indexOf('function exportRoomFurnitureReport(){');
assert.notEqual(furnitureExportStart, -1, 'Room furniture breakdown must be exportable.');
const furnitureExportEnd = html.indexOf('function analyzeRoomFurniture()', furnitureExportStart);
assert.notEqual(furnitureExportEnd, -1, 'Furniture export handler must end before the on-screen analysis.');
const furnitureExport = html.slice(furnitureExportStart, furnitureExportEnd);
assert.match(furnitureExport, /categoryByIcon/, 'CSV export must classify furniture categories.');
assert.match(furnitureExport, /counts\.set\(key/, 'CSV export must aggregate repeated furniture icons.');
assert.match(furnitureExport, /\['種類','家具アイコン','個数'\]/, 'CSV export must include clear column headings.');
assert.match(furnitureExport, /replace\(\/"\/g,'""'\)/, 'CSV export must escape embedded quotation marks.');
assert.match(furnitureExport, /text\/csv;charset=utf-8/, 'CSV export must use UTF-8 CSV content.');
assert.match(furnitureExport, /URL\.createObjectURL/, 'CSV export must create a downloadable file.');
assert.match(furnitureExport, /URL\.revokeObjectURL/, 'CSV export must release its temporary object URL.');
assert.match(html, /exportRoomFurnitureReport\(\)/, 'The room editor must expose the CSV export action.');
console.log('Room furniture CSV export checks passed.');


const furnitureSearchStart=html.indexOf("let activeFurnitureCategory='all';");
assert.notEqual(furnitureSearchStart,-1,'Furniture category search state must exist.');
const furnitureSearchEnd=html.indexOf('function setDotWallpaper()',furnitureSearchStart);
assert.notEqual(furnitureSearchEnd,-1,'Furniture search renderer must end before wallpaper helpers.');
const furnitureSearch=html.slice(furnitureSearchStart,furnitureSearchEnd);
assert.match(html,/id="furnitureSearch" type="search"/,'Furniture search input must be available.');
assert.match(furnitureSearch,/addEventListener\('input'/,'Furniture results must update while typing.');
assert.match(furnitureSearch,/toLocaleLowerCase\('ja-JP'\)/,'Furniture search must support Japanese case-insensitive matching.');
assert.match(furnitureSearch,/replaceChildren\(\)/,'Furniture results must be safely re-rendered.');
assert.match(furnitureSearch,/filtered\.length/,'Furniture search must report result counts.');
assert.match(furnitureSearch,/見つかりませんでした/,'Empty searches must provide a useful message.');
assert.match(furnitureSearch,/activeFurnitureCategory/,'Search must remain within the selected category.');
console.log('Furniture search and category filtering checks passed.');


const batchAddStart=html.indexOf('function addFurnitureBatch(icon){');
assert.notEqual(batchAddStart,-1,'Bulk furniture add handler must exist.');
const batchAddEnd=html.indexOf('function addFurniture(icon,persist=true)',batchAddStart);
assert.notEqual(batchAddEnd,-1,'Bulk furniture add handler must end before single-item creation.');
const batchAdd=html.slice(batchAddStart,batchAddEnd);
assert.match(html,/id="furnitureAddCount" type="number" min="1" max="20"/,'Bulk furniture quantity input must be bounded from 1 to 20.');
assert.match(batchAdd,/Number\.isInteger\(requested\)/,'Bulk furniture quantity must be an integer.');
assert.match(batchAdd,/existing\+count>300/,'Bulk furniture add must enforce the room capacity.');
assert.match(batchAdd,/addFurniture\(icon,false\)/,'Bulk furniture add must stage items before saving.');
assert.match(batchAdd,/created\.forEach\(element=>element\.remove\(\)\)/,'Bulk furniture add must roll back staged items on failure.');
assert.match(batchAdd,/if\(!autoSaveRoom\(\)\)/,'Bulk furniture add must save the completed batch once.');
assert.match(html,/b\.onclick=\(\)=>addFurnitureBatch\(icon\)/,'Furniture picker buttons must use batch add.');
console.log('Bulk furniture placement checks passed.');


const clearSelectionStart=html.indexOf('function clearSelectedFurniture(){');
assert.notEqual(clearSelectionStart,-1,'Furniture selection clear handler must exist.');
const clearSelectionEnd=html.indexOf('function selectFurniture(el){',clearSelectionStart);
assert.notEqual(clearSelectionEnd,-1,'Furniture selection clear handler must end before selection handler.');
const clearSelection=html.slice(clearSelectionStart,clearSelectionEnd);
assert.match(html,/onclick="clearSelectedFurniture\(\)"/,'Selection clear button must be available.');
assert.match(clearSelection,/selectedFurniture=null/,'Clearing selection must reset selected furniture state.');
assert.match(clearSelection,/style\.outline='none'/,'Clearing selection must remove the visual selection outline.');
assert.match(clearSelection,/setAttribute\('aria-pressed','false'\)/,'Clearing selection must reset accessible pressed state.');
assert.match(html,/event\.key==='Escape'&&selectedFurniture/,'Escape must clear the active furniture selection.');
assert.match(html,/event\.target===room\|\|event\.target\.id==='floor'/,'Clicking empty room space must clear selection.');
console.log('Furniture selection clear and keyboard checks passed.');


const removeMatchingStart=html.indexOf('function removeAllMatchingFurniture(){');
assert.notEqual(removeMatchingStart,-1,'Bulk same-type furniture removal handler must exist.');
const removeMatchingEnd=html.indexOf('function removeSelected(){',removeMatchingStart);
assert.notEqual(removeMatchingEnd,-1,'Bulk removal handler must end before single-item removal.');
const removeMatching=html.slice(removeMatchingStart,removeMatchingEnd);
assert.match(html,/onclick="removeAllMatchingFurniture\(\)"/,'Bulk same-type removal button must exist.');
assert.match(removeMatching,/filter\(item=>item\.dataset\.icon===icon\)/,'Bulk removal must target only the selected furniture type.');
assert.match(removeMatching,/window\.confirm/,'Bulk removal must require confirmation.');
assert.match(removeMatching,/if\(!autoSaveRoom\(\)\)/,'Bulk removal must handle save failure.');
assert.match(removeMatching,/records\.slice\(\)\.reverse\(\)/,'Bulk removal must restore removed items on failure.');
assert.match(removeMatching,/「1つ戻す」/,'Bulk removal must inform users about undo.');
console.log('Bulk same-type furniture removal checks passed.');


const arrangeMatchingStart=html.indexOf('function arrangeMatchingFurniture(){');
assert.notEqual(arrangeMatchingStart,-1,'Same-type furniture arrangement handler must exist.');
const arrangeMatchingEnd=html.indexOf('function removeAllMatchingFurniture(){',arrangeMatchingStart);
assert.notEqual(arrangeMatchingEnd,-1,'Same-type arrangement handler must end before bulk removal.');
const arrangeMatching=html.slice(arrangeMatchingStart,arrangeMatchingEnd);
assert.match(html,/onclick="arrangeMatchingFurniture\(\)"/,'Same-type arrangement button must exist.');
assert.match(arrangeMatching,/item\.dataset\.icon===icon/,'Same-type arrangement must filter by selected icon.');
assert.match(arrangeMatching,/matches\.length<2/,'Same-type arrangement must handle fewer than two matches.');
assert.match(arrangeMatching,/arrangeFurnitureItems\(matches/,'Same-type arrangement must reuse undoable arrangement routine.');
console.log('Same-type furniture arrangement checks passed.');


const duplicateBatchStart=html.indexOf('function duplicateSelectedBatch(){');
assert.notEqual(duplicateBatchStart,-1,'Batch furniture duplication handler must exist.');
const duplicateBatchEnd=html.indexOf('function duplicateSelected(){',duplicateBatchStart);
assert.notEqual(duplicateBatchEnd,-1,'Batch duplication handler must end before single duplication.');
const duplicateBatch=html.slice(duplicateBatchStart,duplicateBatchEnd);
assert.match(html,/onclick="duplicateSelectedBatch\(\)"/,'Batch duplication button must exist.');
assert.match(duplicateBatch,/Math\.min\(20,Math\.max\(1,count\)\)/,'Batch duplication count must be limited to 1–20.');
assert.match(duplicateBatch,/existing\+count>300/,'Batch duplication must enforce room capacity.');
assert.match(duplicateBatch,/cloneNode\(true\)/,'Batch duplication must clone selected furniture.');
assert.match(duplicateBatch,/addEventListener\('click'/,'Cloned furniture must restore selection handlers.');
assert.match(duplicateBatch,/if\(!autoSaveRoom\(\)\)/,'Batch duplication must save the completed batch once.');
assert.match(duplicateBatch,/created\.forEach\(item=>item\.remove\(\)\)/,'Batch duplication must roll back on save failure.');
assert.match(duplicateBatch,/selectFurniture\(created\[created\.length-1\]\)/,'Last duplicated item must become selected.');
console.log('Batch furniture duplication checks passed.');
