import {randomBytes} from 'node:crypto';
import {LobbyStore} from '../../packages/storage/lobby.js';
import {emptyRecord,type RecordDocument} from '../../packages/contracts/records.js';
export async function sharingFixture(path=':memory:',existing?:LobbyStore){
 const s=existing??new LobbyStore(path,undefined,true);const guest=randomBytes(32).toString('hex'),adminGuest=randomBytes(32).toString('hex');s.issueSession(guest);s.issueSession(adminGuest);
 await s.auth.createAccount('share_admin','correct-password','管理员','admin');const admin=await s.auth.login(adminGuest,'share_admin','correct-password');
 const room=s.create(guest,'分享房主').room,id=room.id;s.select(guest,id,1);s.configure(guest,id,{dealMethod:'online',gameMode:'manual'});s.fillTestPlayers(guest,id);s.setReady(guest,id,true,1);s.deal(guest,id);s.confirmIdentity(guest,id);s.start(guest,id);
 const draft=s.recordsList(guest,id).own!;const account=await s.auth.register(guest,'share_author','correct-password','分享作者'),token=account.token;s.auth.setVip(admin.token,account.account.id,true,null);
 const roles=s.testRoles(token,id).roles;const document:RecordDocument={...emptyRecord(),deaths:roles.filter(r=>r.role==='wolf').map(r=>({seat:r.seat,round:1,period:'night',cause:'unrecorded'})),notes:'已发布复盘'};
 function publish(){s.saveRecord(token,id,0,document);s.commitManual(token,id,1);return s.publishRecord(token,id,1);}
 return {s,id,room,recordId:draft.id,token,admin:admin.token,account:account.account,document,publish};
}
