import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync('index.html','utf8');
assert.ok(html.includes('id="room-goal-planner"'),'Room goal planner section must exist.');
assert.ok(html.includes('checkRoomGoal(\'family\')'),'Family goal control must exist.');
assert.ok(html.includes('checkRoomGoal(\'study\')'),'Study goal control must exist.');
assert.ok(html.includes('checkRoomGoal(\'green\')'),'Green room goal control must exist.');
assert.ok(html.includes('checkRoomGoal(\'cafe\')'),'Cafe goal control must exist.');
assert.ok(html.includes('function checkRoomGoal(goalKey)'),'Goal evaluator must exist.');
assert.ok(html.includes("room.querySelectorAll('.furniture')"),'Evaluation must use current room furniture.');
assert.ok(html.includes('result.replaceChildren(fragment)'),'Results must be rendered with safe DOM nodes.');
assert.ok(html.includes('達成 '),'Completion progress must be displayed.');
assert.ok(html.includes('あと'),'Missing furniture guidance must be displayed.');
assert.ok(html.includes("label==='植物を2つ以上'?2:1"),'Green goal must require multiple plants.');
console.log('Room goal planner checks passed.');
