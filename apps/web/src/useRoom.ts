import {useEffect,useState} from 'react';
import {io} from 'socket.io-client';
import type {RoomSnapshot} from '../../../packages/contracts/index';
export interface RoomExpiration {roomId:string;error:'ROOM_NOT_FOUND';message:string}
const expirationMessage='房间已清理，请返回首页';
function roomExpiration(input:unknown,roomId:string):RoomExpiration|undefined{
 if(typeof input!=='object'||input===null)return;
 const event=input as Record<string,unknown>;
 if(event.roomId!==roomId||event.error!=='ROOM_NOT_FOUND')return;
 return {roomId,error:'ROOM_NOT_FOUND',message:expirationMessage};
}
/** The transport is external; validation and cleanup remain shared with the real hook. */
export function listenRoomExpiration(socket:{on:(event:string,listener:(input:unknown)=>void)=>unknown;off:(event:string,listener:(input:unknown)=>void)=>unknown},roomId:string,onExpired:(event:RoomExpiration)=>void){
 let active=true;const receive=(input:unknown)=>{const event=roomExpiration(input,roomId);if(active&&event)onExpired(event);};
 socket.on('room:expired',receive);return ()=>{active=false;socket.off('room:expired',receive);};
}
export function expireRoomNavigation<T extends {room:{id:string}}>(state:{view:T|undefined;previous:readonly T[];rememberedRoom:string|null},roomId:string){
 return {view:state.view?.room.id===roomId?undefined:state.view,previous:state.previous.filter(room=>room.room.id!==roomId),rememberedRoom:state.rememberedRoom===roomId?null:state.rememberedRoom,wasCurrent:state.view?.room.id===roomId};
}
export function acceptRoomActionView<T extends {room:{id:string;revision:number};me:unknown}>(current:T|undefined,next:T):T|undefined{
 if(!current||current.room.id!==next.room.id)return current;
 return current.room.revision>next.room.revision?{...current,me:next.me}:next;
}
export function useRoom(roomId:string|undefined,onSnapshot:(room:RoomSnapshot)=>void,sessionRevision=0,onExpired?:(event:RoomExpiration)=>void){
 const [connected,setConnected]=useState(false);
 useEffect(()=>{
  if(!roomId){setConnected(false);return;}
  let active=true;setConnected(false);const socket=io({autoConnect:false});
  const expired=(event:RoomExpiration)=>{if(active){setConnected(false);onExpired?.(event);}};
  const disposeExpiration=listenRoomExpiration(socket,roomId,expired);
  const sync=()=>socket.emit('room:subscribe',{roomId},(result:{room?:RoomSnapshot;error?:string})=>{
   if(!active)return;
   if(result.room?.id===roomId){onSnapshot(result.room);setConnected(true);}else{setConnected(false);const event=roomExpiration({roomId,error:result.error},roomId);if(event)expired(event);}
  });
  socket.on('connect',sync);socket.on('disconnect',()=>{if(active)setConnected(false);});socket.on('connect_error',()=>{if(active)setConnected(false);});socket.on('room:snapshot',(room:RoomSnapshot)=>{if(active)onSnapshot(room);});
  const foreground=()=>{if(active&&document.visibilityState==='visible'&&socket.connected)sync();};
  document.addEventListener('visibilitychange',foreground);socket.connect();
  return ()=>{active=false;disposeExpiration();document.removeEventListener('visibilitychange',foreground);socket.disconnect();};
 },[roomId,onSnapshot,sessionRevision,onExpired]);
 return connected;
}
