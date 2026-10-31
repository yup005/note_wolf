import type Database from 'better-sqlite3';
import {LobbyError} from '../contracts/index.js';
import {managementStateSchema,managementActionSchema,managementQuerySchema,type ManagementAction,type ManagementState,type ManagementHistoryPage} from '../contracts/management.js';
import type {MemberRow} from './preparation.js';
interface HistoryRow {id:number;at:number;operator_seat:number|null;operator_name:string;action:ManagementAction;before_state:string;after_state:string}
/** Public-management facts only. Call append inside the business transaction. */
export class ManagementHistoryStore {
 constructor(private db:Database.Database,private now:()=>number){
  db.exec(`CREATE TABLE IF NOT EXISTS room_management_history(id INTEGER PRIMARY KEY AUTOINCREMENT,room_id TEXT NOT NULL,at INTEGER NOT NULL,operator_member TEXT NOT NULL,operator_seat INTEGER,operator_name TEXT NOT NULL,action TEXT NOT NULL,before_state TEXT NOT NULL,after_state TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS room_management_history_page ON room_management_history(room_id,id);`);
  if(!(db.prepare('PRAGMA table_info(room_management_history)').all() as {name:string}[]).some(c=>c.name==='game_id'))db.exec('ALTER TABLE room_management_history ADD COLUMN game_id TEXT');
 }
 append(id:string,operator:MemberRow,action:ManagementAction,before:ManagementState,after:ManagementState){
  // Fixed schemas prevent future callers from silently persisting full runtime state.
  const a=managementActionSchema.parse(action),b=managementStateSchema.parse(before),c=managementStateSchema.parse(after);
  this.db.prepare('INSERT INTO room_management_history(room_id,at,operator_member,operator_seat,operator_name,action,before_state,after_state,game_id) VALUES (?,?,?,?,?,?,?,?,(SELECT game_id FROM room_game_heads WHERE room_id=?))').run(id,this.now(),operator.id,operator.seat,operator.nickname,a,JSON.stringify(b),JSON.stringify(c),id);
 }
 page(id:string,input:unknown):ManagementHistoryPage{
  const parsed=managementQuerySchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');const before=parsed.data.before;
  const rows=this.db.prepare(`SELECT id,at,operator_seat,operator_name,action,before_state,after_state FROM room_management_history WHERE room_id=? AND COALESCE(game_id,room_id)=(SELECT game_id FROM room_game_heads WHERE room_id=room_management_history.room_id)${before?' AND id<?':''} ORDER BY id DESC LIMIT 21`).all(...(before?[id,Number(before)]:[id])) as HistoryRow[];
  const items=rows.slice(0,20).map(row=>({id:String(row.id),at:row.at,operator:{seat:row.operator_seat,nickname:row.operator_name},action:managementActionSchema.parse(row.action),before:managementStateSchema.parse(JSON.parse(row.before_state)),after:managementStateSchema.parse(JSON.parse(row.after_state))}));
  return {items,next:rows.length>20?items.at(-1)!.id:null};
 }
}
