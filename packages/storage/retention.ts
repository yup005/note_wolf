import type Database from 'better-sqlite3';

const inactivityWindow=24*60*60*1000;

/** Internal lifecycle policy. Call touch only for successful user business activity. */
export class RetentionStore {
 constructor(private db:Database.Database,private now:()=>number=Date.now,private beforeDelete:(roomId:string)=>void=()=>{}){
  db.transaction(()=>{
   const columns=db.prepare('PRAGMA table_info(rooms)').all() as {name:string}[];
   if(!columns.some(column=>column.name==='last_activity_at')){
    db.exec('ALTER TABLE rooms ADD COLUMN last_activity_at INTEGER NOT NULL DEFAULT 0');
    // Legacy activity cannot be reconstructed reliably. Give existing rooms one
    // migration safety window, once; later restarts retain the recorded activity.
    db.prepare('UPDATE rooms SET last_activity_at=?').run(this.now());
   }
   db.exec('CREATE INDEX IF NOT EXISTS rooms_last_activity ON rooms(last_activity_at)');
  }).immediate();
 }

 touch(roomIds:readonly string[]):void{
  if(!roomIds.length)return;
  this.db.transaction(()=>{
   const at=this.now(),update=this.db.prepare('UPDATE rooms SET last_activity_at=MAX(last_activity_at,?) WHERE id=?');
   for(const id of new Set(roomIds))update.run(at,id);
  }).immediate();
 }

 expiredcleanup():string[]{
  return this.db.transaction(()=>{
   // Some old standalone databases predate archives/sharing. Discover their
   // tables inside the same locked transaction as the eligibility checks.
   const tables=new Set((this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(table=>table.name));
   const related=(column:string)=>tables.has('room_games')?`(${column}=r.id OR EXISTS (SELECT 1 FROM room_games g WHERE g.id=${column} AND g.room_id=r.id))`:`${column}=r.id`;
   const protections:string[]=[];
   if(tables.has('saved_replays'))protections.push(`EXISTS (SELECT 1 FROM saved_replays s WHERE ${related('s.room_id')})`);
   if(tables.has('record_drafts')&&tables.has('record_favorites'))protections.push(`EXISTS (SELECT 1 FROM record_favorites f JOIN record_drafts d ON d.id=f.record_id WHERE ${related('d.room_id')})`);
   if(tables.has('record_drafts')&&tables.has('shared_record_favorites'))protections.push(`EXISTS (SELECT 1 FROM shared_record_favorites f JOIN record_drafts d ON d.id=f.record_id WHERE ${related('d.room_id')})`);
   // A paused/withdrawn/expired/disabled-owner link may become readable again.
   // Only explicit revocation releases its retention protection.
   if(tables.has('record_drafts')&&tables.has('record_share_links'))protections.push(`EXISTS (SELECT 1 FROM record_share_links l JOIN record_drafts d ON d.id=l.record_id WHERE ${related('d.room_id')} AND l.revoked=0)`);
   const eligible=`r.last_activity_at<=?${protections.length?` AND NOT (${protections.join(' OR ')})`:''}`;
   const cutoff=this.now()-inactivityWindow;
   const candidates=this.db.prepare(`SELECT r.id FROM rooms r WHERE ${eligible} ORDER BY r.id`).all(cutoff) as {id:string}[];
   const stillEligible=this.db.prepare(`SELECT 1 FROM rooms r WHERE r.id=? AND ${eligible}`);
   const deleted:string[]=[];
   for(const {id} of candidates){
    if(!stillEligible.get(id,cutoff))continue;
    // Owner confirmed: cleanup removes runtime rooms only. Independent drafts,
    // published versions, manual revisions and archive authorization stay intact.
    // Foreign keys cascade runtime state, memberships, presence, voice and board
    // snapshots. Accounts, sessions and owner template libraries stay intact.
    this.beforeDelete(id);
    this.db.prepare('DELETE FROM rooms WHERE id=?').run(id);
    deleted.push(id);
   }
   return deleted;
  }).immediate();
 }
}
