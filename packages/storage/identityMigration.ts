import type Database from 'better-sqlite3';
import {boardRoleSchema} from '../contracts/board.js';
/** Preserve existing cards and membership while extending the SQL role catalog. */
export function migrateIdentityRoles(db:Database.Database){
 const table=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='identities'").get() as {sql:string};
 if(table.sql.includes("'mechanicalWolf'"))return;
 const roles=boardRoleSchema.options.map(role=>`'${role}'`).join(',');
 db.transaction(()=>{
  db.exec(`CREATE TABLE identities_role_migration(room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN (${roles})),confirmed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(room_id,member_id));
   INSERT INTO identities_role_migration SELECT room_id,member_id,role,confirmed FROM identities;
   DROP TABLE identities;ALTER TABLE identities_role_migration RENAME TO identities;`);
  if((db.pragma('foreign_key_check') as unknown[]).length)throw new Error('Identity migration failed foreign key validation');
 }).immediate();
}
