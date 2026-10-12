import {randomBytes} from 'node:crypto';
import type {LobbyStore} from '../../packages/storage/lobby.js';

/** Independent synthetic sessions using ordinary player APIs, without test privileges. */
export function fillRealPlayers(store:LobbyStore,host:string,id:string){
 const room=store.snapshot(id),players=[host];
 for(let seat=2;seat<=room.board.composition.seatCount;seat++){
  const token=randomBytes(32).toString('hex');store.issueSession(token);players.push(token);
  store.join(token,room.code,'Synthetic '+seat);store.select(token,id,seat);store.setReady(token,id,true,room.preparation.settingsRevision);
 }
 return players;
}
export function confirmRealPlayers(store:LobbyStore,id:string,players:readonly string[]){
 for(const token of players.slice(1))store.confirmIdentity(token,id);
}
