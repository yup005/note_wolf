import type Database from 'better-sqlite3';
import {randomUUID,scryptSync} from 'node:crypto';
import {sessionHash} from '../../packages/storage/auth.js';
import type {LobbyStore} from '../../packages/storage/lobby.js';

/** Synthetic single-admin session fixture; never used by the application. */
export function seedTestAdmin(store:LobbyStore,token:string){
 const db=(store as unknown as {db:Database.Database}).db;
 const id=randomUUID(),salt='synthetic-test-admin-salt';
 db.prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?,?,?)').run(id,'fixture_admin','Synthetic admin',scryptSync('synthetic-admin-password',salt,64).toString('hex'),salt,'admin','active',1000);
 if(!store.hasSession(token))store.issueSession(token);
 db.prepare('UPDATE sessions SET account_id=? WHERE session_hash=?').run(id,sessionHash(token));
 return id;
}
