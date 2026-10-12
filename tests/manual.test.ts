import {fillRealPlayers,confirmRealPlayers} from './helpers/real-players.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {manualOutcome} from '../packages/domain/manual.js';
import {recordDocumentSchema} from '../packages/contracts/records.js';
import {emptyRecord} from '../packages/contracts/records.js';
import {LobbyStore} from '../packages/storage/lobby.js';
import {randomBytes} from 'node:crypto';
const roles=[{seat:1,role:'wolf'},{seat:2,role:'wolf'},{seat:3,role:'wolf'},{seat:4,role:'wolf'},{seat:5,role:'villager'},{seat:6,role:'villager'},{seat:7,role:'villager'},{seat:8,role:'villager'},{seat:9,role:'seer'},{seat:10,role:'witch'},{seat:11,role:'hunter'},{seat:12,role:'idiot'}] as const;
test('manual outcome uses recorded deaths, twelve-player idiot is a god, and wolf-side elimination has priority',()=>{
 assert.equal(manualOutcome(roles,[]),null);assert.equal(manualOutcome(roles,[1,2,3,4]),'good');assert.equal(manualOutcome(roles,[5,6,7,8]),'wolves');assert.equal(manualOutcome(roles,[9,10,11]),null);assert.equal(manualOutcome(roles,[9,10,11,12]),'wolves');assert.equal(manualOutcome(roles,[1,2,3,4,5,6,7,8]),'wolves');
});
test('record schema rejects duplicate deaths and forged identities; absent facts stay absent',()=>{
 const empty={deaths:[],badges:[],exiles:[],votes:[],notes:''};assert.deepEqual(recordDocumentSchema.parse(empty),empty);assert.equal(recordDocumentSchema.safeParse({...empty,roles}).success,false);
 const death={seat:5,round:1,period:'night',cause:'unrecorded'};assert.equal(recordDocumentSchema.safeParse({...empty,deaths:[death,death]}).success,false);assert.equal(recordDocumentSchema.safeParse({...empty,deaths:[{...death,seat:13}]}).success,true);assert.equal(recordDocumentSchema.safeParse({...empty,deaths:[{...death,seat:257}]}).success,false);
 assert.equal(recordDocumentSchema.safeParse({...empty,votes:[{round:1,kind:'sheriff',ballots:[{voter:5,target:1},{voter:5,target:2}]}]}).success,false);
});
test('a schema-valid seat outside the actual standard roster cannot be saved',()=>{
 const store=new LobbyStore(':memory:',undefined,true);const token=randomBytes(32).toString('hex');try{
  store.issueSession(token);const id=store.create(token,'参赛房主').room.id;store.select(token,id,1);store.configure(token,id,{dealMethod:'online',gameMode:'manual'});const players=fillRealPlayers(store,token,id);store.setReady(token,id,true,1);store.deal(token,id);confirmRealPlayers(store,id,players);store.confirmIdentity(token,id);store.start(token,id);store.recordsList(token,id);
  const document={...emptyRecord(),deaths:[{seat:13,round:1,period:'night' as const,cause:'unrecorded' as const}]};assert.equal(recordDocumentSchema.safeParse(document).success,true);assert.throws(()=>store.saveRecord(token,id,0,document),/INVALID_INPUT/);assert.equal(store.recordsList(token,id).own!.revision,0);
 }finally{store.close();}
});
