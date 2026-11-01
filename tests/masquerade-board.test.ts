import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPreset,createBoardConfiguration,boardStartError,masqueradePlayerRange} from '../packages/domain/boardConfig.js';
import {isWolfRole,isSharedWolfRole,boardRoleSchema} from '../packages/contracts/board.js';
test('masquerade preset and custom copy use dedicated rules without shared mask identity',()=>{
 const b=boardPreset('masquerade-12');assert.equal(b.ruleset,'masquerade');assert.deepEqual(b.roles,{wolf:3,mask:1,villager:4,seer:1,witch:1,idiot:1,dancer:1});
 assert.equal(boardRoleSchema.safeParse('mask').success,true);assert.equal(isWolfRole('mask'),true);assert.equal(isSharedWolfRole('mask'),false);
 assert.equal(boardStartError(b),null);assert.equal(createBoardConfiguration({seatCount:12,roles:b.roles}).ruleset,'masquerade');
 const mixed=createBoardConfiguration({seatCount:12,roles:{...b.roles,dancer:0,hunter:1}});assert.equal(mixed.ruleset,'masquerade');assert.equal(boardStartError(mixed),'BOARD_NOT_IMPLEMENTED');
});

test('masquerade declares supported headcount and blocks unapproved cross-count or missing-core variants',()=>{
 assert.deepEqual(masqueradePlayerRange,{minPlayers:12,maxPlayers:12});
 for(const count of [6,7,8,11,12,13,16,17]){const roles={wolf:Math.min(3,count-5),mask:1,seer:1,witch:1,idiot:1,dancer:1,villager:Math.max(0,count-8)};const board=createBoardConfiguration({seatCount:count,roles});for(const mode of ['automatic','manual'] as const)assert.equal(boardStartError(board,mode),count===12?null:'BOARD_NOT_IMPLEMENTED');}
 const missing=createBoardConfiguration({seatCount:12,roles:{wolf:0,mask:1,villager:7,seer:1,witch:1,idiot:1,dancer:1}});assert.equal(boardStartError(missing),'BOARD_NOT_IMPLEMENTED');
});
