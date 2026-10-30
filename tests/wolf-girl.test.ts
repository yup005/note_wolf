import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPreset,boardStartError,createBoardConfiguration} from '../packages/domain/boardConfig.js';
import {evaluateVictory} from '../packages/domain/victory.js';

test('wolf girl preset has separate rules, permits exact custom copy and rejects mixed roles',()=>{
 const board=boardPreset('wolf-girl-12');
 assert.equal(board.ruleset,'wolf-girl');assert.equal(board.roles.wolfGirl,1);assert.equal(board.roles.poisoner,1);
 assert.equal(boardStartError(board),null);
 const mixed=createBoardConfiguration({seatCount:12,roles:{...board.roles,poisoner:0,witch:1}});
 assert.equal(boardStartError(mixed),'BOARD_NOT_IMPLEMENTED');
});
test('true wolf extinction wins before simultaneous edge and converted civilian loses personally',()=>{
 const b=boardPreset('wolf-girl-12');let seat=0;
 const players=Object.entries(b.roles).flatMap(([role,count])=>Array.from({length:count!},()=>({seat:++seat,role:role as any,alive:role==='villager',...(role==='villager'?{personalCamp:'wolves' as const}:{})})));
 const result=evaluateVictory(players,'wolf-girl');
 assert.equal(result.status,'ended');if(result.status==='ended'){assert.equal(result.winner,'good');assert.equal(result.personalResults?.find(p=>p.seat===players.find(p=>p.role==='villager')!.seat)?.won,false);}
});
