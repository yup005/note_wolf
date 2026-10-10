import {useEffect,useState} from 'react';
import {io} from 'socket.io-client';
import type {RoomSnapshot} from '../../../packages/contracts/index';
export function useRoom(roomId:string|undefined,onSnapshot:(room:RoomSnapshot)=>void){
 const [connected,setConnected]=useState(false);
 useEffect(()=>{
  if(!roomId){setConnected(false);return;}
  setConnected(false);const socket=io({autoConnect:false});
  const sync=()=>socket.emit('room:subscribe',{roomId},(result:{room?:RoomSnapshot;error?:string})=>{
   if(result.room){onSnapshot(result.room);setConnected(true);}else setConnected(false);
  });
  socket.on('connect',sync);socket.on('disconnect',()=>setConnected(false));socket.on('connect_error',()=>setConnected(false));socket.on('room:snapshot',onSnapshot);
  const foreground=()=>{if(document.visibilityState==='visible'&&socket.connected)sync();};
  document.addEventListener('visibilitychange',foreground);socket.connect();
  return ()=>{document.removeEventListener('visibilitychange',foreground);socket.disconnect();};
 },[roomId,onSnapshot]);
 return connected;
}
