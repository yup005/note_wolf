import test from 'node:test';
import assert from 'node:assert/strict';
import {createDay,dayCommand,advanceDay,publicDay,privateDay} from '../packages/domain/day.js';
import {firstDayRules} from '../packages/contracts/day.js';
import {summarizeReplay} from '../packages/domain/replay.js';
import {phaseDuration,supplementRuntime} from '../packages/domain/judge.js';
import {fixture,start,move,dance,mask,command} from './masquerade-fixture.js';
import {evaluateVictory} from '../packages/domain/victory.js';

test('terminal night announces seats then winner and skips first-day election; normal first day keeps election',()=>{
 for(const terminal of [true,false]){const n=start(fixture(1));if(terminal){for(const p of n.players)if(p.role==='villager'&&p.seat!==5)p.alive=false;for(const p of n.engine!.players)if(p.role==='villager'&&p.seat!==5){p.alive=false;p.publicState.canVote=false;}command(n,1,{action:'vote',target:5});command(n,1,{action:'confirm_wolves'});}move(n,'first_night_complete');const d=createDay(n,firstDayRules,1);dayCommand(d,{seat:1,isHost:true},{action:'start',turnId:d.turnId},1);
 if(terminal){assert.equal(d.phase,'night_announcement');assert.deepEqual(publicDay(d,1).announcement,[5]);assert.equal(publicDay(d,1).winner,null);advanceDay(d,d.deadline!);assert.equal(d.phase,'ended');assert.equal(d.winner,'wolves');assert.equal(d.events.some(e=>e.type==='sheriff_signup'),false);}else assert.equal(d.phase,'sheriff_signup');}
});
test('new night causes survive records/replay; public deaths do not reveal them; mask cannot explode',()=>{
 const n=start(fixture());dance(n,[5,6,1]);move(n,'mask');mask(n,'inspect',7);mask(n,'mask',8);move(n,'first_night_complete');const d=createDay(n,firstDayRules,1);dayCommand(d,{seat:2,isHost:true},{action:'start',turnId:d.turnId},1);assert.equal(d.phase,'night_announcement');dayCommand(d,{seat:2,isHost:true},{action:'continue',turnId:d.turnId},1);assert.equal(d.deaths.find(p=>p.seat===1)!.reason,'dance');assert.equal(JSON.stringify(publicDay(d,1)).includes('dance'),false);
 d.phase='free_speech';assert.equal(privateDay(d,4).canExplode,false);assert.throws(()=>dayCommand(d,{seat:4,isHost:false},{action:'explode',confirmed:true,turnId:d.turnId},1));
 const lines=summarizeReplay({winner:'good',roles:n.players,rounds:[{kind:'night',round:2,events:n.events,engine:n.engine}]}).flatMap(s=>s.lines).join('\n');assert.match(lines,/共舞.*5.*6.*1/);assert.match(lines,/假面.*7/);
});
test('judge knows correct timing and cannot invent timeout skills; simultaneous real-role victory is wolves first',()=>{
 const n=start(fixture());assert.equal(phaseDuration('night',n),60000);const r={clock:0,kind:'night' as const,night:n,day:null,history:[]};assert.throws(()=>supplementRuntime(r,{kind:'advance'},n.engine!.board,firstDayRules,1),/JUDGE_MASQUERADE_REQUIRED/);
 const players=n.players.map(p=>({...p,alive:p.role!=='wolf'&&p.role!=='mask'&&p.role!=='villager'}));assert.deepEqual(evaluateVictory(players,'masquerade'),{status:'ended',winner:'wolves',reason:'all-villagers-dead'});
});

test('masquerade terminal public voice orders seat announcement before victory without causes',async()=>{
 const {voiceFrame}=await import('../packages/domain/voice.js');const {voiceFixture}=await import('./helpers/voice-fixture.js');const f=voiceFixture();try{const room=f.store.snapshot(f.id);room.board.composition.ruleset='masquerade';room.day={day:1,phase:'night_announcement',turnId:'announcement',deadline:5000,serverNow:0,alive:[],dead:[5],announcement:[5],winner:null,terminalAnnouncement:true} as unknown as import('../packages/contracts/day.js').DayPublic;
 assert.match(voiceFrame(room,0).cues.map(c=>c.text).join(' '),/5.*死亡/);assert.doesNotMatch(voiceFrame(room,0).cues.map(c=>c.text).join(' '),/狼人获胜|点杀|共舞|毒/);room.day!.phase='ended';room.day!.winner='wolves';assert.match(voiceFrame(room,5000).cues.map(c=>c.text).join(' '),/5.*死亡.*狼人获胜/);
 }finally{f.store.close();}
});

test('authorized judge can record actual system-selected dance/mask facts without inventing targets',()=>{
 const n=start(fixture());const r={clock:1,kind:'night' as const,night:n,day:null,history:[]};supplementRuntime(r,{kind:'masquerade',actorSeat:12,source:'random',command:{action:'dance_confirm',targets:[5,6,7],expectedRevision:0,turnId:n.turnId,requestId:'00000000-0000-4000-8000-000000000001'}} as never,n.engine!.board,firstDayRules,1);assert.deepEqual(n.engine!.masquerade!.pool,[5,6,7]);assert.equal(n.engine!.masquerade!.danced[0].source,'random');
});

test('judge records a tied historical knife explicitly instead of rerandomizing it',()=>{
 const n=start(fixture(1));command(n,1,{action:'vote',target:5});command(n,2,{action:'vote',target:6});const r={clock:1,kind:'night' as const,night:n,day:null,history:[]};assert.throws(()=>supplementRuntime(r,{kind:'advance'},n.engine!.board,firstDayRules,1),/JUDGE_MASQUERADE_KNIFE_REQUIRED/);supplementRuntime(r,{kind:'masquerade-knife',target:6} as never,n.engine!.board,firstDayRules,1);assert.equal(n.knife,6);
});
test('judge can truthfully skip exhausted inspection and then record a legal mask',()=>{
 const n=start(fixture());dance(n,[5,6,7]);move(n,'mask');n.engine!.masquerade!.inspected=n.masquerade!.alive.map(target=>({night:1,actor:4,target,id:'i'+target,source:'manual'}));const r={clock:n.deadline!-1,kind:'night' as const,night:n,day:null,history:[]};supplementRuntime(r,{kind:'night',actorSeat:4,command:{action:'mask_skip',step:'inspect',turnId:n.turnId,expectedRevision:0,requestId:'00000000-0000-4000-8000-000000000002'}} as never,n.engine!.board,firstDayRules,1);assert.equal(n.masquerade!.inspection!.source,'skipped');mask(n,'mask',8);assert.equal(n.engine!.masquerade!.mask,8);
});

test('terminal night enters public ending announcement automatically without a host day-enter action',async()=>{
 const {default:Database}=await import('better-sqlite3');const {DayStore}=await import('../packages/storage/day.js');const n=start(fixture(1));for(const p of n.players)if(p.role==='villager'&&p.seat!==5)p.alive=false;for(const p of n.engine!.players)if(p.role==='villager'&&p.seat!==5){p.alive=false;p.publicState.canVote=false;}command(n,1,{action:'vote',target:5});command(n,1,{action:'confirm_wolves'});move(n,'first_night_complete');const db=new Database(':memory:');db.exec('CREATE TABLE day_games(room_id TEXT PRIMARY KEY,state TEXT);CREATE TABLE night_games(room_id TEXT,state TEXT);CREATE TABLE preparations(room_id TEXT,game_mode TEXT);CREATE TABLE rooms(id TEXT,revision INTEGER);CREATE TABLE game_history(room_id TEXT,kind TEXT,round INTEGER,state TEXT,UNIQUE(room_id,kind,round));');db.prepare('INSERT INTO night_games VALUES (?,?)').run('r',JSON.stringify(n));db.exec("INSERT INTO preparations VALUES ('r','automatic');INSERT INTO rooms VALUES ('r',0);");let now=1000;const d=new DayStore(db,()=>({seat:1,is_host:1} as never),()=>n,()=>now);try{d.tick();assert.equal(d.snapshot('r')?.phase,'night_announcement');assert.deepEqual(d.snapshot('r')?.announcement,[5]);now+=5000;d.tick();assert.equal(d.snapshot('r')?.phase,'ended');assert.equal(d.snapshot('r')?.winner,'wolves');}finally{db.close();}
});
