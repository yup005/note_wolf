import {RoomGamesStore} from '../packages/storage/roomGames.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {voiceFrame} from '../packages/domain/voice.js';
import {summarizeReplay} from '../packages/domain/replay.js';
import type {GameReplay} from '../packages/contracts/game.js';
import type {EngineState} from '../packages/contracts/engine.js';
import type {RoomSnapshot} from '../packages/contracts/index.js';
import {recordDocumentSchema,emptyRecord} from '../packages/contracts/records.js';
import {manualOutcome} from '../packages/domain/manual.js';
import {RecordsStore} from '../packages/storage/records.js';
import {IdentityPanel} from '../apps/web/src/IdentityPanel.js';
import type {AuthStore} from '../packages/storage/auth.js';
import type {Role} from '../packages/contracts/index.js';

test('mechanical public night cues are fixed and do not encode secret learning or knife status',()=>{
 const room={preparation:{settings:{gameMode:'automatic'}},night:{night:1,turnId:'synthetic-night',phase:'mechanical',deadline:null,alive:[1,2]},day:null} as unknown as RoomSnapshot;
 for(const phase of ['mechanical_authority','guard','mechanical','armor','spiritSeer','mixer','rules_pending']){
  const baseline={...room,night:{...room.night!,phase}} as typeof room;
  const frame=voiceFrame(baseline,1000);assert.equal(typeof frame.current?.text,'string',phase);assert.ok(frame.current!.text.length>0);
  const hidden={...baseline,night:{...baseline.night!,alive:[],learnedRole:'witch',knife:8,inheritedKnife:true,inspection:'mechanicalWolf'}};
  assert.deepEqual(voiceFrame(hidden,1000),frame);assert.doesNotMatch(frame.current!.text,/8号|女巫|继承|学习成功|毒杀/);
 }
});
test('records schema supports the service roster size and retains duplicate and invalid-seat checks',()=>{
 const document={...emptyRecord(),deaths:Array.from({length:15},(_,i)=>({seat:i+1,round:1,period:'night',cause:'unrecorded'})),votes:[{round:1,kind:'exile',ballots:Array.from({length:15},(_,i)=>({voter:i+1,target:15}))}]};
 assert.equal(recordDocumentSchema.safeParse(document).success,true);
 assert.equal(recordDocumentSchema.safeParse({...document,deaths:[...document.deaths,document.deaths[0]]}).success,false);
 assert.equal(recordDocumentSchema.safeParse({...document,deaths:[{...document.deaths[0],seat:257}]}).success,false);
});
test('manual victory uses actual mechanical and armor roles rather than the standard roster',()=>{
 for(const role of ['mechanicalWolf','armoredWolf'] as const){const roles=[{seat:1,role},{seat:2,role:'villager' as const},{seat:3,role:'guard' as const}];
 assert.equal(manualOutcome(roles,[1]),'good');assert.equal(manualOutcome(roles,[2]),'wolves');assert.equal(manualOutcome(roles,[]),null);
 }
 assert.equal(manualOutcome([{seat:1,role:'mechanicalWolf'},{seat:2,role:'villager'},{seat:3,role:'mixer'}] as {seat:number;role:Role}[],[1]),null);
});
test('physical identity stays concealed in initial HTML for a custom board',()=>{
 // The selector is revealed through an authenticated request; its role list must be derived before rendering.
 const markup=renderToStaticMarkup(createElement(IdentityPanel,{roomId:'synthetic',gameId:'synthetic',phase:'identity_collection',dealMethod:'physical',connected:true,onPublicRefresh:async()=>{},roleCounts:{mechanicalWolf:1,villager:2,guard:1}}));
 assert.match(markup,/你的身份/); // SSR remains concealed; no actual role or option may be revealed by initial HTML.
 assert.doesNotMatch(markup,/机械狼|守卫|<option/);
});
test('record archive captures the configured roster size and rejects missing identities',()=>{
 const db=new Database(':memory:');try{
 db.exec('CREATE TABLE rooms(id TEXT PRIMARY KEY,code TEXT); CREATE TABLE preparations(room_id TEXT,phase TEXT,game_mode TEXT); CREATE TABLE members(id TEXT,room_id TEXT,session_hash TEXT,nickname TEXT,is_host INTEGER,seat INTEGER); CREATE TABLE identities(room_id TEXT,member_id TEXT,role TEXT); CREATE TABLE room_boards(room_id TEXT,id TEXT,name TEXT,composition TEXT);');
 const games=new RoomGamesStore(db,()=>1000);
 const store=new RecordsStore(db,{owner:()=> 'owner1'} as unknown as AuthStore,()=>1000,()=>{throw Error('not used');});
 db.prepare('INSERT INTO rooms VALUES (?,?)').run('custom','1234');games.initialize('custom');db.prepare('INSERT INTO preparations VALUES (?,?,?)').run('custom','started','automatic');db.prepare('INSERT INTO room_boards VALUES (?,?,?,?)').run('custom','custom-13','Synthetic 13',JSON.stringify({seatCount:13,roles:{wolf:1,villager:12}}));
 for(let i=1;i<=13;i++){db.prepare('INSERT INTO members VALUES (?,?,?,?,?,?)').run('member'+i,'custom','owner'+i,'玩家'+i,i===1?1:0,i);db.prepare('INSERT INTO identities VALUES (?,?,?)').run('custom','member'+i,i===1?'wolf':'villager');}
 assert.equal(JSON.parse(store.capture('custom').roles).length,13);
 assert.equal((db.prepare('SELECT COUNT(*) AS n FROM game_statistics_eligibility').get() as {n:number}).n,0); // No confirmation evidence: no statistics admission.
 db.prepare('INSERT INTO record_drafts(id,room_id,owner,author,official,draft) VALUES (?,?,?,?,?,?)').run('draft','custom','owner1','房主',1,JSON.stringify(emptyRecord()));
 assert.equal(store.save('token','custom',0,{...emptyRecord(),deaths:[{seat:13,round:1,period:'night',cause:'unrecorded'}]}).revision,1);
 assert.throws(()=>store.save('token','custom',1,{...emptyRecord(),badges:[{seat:14,round:1}]}),/INVALID_INPUT/);
 assert.throws(()=>store.save('token','custom',1,{...emptyRecord(),votes:[{round:1,kind:'exile',ballots:[{voter:13,target:14}]}]}),/INVALID_INPUT/);
 db.prepare('DELETE FROM record_drafts WHERE room_id=?').run('custom');db.prepare('DELETE FROM record_rooms WHERE room_id=?').run('custom');db.prepare('DELETE FROM identities WHERE member_id=?').run('member13');assert.throws(()=>store.capture('custom'),/IDENTITY_INCOMPLETE/);
 }finally{db.close();}
});

test('mechanical replay retains historical learning and exact private inspections, distinct from true identity',()=>{
 const engine={players:[{seat:1,role:'mechanicalWolf',learning:{night:1,sourceSeat:2,sourceSnapshot:{originalRole:'guard',mimickedRole:null}}},{seat:2,role:'guard'}],actions:[{casterId:3,targetId:1,abilityType:'inspect',privateInspection:{status:'visible',role:'guard'}}]} as unknown as EngineState;
 const replay={winner:'good',roles:[{seat:1,role:'mechanicalWolf'},{seat:2,role:'guard'},{seat:3,role:'spiritSeer'}],rounds:[{kind:'night',round:1,engine,events:[{type:'mechanical_learn',at:1,seat:1,target:2},{type:'spirit_check',at:2,seat:3,target:1},{type:'mechanical_knife',at:3,seat:1,target:2},{type:'guard_protect',at:4,seat:1,target:2}]}]} as GameReplay;
 const lines=summarizeReplay(replay).flatMap(s=>s.lines).join('；');
 assert.match(lines,/1 号机械狼学习 2 号：守卫/);
 assert.match(lines,/通灵师验 1 号：守卫/);assert.doesNotMatch(lines,/通灵师验 1 号：机械狼/);
 assert.match(lines,/1 号机械狼额外刀 2 号/);assert.match(lines,/1 号机械狼守 2 号/);
});
test('copied hunter shots retain the mechanical actor and do not spend the real hunter skill in replay',()=>{
 const replay={winner:'good',roles:[{seat:1,role:'mechanicalWolf'},{seat:2,role:'hunter'}],rounds:[{kind:'day',round:1,events:[{type:'hunter_shot',at:1,seat:1,target:3}]},{kind:'night',round:2,events:[{type:'hunter_seen',at:2,seat:2}]}]} as GameReplay;
 const lines=summarizeReplay(replay).flatMap(s=>s.lines).join('；');assert.match(lines,/1 号机械狼开枪/);assert.match(lines,/猎人查看状态：技能可发动/);
});
