import {randomBytes} from 'node:crypto';
import {LobbyStore} from '../../packages/storage/lobby.js';
import {emptyRecord,type RecordDocument} from '../../packages/contracts/records.js';
export const syntheticRoles=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'] as const;
export function manualGame(path=':memory:',now=()=>1000,mode:'manual'|'automatic'='manual'){
 const s=new LobbyStore(path,undefined,false,now),tokens=syntheticRoles.map(()=>randomBytes(32).toString('hex'));
 tokens.forEach(t=>s.issueSession(t));const room=s.create(tokens[0],'合成房主').room;
 s.configure(tokens[0],room.id,{dealMethod:'physical',gameMode:mode});
 prepareManual(s,room.id,tokens,room.code);return {s,tokens,id:room.id};
}
export function prepareManual(s:LobbyStore,id:string,tokens:string[],code=s.snapshot(id).code){
 const revision=s.snapshot(id).preparation.settingsRevision;
 syntheticRoles.forEach((_,i)=>{if(i)s.join(tokens[i],code,'合成玩家'+(i+1));s.select(tokens[i],id,i+1);s.setReady(tokens[i],id,true,revision);});
 s.deal(tokens[0],id);syntheticRoles.forEach((role,i)=>s.submitIdentity(tokens[i],id,role));s.start(tokens[0],id);
}
export function endManual(s:LobbyStore,host:string,gameId:string,notes='合成私密笔记'){
 const draft=s.recordsList(host,gameId).own!;
 const document:RecordDocument={...emptyRecord(),notes,deaths:[1,2,3,4].map(seat=>({seat,round:1,period:'night',cause:'unrecorded'}))};
 const saved=s.saveRecord(host,gameId,draft.revision,document);s.commitManual(host,gameId,saved.revision);return saved;
}
