import type Database from 'better-sqlite3';
import type {PuppetDisclosure} from '../contracts/records.js';
/** Call only after the caller's ended-game and access checks. No live endpoint uses this. */
export function endedPuppetDisclosure(db:Database.Database,id:string):PuppetDisclosure|undefined{
 const row=db.prepare('SELECT * FROM record_rooms WHERE room_id=?').get(id) as {ended:number;puppet?:string|null}|undefined;
 if(!row?.ended||!row.puppet)return;
 const p=JSON.parse(row.puppet) as PuppetDisclosure;return {target:p.target,at:p.at};
}
