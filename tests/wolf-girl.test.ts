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

test('public rule reference describes the new board without applying old simultaneous victory priority',async()=>{
 const {buildRuleReference}=await import('../packages/domain/ruleReference.js');const {boardRuleVersion}=await import('../packages/contracts/board.js');const c=boardPreset('wolf-girl-12');
 const r=buildRuleReference({id:'wolf-girl-12',name:'狼女孩',ruleVersion:boardRuleVersion,composition:{seatCount:12,roleCounts:c.roles,ruleset:c.ruleset,playable:true}});
 assert.equal(r.supported,true);assert.equal(r.roles.every(role=>Array.isArray(role.notes)&&!!role.source),true);assert.match(r.mechanics.join(' '),/真狼全灭.*好人/);assert.doesNotMatch(r.mechanics.join(' '),/同时达成时狼人优先/);
});

test('converted civilian statistics use trusted allegiance and preserve it after room cleanup',async()=>{
 const {LobbyStore}=await import('../packages/storage/lobby.js');const {randomBytes,randomUUID}=await import('node:crypto');const {emptyRecord}=await import('../packages/contracts/records.js');const {roles}=await import('./wolf-girl-fixture.js');let now=1000;
 const s=new LobbyStore(':memory:',undefined,false,()=>now),tokens=roles.map(()=>randomBytes(32).toString('base64url'));
 try{
  tokens.forEach(t=>s.issueSession(t));const view=s.create(tokens[0],'Synthetic',randomUUID()),id=view.room.id;s.configureBoard(tokens[0],id,{selection:{kind:'preset',id:'wolf-girl-12'},settingsRevision:0});s.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});
  for(let i=0;i<12;i++){if(i)s.join(tokens[i],view.room.code,'Synthetic '+i);s.select(tokens[i],id,i+1);s.setReady(tokens[i],id,true,s.snapshot(id).preparation.settingsRevision);}s.deal(tokens[0],id);roles.forEach((role,i)=>s.submitIdentity(tokens[i],id,role));s.start(tokens[0],id);
  const member=await s.auth.register(tokens[4],'wolfmix_'+randomUUID().slice(0,8),'synthetic-password','合成狼混');s.enterNight(tokens[0],id);
  while(s.snapshot(id).night!.phase!=='confession'){now=s.snapshot(id).night!.deadline!;s.tickNights();}s.nightCommand(tokens[3],id,{action:'confess',target:5,turnId:s.snapshot(id).night!.turnId});s.switchManual(tokens[0],id,true);
  const gameId=s.snapshot(id).gameId,draft=s.recordsList(tokens[0],gameId).own!;s.saveRecord(tokens[0],gameId,draft.revision,{...emptyRecord(),deaths:[1,2,3,4].map(seat=>({seat,round:1,period:'day' as const,cause:'unrecorded' as const}))});s.commitManual(tokens[0],gameId,draft.revision+1);
  const before=s.statistics(member.token);assert.equal(before.resolved,1);assert.equal(before.wins,0);assert.equal(before.losses,1);now+=25*3600000;s.cleanupExpiredRooms();assert.deepEqual(s.statistics(member.token),before);
 }finally{s.close();}
});
