import type Database from 'better-sqlite3';
import {LobbyError} from '../contracts/index.js';
import type {RoomBoardSnapshot} from '../contracts/board.js';
import type {EngineState} from '../contracts/engine.js';
import {validateEngineState} from '../domain/engine.js';

// Server-internal persistence adapter. No token-based read API, public projection
// or admin route exists: later orchestrators own authenticated per-player access.
export class EngineStore{
 constructor(private db:Database.Database,private roomBoard:(id:string)=>RoomBoardSnapshot){db.exec('CREATE TABLE IF NOT EXISTS board_engine_states(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,revision INTEGER NOT NULL,state TEXT NOT NULL);');}
 private validate(id:string,input:unknown){const state=validateEngineState(input),board=this.roomBoard(id);if(state.board.id!==board.id||state.board.ruleVersion!==board.ruleVersion||state.board.composition.seatCount!==board.composition.seatCount||state.board.composition.ruleset!==board.composition.ruleset||Object.keys(state.board.composition.roleCounts).length!==Object.keys(board.composition.roleCounts).length||Object.entries(state.board.composition.roleCounts).some(([role,count])=>board.composition.roleCounts[role as keyof typeof board.composition.roleCounts]!==count))throw new LobbyError('ENGINE_BOARD_MISMATCH',409);return state;}
 load(id:string):{revision:number;state:EngineState}|null{
  const row=this.db.prepare('SELECT revision,state FROM board_engine_states WHERE room_id=?').get(id) as {revision:number;state:string}|undefined;if(!row)return null;
  if(!Number.isSafeInteger(row.revision)||row.revision<1)throw new LobbyError('INVALID_ENGINE_STATE');
  let input:unknown;try{input=JSON.parse(row.state);}catch{throw new LobbyError('INVALID_ENGINE_STATE');}return {revision:row.revision,state:this.validate(id,input)};
 }
 save(id:string,input:EngineState,expectedRevision:number){
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)throw new LobbyError('INVALID_ENGINE_STATE');
  return this.db.transaction(()=>{
   const state=this.validate(id,input);const existing=this.load(id);
   if((existing?.revision??0)!==expectedRevision)throw new LobbyError('STALE_ENGINE',409);
   const revision=expectedRevision+1;this.db.prepare('INSERT INTO board_engine_states VALUES (?,?,?) ON CONFLICT(room_id) DO UPDATE SET revision=excluded.revision,state=excluded.state').run(id,revision,JSON.stringify(state));return {revision,state};
  }).immediate();
 }
}
