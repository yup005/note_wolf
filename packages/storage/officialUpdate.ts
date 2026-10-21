import {runtimeRoom} from './roomGames.js';
import type Database from 'better-sqlite3';
import {recordDocumentSchema,type OfficialUpdate,type RecordDocument,type RecordOutcome,type RecordOutcomeSource} from '../contracts/records.js';

// Called only after the caller has authorized an ended, published official post.
// Committed facts are independent of both the private draft and frozen publication.
export function officialUpdate(db:Database.Database,roomId:string):OfficialUpdate|undefined{
 // Judge returns retain old checkpoints. Only an explicitly current revision
 // (live manual state or preserved head) can override a frozen publication.
 const live=runtimeRoom(db,roomId)??'';
 const preparation=db.prepare('SELECT game_mode FROM preparations WHERE room_id=?').get(live) as {game_mode:string}|undefined;
 if(preparation?.game_mode==='automatic')return undefined;
 const current=db.prepare("SELECT version FROM manual_games WHERE room_id=? AND status='ended' UNION ALL SELECT version FROM record_official_heads WHERE room_id=? LIMIT 1").get(live,roomId) as {version:number}|undefined;
 if(!current)return undefined;
 const rows=db.prepare(`SELECT r.version,r.at,r.document,r.outcome,COALESCE(s.source,'computed') AS source
  FROM manual_revisions r LEFT JOIN manual_revision_sources s ON s.room_id=r.room_id AND s.version=r.version
  WHERE r.room_id=? AND r.version<=? ORDER BY r.version DESC`).all(roomId,current.version) as {version:number;at:number;document:string;outcome:RecordOutcome;source:RecordOutcomeSource}[];
 if(!rows.length||rows[0].version!==current.version)return undefined;
 const history=rows.map(row=>{
  const d=JSON.parse(row.document) as RecordDocument;
  const document=recordDocumentSchema.parse({deaths:d.deaths,badges:d.badges,exiles:d.exiles,votes:d.votes,notes:''});
  return {version:row.version,at:row.at,document,outcome:row.outcome,outcomeSource:row.source};
 });
 return {current:history[0],history};
}
