import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDeck,rolesMatchBoard,assertCanDeal} from '../packages/domain/preparation.js';

test('random deck and physical validation enforce the 12 player board',()=>{
 for(let n=0;n<20;n++){
  const deck=createDeck();assert.equal(deck.length,12);
  assert.deepEqual(Object.fromEntries(['wolf','villager','seer','witch','hunter','idiot'].map(r=>[r,deck.filter(x=>x===r).length])),{wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1});
  assert.equal(rolesMatchBoard(deck),true);
 }
 assert.equal(rolesMatchBoard(Array(12).fill('wolf')),false);
 assert.equal(rolesMatchBoard(['wolf']),false);
});
test('dealing requires 12 ready players including a seated host',()=>{
 const seats=Array.from({length:12},(_,i)=>({number:i+1,memberId:String(i),nickname:'P',isHost:i===0,isTestPlayer:false,ready:true}));
 assert.doesNotThrow(()=>assertCanDeal(seats));
 assert.throws(()=>assertCanDeal(seats.map(s=>({...s,isHost:false}))),/HOST_NOT_SEATED/);
 assert.throws(()=>assertCanDeal(seats.map((s,i)=>({...s,memberId:i===4?null:String(i)}))),/ROOM_NOT_FULL/);
 assert.throws(()=>assertCanDeal(seats.map((s,i)=>({...s,ready:i!==4}))),/NOT_ALL_READY/);
});
