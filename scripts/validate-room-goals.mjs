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
assert.ok(html.includes('let activeRoomGoal=null;'),'Selected goal must be tracked.');
assert.ok(html.includes('if(activeRoomGoal)checkRoomGoal(activeRoomGoal);'),'Saving room edits must refresh the active goal.');
assert.ok(html.includes('if(goal)activeRoomGoal=goalKey;'),'Selecting a valid goal must activate live progress.');
console.log('Room goal planner checks passed.');

assert.ok(html.includes("accepted.filter(icon=>furnitureList.includes(icon)"),'Suggestions must use available furniture only.');
assert.ok(html.includes("button.textContent=icon+' を追加'"),'Missing items must have direct add controls.');
assert.ok(html.includes("if(addFurniture(icon))checkRoomGoal(goalKey)"),'Adding a suggestion must refresh the goal result.');
assert.ok(!html.includes("['座って話せる場所',['🛋️','🪑','🛏️']]"),'Family seating must not count a bed.');
assert.ok(!html.includes("['机・作業場所',['🖥️','🪑','📚']]"),'Study desk must not count a chair or books.');
