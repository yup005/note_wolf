import {randomBytes} from 'node:crypto';
import {LobbyStore} from '../../packages/storage/lobby.js';
export function voiceFixture(path=':memory:',existing?:LobbyStore){
 let time=1000;const store=existing??new LobbyStore(path,undefined,false,()=>time);
 const tokens=Array.from({length:12},()=>randomBytes(32).toString('hex'));
 const roles=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'] as const;
 tokens.forEach(t=>store.issueSession(t));const room=store.create(tokens[0],'房主').room,id=room.id;
 store.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});
 roles.forEach((_,i)=>{if(i)store.join(tokens[i],room.code,'玩家'+(i+1));store.select(tokens[i],id,i+1);store.setReady(tokens[i],id,true,1);});
 store.deal(tokens[0],id);roles.forEach((r,i)=>store.submitIdentity(tokens[i],id,r));store.start(tokens[0],id);store.enterNight(tokens[0],id);
 return {store,tokens,id,setNow:(n:number)=>{time=n;},getNow:()=>time};
}
