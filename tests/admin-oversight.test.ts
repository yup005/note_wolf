import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type Database from 'better-sqlite3';
import {sharingFixture} from './helpers/sharing-fixture.js';
const database=(s:unknown)=>(s as {db:Database.Database}).db;
const fails=(fn:()=>unknown,code:string)=>assert.throws(fn,(e:unknown)=>(e as {code:string}).code===code);

test('oversight groups real reports with whole-group counts, literal nickname search, safe projections and filter-bound cursors',async()=>{
 const f=await sharingFixture();try{f.publish();const s=f.s;
 assert.equal(typeof s.adminReportGroups,'function','missing administrative report grouping');
 const share=s.shareRecord(f.token,f.recordId,{action:'create',revision:0}).token!;
 const scope={kind:'share' as const,token:share};
 const a=await s.auth.register(f.players[1],'oversight_reporter','correct-password','reporter private');
 const c=s.communityComment(f.token,{scope,requestId:randomUUID(),parentId:null,text:'BODY_SECRET'}).comment;
 s.communityReport(a.token,{scope,requestId:randomUUID(),commentId:c.id,reason:'reason'});
 s.communityReport(f.token,{scope,requestId:randomUUID(),commentId:c.id,reason:'reason2'});
 const reports=s.communityReports(f.admin,{status:'open'});
 s.communityModerate(f.admin,{requestId:randomUUID(),action:'dismiss',confirmed:true,reason:'real moderation',reportId:reports.items[0].id,version:reports.items[0].version});
 const g=s.adminReportGroups(f.admin,{}).items[0];assert.equal(g.reportCount,2);assert.equal(g.openCount,1);assert.equal(g.reviewedCount,1);assert.equal(g.status,'open');
 assert.equal(s.adminReportGroups(f.admin,{status:'reviewed'}).items.length,0);
 const text=JSON.stringify(s.adminReportGroups(f.admin,{}));assert(!text.includes('BODY_SECRET'));assert(!text.includes(share));assert(!text.includes('reporter private'));
 s.auth.updateProfile(f.token,'100%_literal');assert.equal(s.adminReportGroups(f.admin,{q:'%_'}).items.length,1);assert.equal(s.adminReportGroups(f.admin,{q:'%missing'}).items.length,0);
 fails(()=>s.adminReportGroups(f.token,{}),'ADMIN_ONLY');fails(()=>s.adminReportGroups(f.admin,{action:'vip'}),'INVALID_INPUT');
 const one=s.adminAuditList(f.admin,{limit:1});assert(one.nextCursor);fails(()=>s.adminShares(f.admin,{cursor:one.nextCursor}),'INVALID_INPUT');fails(()=>s.adminAuditList(f.admin,{cursor:one.nextCursor,q:'different'}),'INVALID_INPUT');
 const rest=s.adminAuditList(f.admin,{limit:50,cursor:one.nextCursor});assert(!rest.items.some(r=>r.id===one.items[0].id));assert(rest.items.some(r=>r.action==='vip'));
 }finally{f.s.close();}
});

test('direct admin changes create actual-actor history and rollback account, notification and audit together',async()=>{
 const f=await sharingFixture();try{const s=f.s,db=database(s);assert.equal(typeof s.adminAuditList,'function');
 const vip=s.adminAuditList(f.admin,{}).items;assert.equal(vip.length,1);assert.equal(vip[0].action,'vip');assert.equal(vip[0].operator,'管理员');assert.equal(vip[0].subject,'分享作者');assert.match(vip[0].detail!,/false.*true/);
 s.auth.setVip(f.admin,f.account.id,true,null);assert.equal(s.adminAuditList(f.admin,{}).items.length,1);
 const before=s.notificationsList(f.token,{}).items.length;
 db.exec("CREATE TRIGGER oversight_fail BEFORE INSERT ON admin_operations BEGIN SELECT RAISE(ABORT,'test rollback'); END");
 assert.throws(()=>s.auth.setStatus(f.admin,f.account.id,'disabled'),/test rollback/);assert.equal(s.auth.account(f.token)?.status,'active');assert.equal(s.notificationsList(f.token,{}).items.length,before);
 db.exec('DROP TRIGGER oversight_fail');s.auth.setStatus(f.admin,f.account.id,'disabled');assert.equal(s.auth.account(f.token),null);assert.equal(s.adminAuditList(f.admin,{action:'status'}).items.length,1);
 }finally{f.s.close();}
});

test('metadata CSV is BOM quoted formula-safe, filter-equivalent and rejects 5001 matches',async()=>{
 const f=await sharingFixture();try{const s=f.s,db=database(s);assert.equal(typeof s.adminExport,'function');s.auth.updateProfile(f.token,'  =formula,"name"');s.auth.setVip(f.admin,f.account.id,false,null);
 const exp=s.adminExport(f.admin,{kind:'audit',filter:{action:'vip'}});assert.equal(exp.count,s.adminAuditList(f.admin,{action:'vip'}).items.length);assert(exp.csv.startsWith('\uFEFF'));assert(exp.csv.includes('"\'=formula,""name"""'));assert(!exp.csv.includes('password_hash'));
 const insert=db.prepare('INSERT INTO admin_operations VALUES (?,?,?,?,?,?,?,?,?,?)');db.transaction(()=>{for(let i=0;i<5001;i++)insert.run(randomUUID(),i,f.account.id,'actor',f.account.id,'target','warn','\t@evil',null,null);})();
 fails(()=>s.adminExport(f.admin,{kind:'audit',filter:{action:'warn'}}),'EXPORT_TOO_LARGE');fails(()=>s.adminExport(f.token,{kind:'audit',filter:{}}),'ADMIN_ONLY');fails(()=>s.adminExport(f.admin,{kind:'audit',filter:{status:'active'}}),'INVALID_INPUT');
 }finally{f.s.close();}
});

test('revoke is atomic, reasoned, current-admin-only and exact retry never revokes regenerated source',async()=>{
 const f=await sharingFixture();try{const s=f.s,db=database(s);f.publish();assert.equal(typeof s.adminRevokeShare,'function');
 const link=s.shareRecord(f.token,f.recordId,{action:'create',revision:0}),reader=await s.auth.register(f.players[1],'oversight_reader','correct-password','reader'),favorite=s.saveSharedFavorite(reader.token,link.token!);
 const cmd={requestId:randomUUID(),expectedAdminId:s.auth.account(f.admin)!.id,recordId:f.recordId,revision:link.revision,confirmed:true as const,reason:'required reason'};
 fails(()=>s.adminRevokeShare(f.token,cmd),'ADMIN_ONLY');fails(()=>s.adminRevokeShare(f.admin,{...cmd,confirmed:false}),'INVALID_INPUT');fails(()=>s.adminRevokeShare(f.admin,{...cmd,expectedAdminId:randomUUID()}),'UNAUTHORIZED');
 db.exec("CREATE TRIGGER oversight_revoke_fail BEFORE INSERT ON admin_revoke_receipts BEGIN SELECT RAISE(ABORT,'receipt rollback'); END");assert.throws(()=>s.adminRevokeShare(f.admin,cmd),/receipt rollback/);assert.equal(s.adminShares(f.admin,{}).items[0].state,'active');assert.equal(s.adminAuditList(f.admin,{action:'share-revoke'}).items.length,0);
 db.exec('DROP TRIGGER oversight_revoke_fail');assert.deepEqual(s.adminRevokeShare(f.admin,cmd),{applied:true});assert.deepEqual(s.adminRevokeShare(f.admin,cmd),{applied:true});assert.equal(s.adminAuditList(f.admin,{action:'share-revoke'}).items.length,1);assert(s.notificationsList(f.token,{}).items.some(n=>n.body?.includes('required reason')));
 assert.throws(()=>s.sharedFavorite(reader.token,favorite.id));assert.throws(()=>s.sharedRecord(link.token!));
 const newer=s.shareRecord(f.token,f.recordId,{action:'regenerate',revision:link.revision+1});s.adminRevokeShare(f.admin,cmd);assert.equal(s.adminShares(f.admin,{}).items[0].state,'active');assert(s.sharedRecord(newer.token!));fails(()=>s.adminRevokeShare(f.admin,{...cmd,requestId:randomUUID()}),'STALE_SHARE');fails(()=>s.adminRevokeShare(f.admin,{...cmd,reason:'changed'}),'INVALID_INPUT');assert.throws(()=>s.sharedFavorite(reader.token,favorite.id));
 const guest=f.players[2];await s.auth.login(guest,'share_admin','correct-password');fails(()=>s.adminRevokeShare(f.admin,cmd),'ADMIN_ONLY');
 }finally{f.s.close();}
});

test('group dates use latest report, repeated reporters remain distinct, equal-time cursor pages are stable and filtered CSV matches',async()=>{
 const f=await sharingFixture();try{const s=f.s,db=database(s);f.publish();const scope={kind:'record' as const,id:f.recordId},other=await s.auth.register(f.players[1],'oversight_dates','correct-password','different reporter');
 for(let i=0;i<3;i++){const c=s.communityComment(f.token,{scope,requestId:randomUUID(),parentId:null,text:'body '+i}).comment;s.communityReport(f.token,{scope,requestId:randomUUID(),commentId:c.id,reason:'a'});s.communityReport(f.token,{scope,requestId:randomUUID(),commentId:c.id,reason:'same reporter again'});s.communityReport(other.token,{scope,requestId:randomUUID(),commentId:c.id,reason:'b'});db.prepare('UPDATE community_reports SET at=? WHERE comment_id=?').run(i<2?100:200,c.id);}
 const whole=s.adminReportGroups(f.admin,{});assert.equal(whole.items.length,3);assert(whole.items.every(g=>g.reportCount===2&&g.openCount===2));
 const filter={from:100,to:200,status:'open' as const},page=s.adminReportGroups(f.admin,{...filter,limit:1});assert.equal(page.items.length,1);assert(page.nextCursor);
 const page2=s.adminReportGroups(f.admin,{...filter,limit:50,cursor:page.nextCursor});assert.equal(page2.items.length,1);assert.equal(page2.nextCursor,null);assert.notEqual(page.items[0].commentId,page2.items[0].commentId);
 assert.equal(s.adminExport(f.admin,{kind:'reports',filter}).count,2);assert.equal(s.adminReportGroups(f.admin,{from:200}).items.length,1);assert.equal(s.adminReportGroups(f.admin,{to:100}).items.length,0);
 fails(()=>s.adminReportGroups(f.admin,{...filter,cursor:page.nextCursor,q:'分享'}),'INVALID_INPUT');fails(()=>s.adminAuditList(f.admin,{from:100,to:100}),'INVALID_INPUT');fails(()=>s.adminAuditList(f.admin,{q:'😀'.repeat(81)}),'INVALID_INPUT');assert.doesNotThrow(()=>s.adminAuditList(f.admin,{q:'😀'.repeat(80)}));
 }finally{f.s.close();}
});

test('CSV neutralizes every formula and leading control prefix, preserves quoted CRLF and accepts exactly 5000 rows',async()=>{
 const f=await sharingFixture();try{const s=f.s,db=database(s),insert=db.prepare('INSERT INTO admin_operations VALUES (?,?,?,?,?,?,?,?,?,?)');
 const values=['=1','+1','-1','@x','\t=1','\r@x',' \t-1','\u0000evil','\u200b=1',' plain','multi,"line"\r\nsecond'];
 db.transaction(()=>{for(let i=0;i<5000;i++)insert.run(randomUUID(),i,f.account.id,'actor',f.account.id,'target','warn',values[i%values.length],null,null);})();
 const csv=s.adminExport(f.admin,{kind:'audit',filter:{action:'warn'}});assert.equal(csv.count,5000);
 for(const value of values.slice(0,-1))assert(csv.csv.includes('"\''+value+'"'),JSON.stringify(value));assert(csv.csv.includes('"multi,""line""\r\nsecond"'));assert(csv.csv.endsWith('\r\n'));
 }finally{f.s.close();}
});

test('notification failure rolls back direct VIP audit and state, and fresh history never manufactures past changes',async()=>{
 const f=await sharingFixture();try{const s=f.s,db=database(s);db.prepare('DELETE FROM admin_operations').run();assert.equal(s.adminAuditList(f.admin,{}).items.length,0);const count=s.notificationsList(f.token,{}).items.length;
 db.exec("CREATE TRIGGER oversight_notice_fail BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'notification rollback'); END");
 assert.throws(()=>s.auth.setVip(f.admin,f.account.id,false,null),/notification rollback/);assert.equal(s.auth.account(f.token)?.vip?.active,true);assert.equal(s.adminAuditList(f.admin,{}).items.length,0);assert.equal(s.notificationsList(f.token,{}).items.length,count);
 db.exec('DROP TRIGGER oversight_notice_fail');s.auth.setVip(f.admin,f.account.id,false,null);assert.equal(s.adminAuditList(f.admin,{}).items.length,1);
 }finally{f.s.close();}
});

test('oversight reads preserve source acknowledgement and retention; revoke invalidates original favorite, comment and notification scopes',async()=>{
 const f=await sharingFixture();try{const s=f.s,db=database(s);f.publish();const share=s.shareRecord(f.token,f.recordId,{action:'create',revision:0}),scope={kind:'share' as const,token:share.token!},reader=await s.auth.register(f.players[1],'oversight_sources','correct-password','reader');
 const saved=s.saveSharedFavorite(reader.token,share.token!);s.notificationSettings(reader.token,{requestId:randomUUID(),revision:0,updates:true,replies:true,likes:true});
 const c=s.communityComment(reader.token,{scope,requestId:randomUUID(),parentId:null,text:'private comment body'}).comment;s.communityComment(f.token,{scope:{kind:'record',id:f.recordId},requestId:randomUUID(),parentId:c.id,text:'private reply'});
 s.saveRecord(f.token,f.id,1,{...f.document,notes:'UNPUBLISHED draft marker'});s.publishRecord(f.token,f.id,2);s.saveRecord(f.token,f.id,2,{...f.document,notes:'UNPUBLISHED second draft'});
 const activity=db.prepare('SELECT last_activity_at FROM rooms WHERE id=?').get(f.id),seen=db.prepare('SELECT * FROM favorite_seen').all();
 for(const kind of ['reports','audit','shares'] as const)s.adminExport(f.admin,{kind,filter:{}});s.adminShares(f.admin,{});s.adminAuditList(f.admin,{});s.adminReportGroups(f.admin,{});
 assert.deepEqual(db.prepare('SELECT last_activity_at FROM rooms WHERE id=?').get(f.id),activity);assert.deepEqual(db.prepare('SELECT * FROM favorite_seen').all(),seen);assert(s.favoriteLibrary(reader.token).items[0].hasUpdate);
 const current=s.adminShares(f.admin,{}).items[0];assert(!JSON.stringify(current).includes('UNPUBLISHED'));assert(!JSON.stringify(current).includes(share.token!));
 s.adminRevokeShare(f.admin,{requestId:randomUUID(),expectedAdminId:s.auth.account(f.admin)!.id,recordId:f.recordId,revision:current.revision,confirmed:true,reason:'source invalidation'});
 const inbox=s.notificationsList(reader.token,{});assert.equal(inbox.items.length,2);assert(inbox.items.every(n=>!n.available));for(const n of inbox.items)fails(()=>s.notificationOpen(reader.token,n.id),'NOTIFICATION_UNAVAILABLE');assert.throws(()=>s.communityRead(reader.token,{scope}));assert.throws(()=>s.sharedFavorite(reader.token,saved.id));
 assert(s.recordsList(f.token,f.id).own);assert.equal(s.auth.account(f.token)?.vip?.active,true);
 // Already-revoked current revision is a successful no-op, including mandatory notice and audit.
 const auditCount=s.adminAuditList(f.admin,{action:'share-revoke'}).items.length,notices=s.notificationsList(f.token,{}).items.length;
 s.adminRevokeShare(f.admin,{requestId:randomUUID(),expectedAdminId:s.auth.account(f.admin)!.id,recordId:f.recordId,revision:current.revision+1,confirmed:true,reason:'same current link'});assert.equal(s.adminAuditList(f.admin,{action:'share-revoke'}).items.length,auditCount);assert.equal(s.notificationsList(f.token,{}).items.length,notices);
 s.removeSharedFavorite(reader.token,saved.id);db.prepare('UPDATE rooms SET last_activity_at=0 WHERE id=?').run(f.id);assert(s.cleanupExpiredRooms().includes(f.id));assert.equal(s.adminShares(f.admin,{}).items[0].state,'revoked');assert.equal(s.adminShares(f.admin,{}).items[0].version,2);
 }finally{f.s.close();}
});

test('share oversight state precedence is revoked then paused then withdrawn; unfinished, unpublished and deleted sources are absent',async()=>{
 const f=await sharingFixture();try{const s=f.s,db=database(s);assert.deepEqual(s.adminShares(f.admin,{}).items,[]);f.publish();s.shareRecord(f.token,f.recordId,{action:'create',revision:0});
 s.withdrawRecord(f.token,f.id,1);assert.equal(s.adminShares(f.admin,{}).items[0].state,'withdrawn');s.auth.setVip(f.admin,f.account.id,false,null);assert.equal(s.adminShares(f.admin,{}).items[0].state,'paused');s.auth.setVip(f.admin,f.account.id,true,null);s.auth.setStatus(f.admin,f.account.id,'disabled');assert.equal(s.adminShares(f.admin,{}).items[0].state,'paused');
 db.prepare('UPDATE record_share_links SET revoked=1 WHERE record_id=?').run(f.recordId);assert.equal(s.adminShares(f.admin,{}).items[0].state,'revoked');
 for(const sql of ["UPDATE record_rooms SET ended=0 WHERE room_id=?","UPDATE record_drafts SET published_version=NULL WHERE room_id=?","UPDATE record_drafts SET deleted=1 WHERE room_id=?"]){
 // Roll back each deliberately unavailable source fixture so the next branch is independent.
 const run=db.transaction(()=>{db.prepare(sql).run(f.id);assert.equal(s.adminShares(f.admin,{}).items.length,0);fails(()=>s.adminRevokeShare(f.admin,{requestId:randomUUID(),expectedAdminId:s.auth.account(f.admin)!.id,recordId:f.recordId,revision:1,confirmed:true,reason:'missing source'}),'NOT_FOUND');throw Error('test rollback');});assert.throws(run,/test rollback/);}
 }finally{f.s.close();}
});
