import test from 'node:test';
import assert from 'node:assert/strict';
import {beginNight,nightCommand,privateNight,publicNight,advanceNight,createNight} from '../packages/domain/night.js';
import {validateConfirmedEngineState} from '../packages/domain/mechanicalEngine.js';
import {puppetFixture,move} from './puppet-fixture.js';
function select(s:ReturnType<typeof puppetFixture>,target:number){move(s,'puppet');nightCommand(s,1,{action:'puppet_vote',target,turnId:s.turnId},s.deadline!-1);nightCommand(s,s.confirmer!,{action:'confirm_puppet',turnId:s.turnId},s.deadline!-1);}
function knife(s:ReturnType<typeof puppetFixture>,target:number){move(s,'wolves');nightCommand(s,1,{action:'vote',target,turnId:s.turnId},s.deadline!-1);nightCommand(s,s.confirmer!,{action:'confirm_wolves',turnId:s.turnId},s.deadline!-1);}
test('mandatory separate 180-second selection rejects zero-vote confirm, knife and outsiders; locks once with no disclosure',()=>{
 const s=puppetFixture();beginNight(s,0,()=>0);assert.equal(s.phase,'guard');move(s,'puppet');assert.equal(s.deadline!-s.events.at(-1)!.at,180000);
 assert.deepEqual(privateNight(s,1).legalTargets,[2,4,6,8,10,12]);assert.throws(()=>nightCommand(s,1,{action:'confirm_puppet',turnId:s.turnId},s.deadline!-1),/PUPPET_VOTE_REQUIRED/);
 assert.throws(()=>nightCommand(s,1,{action:'vote',target:4,turnId:s.turnId},s.deadline!-1),/NOT_YOUR_TURN/);
 assert.throws(()=>nightCommand(s,2,{action:'puppet_vote',target:4,turnId:s.turnId},s.deadline!-1),/NOT_YOUR_TURN/);
 assert.throws(()=>nightCommand(s,1,{action:'puppet_vote',target:3,turnId:s.turnId},s.deadline!-1),/INVALID_TARGET/);
 const turn=s.turnId;nightCommand(s,1,{action:'puppet_vote',target:6,turnId:turn},s.deadline!-1);const cmd={action:'confirm_puppet',turnId:turn} as const;nightCommand(s,1,cmd,s.deadline!-1);
 assert.equal(s.engine!.puppet!.target,6);assert.equal(s.engine!.players.find(p=>p.seat===6)!.role,'seer');assert.equal(s.phase,'eyes_closed');
 assert.doesNotThrow(()=>nightCommand(s,1,cmd,s.events.at(-1)!.at));assert.equal(s.events.filter(e=>e.type==='puppet_selected').length,1);
 assert.throws(()=>nightCommand(s,5,cmd,s.events.at(-1)!.at),/CONFIRMER_ONLY|STALE_TURN/);
 assert.equal(JSON.stringify(publicNight(s,0)).includes('target'),false);assert.equal(JSON.stringify(privateNight(s,6)).includes('puppet'),false);
 move(s,'wolves');assert.equal(privateNight(s,1).puppetSeat,6);assert.deepEqual(privateNight(s,1).wolves,[1,5,9]);assert.equal(privateNight(s,6).wolves,undefined);
 const restored=validateConfirmedEngineState(JSON.parse(JSON.stringify(s.engine)));assert.equal(restored.puppet!.target,6);
});
test('timeout respects valid plurality, tied leaders and zero-vote candidates; restart never picks twice',()=>{
 for(const [votes,choose,want] of [[[2,4,4],0,4],[[2,4],1,4],[[],5,12]] as const){const s=puppetFixture();beginNight(s,0,()=>0);move(s,'puppet');votes.forEach((target,i)=>nightCommand(s,[1,5,9][i],{action:'puppet_vote',target,turnId:s.turnId},s.deadline!-1));const end=s.deadline!;advanceNight(s,end,()=>choose);assert.equal(s.engine!.puppet!.target,want);const r=JSON.parse(JSON.stringify(s));advanceNight(r,end,()=>0);assert.equal(r.engine.puppet.target,want);assert.equal(r.events.filter((e:any)=>e.type==='puppet_selected').length,1);}
});
test('guard selected after protecting loses protection immediately, keeps history and cannot repeat next night',()=>{
 const s=puppetFixture();beginNight(s,0,()=>0);nightCommand(s,2,{action:'ability',choice:'guard',target:3,turnId:s.turnId},1);select(s,2);knife(s,3);move(s,'first_night_complete');assert.equal(s.engine!.players.find(p=>p.seat===3)!.alive,false);
 const n=createNight(s.engine!.players.map(p=>({seat:p.seat,role:p.role,alive:p.alive})),1000000,{night:2,antidote:s.antidote,poison:s.poison,hunterSpent:false,priorityWolf:null,engine:s.engine},s.engine!.board);beginNight(n,1000000,()=>0);assert.equal(n.phase,'guard');assert.throws(()=>nightCommand(n,2,{action:'ability',choice:'guard',target:3,turnId:n.turnId},1000001),/INVALID_TARGET|GUARD_CONSECUTIVE_TARGET/);assert.equal(privateNight(n,2).legalTargets?.includes(3),false);move(n,'wolves');assert.equal(n.engine!.puppet!.target,2);
});
test('controlled witch consumes save and poison with normal private receipt but no actual effect',()=>{
 for(const choice of ['save','poison'] as const){const s=puppetFixture();beginNight(s,0,()=>0);select(s,4);knife(s,3);move(s,'witch');nightCommand(s,4,{action:'witch',choice,target:choice==='save'?3:7,turnId:s.turnId},s.deadline!-1);const card=privateNight(s,4);assert.deepEqual(card.witchReceipt,{choice,target:choice==='save'?3:7});assert.equal(choice==='save'?card.antidote:card.poison,false);assert.equal(JSON.stringify(card).includes('puppet'),false);move(s,'first_night_complete');assert.equal(s.engine!.players.find(p=>p.seat===3)!.alive,false);assert.equal(s.engine!.players.find(p=>p.seat===7)!.alive,true);}
});
test('controlled seer uses effective camp then inversion, allows self and retains private result on replay',()=>{
 for(const [target,want] of [[6,'good'],[1,'good'],[3,'wolf']] as const){const s=puppetFixture();beginNight(s,0,()=>0);select(s,6);move(s,'seer');nightCommand(s,6,{action:'seer',target,turnId:s.turnId},s.deadline!-1);assert.equal(privateNight(s,6).result,want);assert.doesNotThrow(()=>validateConfirmedEngineState(JSON.parse(JSON.stringify(s.engine))));}
 const s=puppetFixture();beginNight(s,0,()=>0);select(s,2);move(s,'seer');nightCommand(s,6,{action:'seer',target:2,turnId:s.turnId},s.deadline!-1);assert.equal(privateNight(s,6).result,'wolf');
});
test('controlled hunter sees can shoot even when poisoned; original wolves may knife puppet; no knife inheritance',()=>{
 const s=puppetFixture();beginNight(s,0,()=>0);select(s,8);knife(s,8);move(s,'witch');nightCommand(s,4,{action:'witch',choice:'poison',target:8,turnId:s.turnId},s.deadline!-1);move(s,'hunter');assert.equal(privateNight(s,8).canShoot,true);nightCommand(s,8,{action:'hunter_seen',turnId:s.turnId},s.deadline!-1);move(s,'first_night_complete');assert.equal(s.engine!.players.find(p=>p.seat===8)!.alive,false);assert.deepEqual(privateNight(s,8).skillReceipt,{role:'hunter',canShoot:true});
 const n=puppetFixture();beginNight(n,0,()=>0);select(n,2);move(n,'first_night_complete');n.players.filter(p=>[1,5,9].includes(p.seat)).forEach(p=>p.alive=false);
 const next=createNight(n.players,1000000,{night:2,antidote:n.antidote,poison:n.poison,hunterSpent:false,priorityWolf:null,engine:n.engine},n.engine!.board);beginNight(next,1000000,()=>0);move(next,'wolves');assert.equal(next.confirmer,null);assert.equal(privateNight(next,2).kind,'waiting');assert.throws(()=>nightCommand(next,2,{action:'vote',target:3,turnId:next.turnId},next.deadline!-1),/NOT_YOUR_TURN/);move(next,'first_night_complete');assert.equal(next.knife,null);assert.equal(next.engine!.victory.status,'playing');
});

test('seer can finish after receiving result and safely retry across stage boundary',()=>{
 const s=puppetFixture();beginNight(s,0,()=>0);select(s,6);move(s,'seer');const at=s.deadline!-1,turnId=s.turnId;nightCommand(s,6,{action:'seer',target:6,turnId},at);nightCommand(s,6,{action:'seer_finish',turnId},at);assert.equal(s.phase,'eyes_closed');assert.deepEqual(privateNight(s,6).skillReceipt,{role:'seer',target:6,result:'good'});assert.doesNotThrow(()=>nightCommand(s,6,{action:'seer_finish',turnId},at));
});
test('normal guard and antidote resolve independently of ineffective puppet sources; saved guard history still blocks consecutive guard',()=>{
 for(const [controlled,save,wantAlive] of [[12,false,true],[12,true,false],[2,true,true],[4,true,true]] as const){const s=puppetFixture();beginNight(s,0,()=>0);nightCommand(s,2,{action:'ability',choice:'guard',target:3,turnId:s.turnId},1);select(s,controlled);knife(s,3);if(save){move(s,'witch');nightCommand(s,4,{action:'witch',choice:'save',target:3,turnId:s.turnId},s.deadline!-1);}move(s,'first_night_complete');assert.equal(s.engine!.players.find(p=>p.seat===3)!.alive,wantAlive);if(controlled===2){const n=createNight(s.players,1000000,{night:2,antidote:s.antidote,poison:s.poison,hunterSpent:false,priorityWolf:null,engine:s.engine},s.engine!.board);beginNight(n,1000000,()=>0);assert.throws(()=>nightCommand(n,2,{action:'ability',choice:'guard',target:3,turnId:n.turnId},1000001),/GUARD_CONSECUTIVE_TARGET/);}}
});
