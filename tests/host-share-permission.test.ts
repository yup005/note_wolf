import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sharingFixture} from './helpers/sharing-fixture.js';

// Catch treating free participant access or original host status as an external sharing entitlement.
test('non-VIP original host and participants retain published replay access without external sharing rights',async()=>{
 const f=await sharingFixture();const {s,token,recordId,id,admin,account,players}=f;
 try{
  f.publish();s.auth.setVip(admin,account.id,false,null);assert.equal(s.view(token,id).me.isHost,true);
  assert.equal(s.recordPost(token,recordId).document.notes,'已发布复盘');assert.equal(s.recordPost(players[1],recordId).document.notes,'已发布复盘');
  assert.equal(s.recordPost(token,recordId).shareAccess.create,false);assert.throws(()=>s.shareRecord(token,recordId,{action:'create',revision:0}),/VIP_ONLY/);
  const outsider=randomBytes(32).toString('hex');s.issueSession(outsider);assert.throws(()=>s.recordPost(outsider,recordId),/PARTICIPANT_ONLY/);
  s.auth.setVip(admin,account.id,true,null);const link=s.shareRecord(token,recordId,{action:'create',revision:0});assert.equal(s.sharedRecord(link.token!).document.notes,'已发布复盘');
  s.auth.setVip(admin,account.id,false,null);assert.throws(()=>s.sharedRecord(link.token!),/SHARE_UNAVAILABLE/);assert.equal(s.recordPost(players[1],recordId).document.notes,'已发布复盘');assert.equal(s.recordPost(token,recordId).document.notes,'已发布复盘');
  assert.throws(()=>s.shareRecord(token,recordId,{action:'regenerate',revision:link.revision}),/VIP_ONLY/);s.shareRecord(token,recordId,{action:'revoke',revision:link.revision});assert.equal(s.shareStatus(token,recordId).state,'revoked');
 }finally{s.close();}
});
