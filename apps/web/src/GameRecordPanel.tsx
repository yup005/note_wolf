import {useEffect,useState} from 'react';
import type {GameRecordContext} from '../../../packages/contracts/rematch';
import type {LobbyView} from '../../../packages/contracts/index';
import {api,errorText} from './api';
import {RecordsPanel} from './RecordsPanel';
import {ArchivedRecordNotes} from './ArchivedRecordNotes';
/** Historical editing uses authorized archived metadata, never the live room. */
export function GameRecordPanel({gameId,onClose}:{gameId:string;onClose:()=>void}){
 const [context,setContext]=useState<GameRecordContext>(),[error,setError]=useState('');
 useEffect(()=>{let active=true;void api<GameRecordContext>(`/api/games/${gameId}/record-context`).then(result=>{if(active)setContext(result);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[gameId]);
 if(!context)return <div className="modal-backdrop"><section className="card modal" role="dialog" aria-modal="true" aria-label="独立对局记录"><button className="text-button" onClick={onClose}>关闭</button>{error?<p role="alert">{error}</p>:<p role="status">正在读取本局记录…</p>}</section></div>;
 if(!context.board)return <ArchivedRecordNotes key={gameId} gameId={gameId} onClose={onClose}/>;
 const view:LobbyView={testPlayersEnabled:false,me:{id:'',nickname:'',isHost:context.isOriginalHost,seat:null},room:{id:context.game.roomId,gameId,gameNumber:context.game.gameNumber,code:context.code,revision:0,board:context.board,boardId:context.board.id,testRoom:false,seats:[],preparation:{phase:'started',settingsRevision:0,settings:{dealMethod:'physical',gameMode:'manual'},submittedCount:0,confirmedCount:0,validation:'valid'}}};
 return <RecordsPanel key={gameId} view={view} historical={context.ended} onClose={onClose} onRefresh={async()=>{}}/>;
}
