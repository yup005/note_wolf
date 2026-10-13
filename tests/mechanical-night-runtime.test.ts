import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNight,beginNight,advanceNight,nightCommand,privateNight,publicNight} from '../packages/domain/night.js';
import {boardPreset} from '../packages/domain/boardConfig.js';
import {boardRuleVersion,type RoomBoardSnapshot} from '../packages/contracts/board.js';
function fixture(){
 const c=boardPreset('mechanical-12');const board:RoomBoardSnapshot={id:'mechanical-12',name:'Mechanical',ruleVersion:boardRuleVersion,composition:{seatCount:c.seatCount,roleCounts:c.roles,ruleset:c.ruleset,playable:c.playable}};
 const roles=['wolf','wolf','wolf','villager','villager','villager','villager','spiritSeer','witch','hunter','guard','mechanicalWolf'] as const;
 return createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,board);
}
function move(s:ReturnType<typeof fixture>,phase:string){for(let i=0;i<30&&s.phase!==phase;i++){assert.notEqual(s.deadline,null);advanceNight(s,s.deadline!);}assert.equal(s.phase,phase);}
test('mechanical night uses fixed stages, private wolf groups and one-shot learning with immediate mimic',()=>{
 const s=fixture();beginNight(s,0,()=>0);assert.equal(s.phase,'guard');
 nightCommand(s,11,{action:'ability',turnId:s.turnId,choice:'guard',target:11},1);
 move(s,'wolves');assert.deepEqual(privateNight(s,1).wolves,[1,2,3]);assert.equal(privateNight(s,12).kind,'waiting');
 nightCommand(s,1,{action:'vote',turnId:s.turnId,target:4},s.deadline!-1);nightCommand(s,1,{action:'confirm_wolves',turnId:s.turnId},s.deadline!-1);
 move(s,'mechanical');const turn=s.turnId;
 const c={action:'ability',turnId:turn,choice:'learn',target:8} as const;
 nightCommand(s,12,c,s.deadline!-100);nightCommand(s,12,c,s.deadline!-99);
 assert.equal(privateNight(s,12).learningReceipt?.role,'spiritSeer');assert.equal(s.phase,'mechanical');
 assert.throws(()=>nightCommand(s,12,{...c,target:9},s.deadline!-90),/ALREADY_COMMITTED/);
 assert.equal(privateNight(s,1).kind,'waiting');assert.equal(JSON.stringify(publicNight(s,0)).includes('spiritSeer'),false);
 move(s,'spiritSeer');nightCommand(s,8,{action:'ability',turnId:s.turnId,choice:'inspect',target:12},s.deadline!-10);
 assert.equal(privateNight(s,8).inspectionRole,'spiritSeer');assert.equal(privateNight(s,12).inspectionRole,undefined);
 nightCommand(s,8,{action:'ability_finish',turnId:s.turnId},s.deadline!-9);
 move(s,'first_night_complete');assert.equal(s.engine?.resolution?.status,'settled');assert.equal(s.engine?.players.find(p=>p.seat===4)?.alive,false);
});
test('learning timeout retains opportunity, result is frozen and stages persist after skill exhausted',()=>{
 const s=fixture();beginNight(s,0,()=>0);move(s,'mechanical');move(s,'spiritSeer');
 assert.equal(s.engine?.players.find(p=>p.seat===12)?.learning,null);
 nightCommand(s,8,{action:'ability',turnId:s.turnId,choice:'inspect',target:null},s.deadline!-1);nightCommand(s,8,{action:'ability_finish',turnId:s.turnId},s.deadline!-1);
 move(s,'first_night_complete');assert.equal(s.engine?.victory.status,'playing');
});
test('new-board witch and inspected-result acknowledgements survive lost responses',()=>{
 const s=fixture();beginNight(s,0,()=>0);move(s,'witch');
 const witch={action:'witch',turnId:s.turnId,choice:'skip',target:null} as const;
 nightCommand(s,9,witch,s.deadline!-10);assert.deepEqual(privateNight(s,9).witchReceipt,{choice:'skip',target:null});
 assert.doesNotThrow(()=>nightCommand(s,9,witch,s.deadline!-1));
 move(s,'spiritSeer');nightCommand(s,8,{action:'ability',turnId:s.turnId,choice:'inspect',target:12},s.deadline!-5);
 const finish={action:'ability_finish',turnId:s.turnId} as const;nightCommand(s,8,finish,s.deadline!-4);
 assert.doesNotThrow(()=>nightCommand(s,8,finish,s.deadline!-3));
});
test('hunter status follows settled poison protection rather than the raw poison target',()=>{
 const s=fixture();beginNight(s,0,()=>0);move(s,'mechanical');nightCommand(s,12,{action:'ability',turnId:s.turnId,choice:'learn',target:11},s.deadline!-1);move(s,'first_night_complete');
 const next=createNight(s.players,500000,{night:2,antidote:s.antidote,poison:s.poison,hunterSpent:false,priorityWolf:null,engine:s.engine},s.engine!.board);
 beginNight(next,500000,()=>0);move(next,'witch');nightCommand(next,9,{action:'witch',turnId:next.turnId,choice:'poison',target:10},next.deadline!-1);
 move(next,'mechanical');nightCommand(next,12,{action:'ability',turnId:next.turnId,choice:'guard',target:10},next.deadline!-1);
 move(next,'hunter');assert.equal(privateNight(next,10).canShoot,true);
 move(next,'first_night_complete');assert.equal(next.engine!.players.find(p=>p.seat===10)!.alive,true);assert.equal(next.engine!.players.find(p=>p.seat===9)!.alive,false);
});
test('armor freezes a mechanical copy and inherits the knife only on the next night after mechanical death',()=>{
 const c=boardPreset('mechanical-armor-12');const board:RoomBoardSnapshot={id:'mechanical-armor-12',name:'Armor',ruleVersion:boardRuleVersion,composition:{seatCount:c.seatCount,roleCounts:c.roles,ruleset:c.ruleset,playable:c.playable}};
 const roles=['wolf','wolf','mechanicalWolf','armoredWolf','villager','villager','villager','villager','spiritSeer','witch','hunter','guard'] as const;
 const first=createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,board);beginNight(first,0,()=>0);
 move(first,'mechanical');nightCommand(first,3,{action:'ability',turnId:first.turnId,choice:'learn',target:10},first.deadline!-1);
 move(first,'armor');nightCommand(first,4,{action:'ability',turnId:first.turnId,choice:'learn',target:3},first.deadline!-1);
 assert.equal(privateNight(first,4).learningReceipt?.role,'witch');assert.equal(privateNight(first,4).skills?.find(x=>x.kind==='poison')?.available,false);
 move(first,'first_night_complete');
 const living=first.players.map(p=>({...p,alive:![1,2].includes(p.seat)}));
 const second=createNight(living,500000,{night:2,antidote:first.antidote,poison:first.poison,hunterSpent:false,priorityWolf:null,engine:first.engine},board);beginNight(second,500000,()=>0);
 assert.equal(privateNight(second,3).inheritedKnife,true);assert.equal(privateNight(second,4).inheritedKnife,false);
 move(second,'wolves');assert.deepEqual(privateNight(second,3).wolves,[3]);assert.equal(privateNight(second,4).kind,'waiting');
 nightCommand(second,3,{action:'vote',turnId:second.turnId,target:3},second.deadline!-1);nightCommand(second,3,{action:'confirm_wolves',turnId:second.turnId},second.deadline!-1);
 move(second,'mechanical');nightCommand(second,3,{action:'ability',turnId:second.turnId,choice:'poison',target:5},second.deadline!-1);
 move(second,'armor');assert.equal(privateNight(second,4).skills?.find(x=>x.kind==='poison')?.remaining,1);
 nightCommand(second,4,{action:'ability',turnId:second.turnId,choice:'skip',target:null},second.deadline!-1);
 move(second,'first_night_complete');assert.equal(second.engine!.players.find(p=>p.seat===3)!.alive,false);assert.equal(second.engine!.players.find(p=>p.seat===5)!.alive,false);
 const third=createNight(second.players.map(p=>({...p,alive:second.engine!.players.find(e=>e.seat===p.seat)!.alive})),1000000,{night:3,antidote:second.antidote,poison:second.poison,hunterSpent:false,priorityWolf:null,engine:second.engine},board);beginNight(third,1000000,()=>0);
 assert.equal(privateNight(third,4).inheritedKnife,true);move(third,'wolves');assert.deepEqual(privateNight(third,4).wolves,[4]);
 move(third,'armor');assert.equal(privateNight(third,4).skills?.find(x=>x.kind==='poison')?.remaining,1);assert.equal(privateNight(third,4).skills?.find(x=>x.kind==='poison')?.available,true);
});
test('hunter confirmation and exploded-wolf priority retain private replay provenance',()=>{
 const s=fixture();beginNight(s,0,()=>0);move(s,'hunter');
 nightCommand(s,10,{action:'hunter_seen',turnId:s.turnId},s.deadline!-1);
 assert.equal(s.events.some(e=>e.type==='hunter_seen'&&e.seat===10),true);
 const next=createNight(s.players.map(p=>({...p,alive:p.seat!==1})),500000,{night:2,antidote:s.antidote,poison:s.poison,hunterSpent:false,priorityWolf:1,engine:s.engine},s.engine!.board);
 beginNight(next,500000,()=>0);move(next,'wolves');nightCommand(next,1,{action:'priority_knife',turnId:next.turnId,target:4},next.deadline!-1);
 assert.equal(next.events.some(e=>e.type==='priority_knife'&&e.seat===1&&e.target===4),true);
});
test('knife-authority acknowledgement does not acknowledge a later copied inspection result',()=>{
 const first=fixture();beginNight(first,0,()=>0);move(first,'mechanical');nightCommand(first,12,{action:'ability',turnId:first.turnId,choice:'learn',target:8},first.deadline!-1);move(first,'first_night_complete');
 const next=createNight(first.players,500000,{night:2,antidote:first.antidote,poison:first.poison,hunterSpent:false,priorityWolf:null,engine:first.engine},first.engine!.board);beginNight(next,500000,()=>0);
 nightCommand(next,12,{action:'authority_seen',turnId:next.turnId},500001);assert.equal(privateNight(next,12).seen,true);
 move(next,'mechanical');nightCommand(next,12,{action:'ability',turnId:next.turnId,choice:'inspect',target:4},next.deadline!-5);
 assert.equal(privateNight(next,12).seen,false);const finish={action:'ability_finish',turnId:next.turnId} as const;
 nightCommand(next,12,finish,next.deadline!-4);assert.equal(privateNight(next,12).seen,true);assert.doesNotThrow(()=>nightCommand(next,12,finish,next.deadline!-3));
});

test('knife authority confirmation lasts 15 seconds without changing guard timing',()=>{
 const first=fixture();beginNight(first,0,()=>0);move(first,'first_night_complete');const start=500000,next=createNight(first.players,start,{night:2,antidote:first.antidote,poison:first.poison,hunterSpent:false,priorityWolf:null,engine:first.engine},first.engine!.board);beginNight(next,start,()=>0);assert.equal(next.phase,'mechanical_authority');assert.equal(next.deadline,start+15000);advanceNight(next,start+14999);assert.equal(next.phase,'mechanical_authority');advanceNight(next,start+15000);assert.equal(next.phase,'eyes_closed');assert.equal(next.deadline,start+20000);advanceNight(next,start+20000);assert.equal(next.phase,'guard');assert.equal(next.deadline,start+50000);
});
