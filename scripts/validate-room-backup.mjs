import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const exportStart = html.indexOf('function exportRoomBackup(){');
const previewStart = html.indexOf('function previewRoomBackup(){', exportStart);
const importStart = html.indexOf('function importRoomBackup(){', previewStart);
assert.ok(exportStart >= 0 && previewStart > exportStart && importStart > previewStart, 'Backup export, preview, and import handlers must exist.');

const exportCode = html.slice(exportStart, previewStart);
assert.match(exportCode, /validRoomData\(currentRoom\)/, 'Export must validate the current room.');
assert.match(exportCode, /validSavedRooms\(savedRooms\)/, 'Export must validate saved rooms.');
assert.match(exportCode, /validSavedRoomPrefs\(savedRoomPrefs\)/, 'Export must validate saved-room preferences.');
assert.match(exportCode, /validCustomRoomPalettes\(customRoomPalettes\)/, 'Export must validate custom palettes.');
assert.match(exportCode, /MAX_BACKUP_BYTES/, 'Export must enforce the backup size limit.');
assert.match(exportCode, /URL\.revokeObjectURL/, 'Export must release its temporary object URL.');

const importCode = html.slice(importStart);
assert.match(importCode, /file\.size>MAX_BACKUP_BYTES/, 'Import must reject oversized files before reading.');
assert.match(importCode, /new FileReader\(\)/, 'Import must read the selected file.');
assert.match(importCode, /data\.app!==["']kokoro-family["']/, 'Import must verify the backup application identifier.');
assert.match(importCode, /data\.version!==1/, 'Import must verify the backup format version.');
assert.match(importCode, /validRoomData\(data\.currentRoom\)/, 'Import must validate the current room.');
assert.match(importCode, /validSavedRooms\(data\.savedRooms\)/, 'Import must validate saved rooms.');
assert.match(importCode, /validSavedRoomPrefs\(incomingPrefs\)/, 'Import must validate preferences.');
assert.match(importCode, /validCustomRoomPalettes\(incomingPalettes\)/, 'Import must validate custom palettes.');
assert.match(importCode, /if\(!confirm\(/, 'Import must ask before replacing current data.');

for (const key of ['kokoroRoomBeforeImport','kokoroSavedRoomsBeforeImport','kokoroSavedRoomPrefsBeforeImport','kokoroCustomRoomPalettesBeforeImport']) {
  assert.ok(importCode.includes(key), 'Import must preserve a pre-import snapshot: '+key);
}
assert.match(importCode, /const previousImportBackup=importBackupKeys\.map/, 'Existing recovery snapshots must be retained before replacement.');
assert.match(importCode, /localStorage\.setItem\("kokoroRoom",JSON\.stringify\(data\.currentRoom\)\)/, 'Import must persist the new current room.');
assert.match(importCode, /applyRoom\(data\.currentRoom,false\)!==true/, 'Import must verify that the new room can be rendered.');
assert.match(importCode, /catch\(importError\)[\s\S]*?localStorage\.setItem\("kokoroRoom",previousRoom\)/, 'Import failure must restore the previous current room.');
assert.match(importCode, /localStorage\.setItem\("kokoroSavedRooms",previousSavedRooms\)/, 'Import failure must restore saved rooms.');
assert.match(importCode, /localStorage\.setItem\("kokoroSavedRoomPrefs",previousPrefs\)/, 'Import failure must restore preferences.');
assert.match(importCode, /localStorage\.setItem\(CUSTOM_ROOM_PALETTE_KEY,previousPalettes\)/, 'Import failure must restore custom palettes.');
assert.match(importCode, /applyRoom\(previousDisplayRoom,false\)!==true/, 'Import failure must restore the previously displayed room.');
assert.match(importCode, /rollbackFailed=true/, 'A failed rollback must be reported distinctly.');
assert.match(importCode, /バックアップを読み込みました/, 'Successful import must report completion.');

console.log('Backup export, validation, pre-import snapshot, and rollback checks passed.');
