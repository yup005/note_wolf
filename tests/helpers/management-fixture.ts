import {randomBytes} from 'node:crypto';
import type {LobbyStore} from '../../packages/storage/lobby.js';
export const managementRoles=['seer','wolf','wolf','wolf','wolf','villager','villager','villager','villager','witch','hunter','idiot'] as const;
export function managementFixture(s:LobbyStore){
 const tokens=managementRoles.map(()=>randomBytes(32).toString('hex'));tokens.forEach(t=>s.issueSession(t));const room=s.create(tokens[0],'原房主').room,id=room.id;
 s.configure(tokens[0],id,{dealMethod:'physical',gameMode:'automatic'});
 managementRoles.forEach((role,i)=>{if(i)s.join(tokens[i],room.code,'玩家'+(i+1));s.select(tokens[i],id,i+1);s.setReady(tokens[i],id,true,1);});s.deal(tokens[0],id);managementRoles.forEach((role,i)=>s.submitIdentity(tokens[i],id,role));s.start(tokens[0],id);s.enterNight(tokens[0],id);
 const command=(seat:number,action:string,extra={})=>s.gameControl(tokens[seat-1],id,{action,confirmed:true,version:s.snapshot(id).control!.version,...extra} as never);
 return {id,room,tokens,command};
}
