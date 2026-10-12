import {useEffect,useState} from 'react';
import type {LobbyView,Role,PrivateIdentity} from '../../../packages/contracts/index';
import {api} from './api';

export function useTestRoles(view:LobbyView):Record<number,Role>{
 const {room,me}=view;const enabled=view.testPlayersEnabled&&me.isHost&&room.testRoom;
 const key=enabled&&room.preparation.phase!=='lobby'?JSON.stringify([room.id,me.id,room.preparation.phase,room.preparation.settingsRevision,room.preparation.submittedCount]):'';
 const [result,setResult]=useState<{key:string;roles:{memberId:string;seat:number;role:Role}[]}>();
 useEffect(()=>{
  if(!key)return;let cancelled=false;
  void Promise.all([api<{roles:{memberId:string;seat:number;role:Role}[]}>(`/api/rooms/${room.id}/test-roles`),api<PrivateIdentity>(`/api/rooms/${room.id}/identity`)]).then(([data,own])=>{
   const roles=[...data.roles];if(own.role&&me.seat!==null)roles.push({memberId:me.id,seat:me.seat,role:own.role});
   if(!cancelled)setResult({key,roles});
  }).catch(()=>{});
  return ()=>{cancelled=true;};
 },[key,room.id,me.id,me.seat]);
 if(!key||result?.key!==key)return {};
 return Object.fromEntries(result.roles.filter(role=>room.seats.some(seat=>seat.number===role.seat&&seat.memberId===role.memberId&&(seat.isTestPlayer||seat.memberId===me.id))).map(role=>[role.seat,role.role]));
}
