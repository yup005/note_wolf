import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNight,beginNight,advanceNight,nightCommand,privateNight} from '../packages/domain/night.js';
import {createBoardConfiguration} from '../packages/domain/boardConfig.js';
import {boardRuleVersion,type BoardRole,type RoomBoardSnapshot} from '../packages/contracts/board.js';
import {validateConfirmedEngineState,learnConfirmedEngineAbility,appendConfirmedEngineAction} from '../packages/domain/mechanicalEngine.js';

// Real custom-board runtime: both inspection roles and both copying wolves coexist.
function fixture(armor=true){
 const roles:BoardRole[]=['wolf','wolf','mechanicalWolf','armoredWolf','villager','villager','villager','villager','seer','spiritSeer','witch','mixer'];
 if(!armor)roles[3]='guard';
 const counts=Object.fromEntries([...new Set(roles)].map(role=>[role,roles.filter(r=>r===role).length]));
 const c=createBoardConfiguration({seatCount:roles.length,roles:counts});
 const board:RoomBoardSnapshot={id:'seer-mimic',name:'Seer mimic',ruleVersion:boardRuleVersion,composition:{seatCount:c.seatCount,roleCounts:c.roles,ruleset:c.ruleset,playable:c.playable}};
 const s=createNight(roles.map((role,i)=>({seat:i+1,role})),0,undefined,board);
 beginNight(s,0,()=>0);
 return s;
}

for(const [source,label,want] of [[5,'villager','good'],[11,'witch','good'],[12,'mixer','good'],[1,'wolf','wolf']] as const){
 test(`mechanical-seer ruleset ordinary seer reports learned ${label} as ${want}`,()=>{
  const s=fixture(false);assert.equal(s.engine!.board.composition.ruleset,'mechanical-seer');
  learn(s,3,source);inspect(s,3);assert.equal(privateNight(s,9).result,want);
  assert.equal(s.engine!.players.find(p=>p.seat===3)!.camp,'wolves');
  assert.doesNotThrow(()=>validateConfirmedEngineState(JSON.parse(JSON.stringify(s.engine))));
 });
}
function move(s:ReturnType<typeof fixture>,phase:string){
 for(let i=0;i<30&&s.phase!==phase;i++){assert.notEqual(s.deadline,null);advanceNight(s,s.deadline!,()=>0);}
 assert.equal(s.phase,phase);
}
function learn(s:ReturnType<typeof fixture>,seat:3|4,target:number){
 move(s,seat===3?'mechanical':'armor');
 nightCommand(s,seat,{action:'ability',turnId:s.turnId,choice:'learn',target},s.deadline!-10);
}
function inspect(s:ReturnType<typeof fixture>,target:number){
 move(s,'seer');
 const command={action:'seer',turnId:s.turnId,target} as const;
 nightCommand(s,9,command,s.deadline!-10);
 return command;
}

for(const seat of [3,4] as const){
 for(const [source,label,want] of [[5,'villager','good'],[11,'witch','good'],[12,'mixer','good'],[1,'wolf','wolf']] as const){
  test(`ordinary seer sees ${seat===3?'mechanical':'armor'} ${label} mimic as ${want} without changing true camp`,()=>{
   const s=fixture();learn(s,seat,source);
   const command=inspect(s,seat);
   assert.equal(s.engine!.actions.find(a=>a.abilityType==='inspect')!.inspectionPolicy,'mimic-camp-v1');
   assert.equal(privateNight(s,9).result,want);
   assert.equal(privateNight(s,9).inspectionRole,undefined);
   assert.equal(privateNight(s,1).result,undefined);
   const copied=s.engine!.players.find(p=>p.seat===seat)!;
   assert.equal(copied.role,seat===3?'mechanicalWolf':'armoredWolf');
   assert.equal(copied.camp,'wolves');
   assert.equal(copied.learning!.sourceSnapshot.originalRole,label);
   assert.deepEqual(s.engine!.players.find(p=>p.seat===12)!.model,{seat:1,camp:'wolves'});
   assert.doesNotThrow(()=>nightCommand(s,9,command,s.deadline!-9));
   assert.doesNotThrow(()=>validateConfirmedEngineState(JSON.parse(JSON.stringify(s.engine))));
   assert.throws(()=>nightCommand(s,9,{...command,target:6},s.deadline!-8),/ALREADY_COMMITTED/);
  });
 }
}

test('armor copying an already learned mechanical wolf freezes its good mimic for ordinary and exact inspection',()=>{
 const s=fixture();learn(s,3,11);learn(s,4,3);
 move(s,'spiritSeer');
 nightCommand(s,10,{action:'ability',turnId:s.turnId,choice:'inspect',target:4},s.deadline!-10);
 assert.equal(privateNight(s,10).inspectionRole,'witch');
 assert.equal(privateNight(s,10).result,undefined);
 inspect(s,4);assert.equal(privateNight(s,9).result,'good');
 const copied=s.engine!.players.find(p=>p.seat===4)!;
 assert.equal(copied.learning!.sourceSnapshot.originalRole,'mechanicalWolf');
 assert.equal(copied.learning!.sourceSnapshot.mimickedRole,'witch');
 assert.equal(copied.camp,'wolves');
 assert.doesNotThrow(()=>validateConfirmedEngineState(JSON.parse(JSON.stringify(s.engine))));
});

test('ordinary seer reports real mixed-blood as good while its model and exact identity stay unchanged',()=>{
 const s=fixture();
 nightCommand(s,12,{action:'mixer',turnId:s.turnId,target:3},1);
 learn(s,3,5);
 move(s,'spiritSeer');
 nightCommand(s,10,{action:'ability',turnId:s.turnId,choice:'inspect',target:12},s.deadline!-10);
 assert.equal(privateNight(s,10).inspectionRole,'mixer');
 inspect(s,12);assert.equal(privateNight(s,9).result,'good');
 assert.deepEqual(s.engine!.players.find(p=>p.seat===12)!.model,{seat:3,camp:'wolves'});
 move(s,'first_night_complete');
 assert.equal(s.engine!.victory.status,'playing');
});

test('a living good mimic remains a true wolf for settled victory and mixed-blood model allegiance',()=>{
 const first=fixture();
 nightCommand(first,12,{action:'mixer',turnId:first.turnId,target:4},1);
 learn(first,4,5);inspect(first,4);assert.equal(privateNight(first,9).result,'good');
 move(first,'first_night_complete');
 const next=createNight(first.players.map(p=>({...p,alive:![1,2,3].includes(p.seat)})),500000,{night:2,antidote:first.antidote,poison:first.poison,hunterSpent:false,priorityWolf:null,engine:first.engine},first.engine!.board);
 beginNight(next,500000,()=>0);move(next,'seer');
 nightCommand(next,9,{action:'seer',turnId:next.turnId,target:4},next.deadline!-10);
 assert.equal(privateNight(next,9).result,'good');
 const forged=structuredClone(next.engine!);forged.actions.find(a=>a.abilityType==='inspect')!.privateInspection={status:'camp',camp:'wolves'};
 assert.throws(()=>validateConfirmedEngineState(forged),/INVALID_ENGINE_STATE/);
 move(next,'first_night_complete');assert.deepEqual(next.engine!.victory,{status:'playing'});
 // Killing the last true wolf ends the game even though its visible identity was good.
 const last=createNight(next.players.map(p=>({...p,alive:![1,2,3,4].includes(p.seat)})),1000000,{night:3,antidote:next.antidote,poison:next.poison,hunterSpent:false,priorityWolf:null,engine:next.engine},next.engine!.board);
 beginNight(last,1000000,()=>0);move(last,'first_night_complete');
 assert.deepEqual(last.engine!.victory,{status:'ended',winner:'good',reason:'all-wolves-dead',personalResults:[{seat:12,won:false}]});
});

test('ordinary inspection keeps unlearned wolves, dead-target rejection, self rejection and null pass semantics',()=>{
 const first=fixture();inspect(first,3);assert.equal(privateNight(first,9).result,'wolf');move(first,'first_night_complete');
 const next=createNight(first.players.map(p=>({...p,alive:p.seat!==3})),500000,{night:2,antidote:first.antidote,poison:first.poison,hunterSpent:false,priorityWolf:null,engine:first.engine},first.engine!.board);
 beginNight(next,500000,()=>0);move(next,'seer');
 assert.equal(privateNight(next,9).legalTargets!.includes(3),false);
 assert.throws(()=>nightCommand(next,9,{action:'seer',turnId:next.turnId,target:3},next.deadline!-10),/INVALID_TARGET/);
 assert.throws(()=>nightCommand(next,9,{action:'seer',turnId:next.turnId,target:9},next.deadline!-10),/INVALID_TARGET/);
 nightCommand(next,9,{action:'ability',choice:'inspect',turnId:next.turnId,target:null},next.deadline!-10);
 assert.equal(privateNight(next,9).committed,true);assert.equal(privateNight(next,9).result,undefined);
});

test('seer feedback does not enable unresolved copying of ordinary seer',()=>{
 const s=fixture();move(s,'mechanical');
 assert.throws(()=>nightCommand(s,3,{action:'ability',turnId:s.turnId,choice:'learn',target:9},s.deadline!-10),/RULE_DECISION_REQUIRED/);
 assert.equal(s.engine!.players.find(p=>p.seat===3)!.learning,null);
 assert.equal(privateNight(s,3).committed,false);
});

test('a camp receipt obtained before same-night learning stays frozen across persistence and command retry',()=>{
 const s=fixture();inspect(s,3);assert.equal(privateNight(s,9).result,'wolf');
 const before=s.engine!.actions.find(a=>a.abilityType==='inspect')!;
 const learned=learnConfirmedEngineAbility(s.engine!,3,5,{copyId:'late-copy',at:before.at+1});
 assert.equal(learned.status,'learned');if(learned.status!=='learned')throw Error('learn');
 const restored=validateConfirmedEngineState(JSON.parse(JSON.stringify(learned.state)));
 const {night,sourceRole,ruleset,privateInspection,inspectionPolicy,...command}=before;
 const retry=appendConfirmedEngineAction(restored,command);
 assert.equal(retry.status,'committed');if(retry.status!=='committed')throw Error('retry');
 assert.deepEqual(retry.inspection,{status:'camp',camp:'wolves'});
 assert.equal(retry.state.players.find(p=>p.seat===3)!.abilities.mimickedRole,'villager');
 assert.equal(retry.state.actions.filter(a=>a.abilityType==='inspect').length,1);
});

for(const seat of [3,4] as const){
 test(`legacy ordinary-seer true-camp receipt for prior-night ${seat===3?'mechanical':'armor'} good mimic survives restart and retry`,()=>{
  const first=fixture();learn(first,seat,5);move(first,'first_night_complete');
  const second=createNight(first.players,500000,{night:2,antidote:first.antidote,poison:first.poison,hunterSpent:false,priorityWolf:null,engine:first.engine},first.engine!.board);
  beginNight(second,500000,()=>0);inspect(second,seat);
  const stored:NonNullable<typeof second.engine>=JSON.parse(JSON.stringify(second.engine!));
  const action=stored.actions.find(a=>a.abilityType==='inspect')!;
  // An old running room already returned the wolf's true camp before this fix.
  action.privateInspection={status:'camp',camp:'wolves'};delete action.inspectionPolicy;
  const restored=validateConfirmedEngineState(stored);
  const {night,sourceRole,ruleset,privateInspection,inspectionPolicy,...command}=action;
  const retry=appendConfirmedEngineAction(restored,command);
  assert.equal(retry.status,'committed');if(retry.status!=='committed')throw Error('retry');
  assert.deepEqual(retry.inspection,{status:'camp',camp:'wolves'});
  second.engine=retry.state;assert.equal(privateNight(second,9).result,'wolf');
  assert.equal(retry.state.actions.filter(a=>a.abilityType==='inspect').length,1);
  assert.equal(retry.state.players.find(p=>p.seat===seat)!.abilities.mimickedRole,'villager');
  move(second,'first_night_complete');
  const third=createNight(second.players,1000000,{night:3,antidote:second.antidote,poison:second.poison,hunterSpent:false,priorityWolf:null,engine:second.engine},second.engine!.board);
  beginNight(third,1000000,()=>0);inspect(third,seat);
  assert.equal(privateNight(third,9).result,'good');
  assert.equal(third.engine!.actions.find(a=>a.abilityType==='inspect')!.inspectionPolicy,'mimic-camp-v1');
 });
}

test('inspection-policy metadata is server-owned and cannot stamp exact-role receipts or forged commands',()=>{
 const s=fixture();move(s,'spiritSeer');
 nightCommand(s,10,{action:'ability',turnId:s.turnId,choice:'inspect',target:3},s.deadline!-10);
 const receipt=s.engine!.actions.find(a=>a.abilityType==='inspect')!;
 assert.equal(receipt.inspectionPolicy,undefined);
 const invalid=structuredClone(s.engine!);invalid.actions.find(a=>a.abilityType==='inspect')!.inspectionPolicy='mimic-camp-v1';
 assert.throws(()=>validateConfirmedEngineState(invalid),/INVALID_ENGINE_STATE/);
 const {night,sourceRole,ruleset,privateInspection,inspectionPolicy,...command}=receipt;
 assert.throws(()=>appendConfirmedEngineAction(s.engine!,{...command,inspectionPolicy:'mimic-camp-v1'} as typeof command),/INVALID_NIGHT_ACTION/);
});
