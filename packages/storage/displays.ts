import type Database from 'better-sqlite3';
import {randomBytes} from 'node:crypto';
import {LobbyError,type RoomSnapshot} from '../contracts/index.js';
import {displayCommandSchema,displayTokenSchema,type DisplayCommand,type DisplayStatus} from '../contracts/display.js';
import {projectDisplay} from '../domain/display.js';
interface Link {room_id:string;token:string;revision:number;revoked:number}
export class DisplayStore {
 constructor(private db:Database.Database,private snapshot:(id:string)=>RoomSnapshot,private authorizeHost:(token:string,id:string)=>void,private now:()=>number){
  db.exec('CREATE TABLE IF NOT EXISTS display_links(room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,token TEXT NOT NULL UNIQUE CHECK(length(token)=64),revision INTEGER NOT NULL,revoked INTEGER NOT NULL CHECK(revoked IN (0,1)))');
 }
 private link(id:string){return this.db.prepare('SELECT * FROM display_links WHERE room_id=?').get(id) as Link|undefined;}
 private project(row:Link|undefined):DisplayStatus{return {enabled:!!row&&!row.revoked,token:row&&!row.revoked?row.token:null,revision:row?.revision??0};}
 status(token:string,id:string){this.authorizeHost(token,id);return this.project(this.link(id));}
 command(token:string,id:string,input:DisplayCommand):DisplayStatus{
  const parsed=displayCommandSchema.safeParse(input);if(!parsed.success)throw new LobbyError('INVALID_INPUT');
  return this.db.transaction(()=>{this.authorizeHost(token,id);const row=this.link(id),c=parsed.data;if(c.revision!==(row?.revision??0))throw new LobbyError('STALE_DISPLAY',409);
   if(c.action==='create'&&row&&!row.revoked||c.action==='revoke'&&!row)return this.project(row);
   if(c.action==='rotate'&&(!row||row.revoked))throw new LobbyError('STALE_DISPLAY',409);
   const next={room_id:id,token:c.action==='revoke'?row!.token:randomBytes(32).toString('hex'),revision:(row?.revision??0)+1,revoked:c.action==='revoke'?1:0};
   this.db.prepare('INSERT INTO display_links(room_id,token,revision,revoked) VALUES (@room_id,@token,@revision,@revoked) ON CONFLICT(room_id) DO UPDATE SET token=excluded.token,revision=excluded.revision,revoked=excluded.revoked').run(next);return this.project(next);
  }).immediate();
 }
 read(token:string){if(!displayTokenSchema.safeParse(token).success)throw new LobbyError('DISPLAY_UNAVAILABLE',404);const row=this.db.prepare('SELECT * FROM display_links WHERE token=? AND revoked=0').get(token) as Link|undefined;if(!row)throw new LobbyError('DISPLAY_UNAVAILABLE',404);const room=this.snapshot(row.room_id);if(room.testRoom)throw new LobbyError('DISPLAY_UNAVAILABLE',404);return projectDisplay(room,this.now());}
}
