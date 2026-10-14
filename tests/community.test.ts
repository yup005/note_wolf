import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { sharingFixture } from './helpers/sharing-fixture.js';
const req = () => randomUUID();
const input = (scope: unknown, more = {}) => ({ scope, ...more });
async function fixture() { const f = await sharingFixture(); f.publish(); const share = f.s.shareRecord(f.token, f.recordId, { action: 'create', revision: 0 }).token!; return { ...f, scope: { kind: 'record' as const, id: f.recordId }, shareScope: { kind: 'share' as const, token: share } }; }
test('community reads and writes reuse original authority, including duplicate retries', async () => { const f = await fixture(); try {
    const { s, token, scope, shareScope } = f;
    assert.equal(s.communityRead(undefined, input(shareScope)).viewer.account, null);
    const command = input(shareScope, { requestId: req(), parentId: null, text: '公开评论' });
    const c = s.communityComment(token, command).comment;
    assert.equal(s.communityComment(token, command).comment.id, c.id);
    assert.equal(s.communityRead(token, input(scope)).items[0].id, c.id);
    assert.throws(() => s.communityRead(undefined, input(scope)), /UNAUTHORIZED/);
    s.shareRecord(token, f.recordId, { action: 'regenerate', revision: 1 });
    assert.throws(() => s.communityComment(token, command), /SHARE_UNAVAILABLE/);
    assert.throws(() => s.communityRead(token, input({ kind: 'record', id: f.id })), /NOT_FOUND/);
}
finally {
    f.s.close();
} });
test('nested replies paginate and deleted parents retain descendants, deny new actions', async () => { const f = await fixture(); try {
    const { s, token, scope } = f;
    const post = (parentId: string | null, text: string) => s.communityComment(token, input(scope, { parentId, text, requestId: req() })).comment;
    const root = post(null, 'root'), child = post(root.id, 'child'), deep = post(child.id, 'deep');
    assert.equal(deep.rootId, root.id);
    assert.equal(s.communityRead(token, input(scope, { parentId: root.id })).items[0].id, child.id);
    s.communityModerate(f.admin, { requestId: req(), confirmed: true, version: root.version, action: 'delete', commentId: root.id, reason: '违规内容' });
    const dead = s.communityRead(token, input(scope)).items[0];
    assert.equal(dead.body, null);
    assert.equal(dead.deleted, true);
    assert.equal(dead.childCount, 1);
    assert.equal(s.communityRead(token, input(scope, { parentId: root.id })).items[0].body, 'child');
    assert.throws(() => post(root.id, 'new'), /COMMENT_DELETED/);
    for (const method of ['communityLike', 'communityReport'] as const)
        assert.throws(() => s[method](token, input(scope, { requestId: req(), commentId: root.id, ...(method === 'communityReport' ? { reason: '违规' } : {}) })), /COMMENT_DELETED/);
}
finally {
    f.s.close();
} });
test('root keyset ordering and cursors are bounded to scope and parent', async () => { const f = await fixture(); try {
    const { s, token, scope } = f;
    for (let i = 0; i < 5; i++)
        s.communityComment(token, input(scope, { requestId: req(), parentId: null, text: String(i) }));
    const a = s.communityRead(token, input(scope, { sort: 'oldest', limit: 2 })), b = s.communityRead(token, input(scope, { sort: 'oldest', limit: 2, cursor: a.nextCursor }));
    assert.equal(new Set([...a.items, ...b.items].map(c => c.id)).size, 4);
    assert.throws(() => s.communityRead(token, input(scope, { sort: 'latest', cursor: a.nextCursor })), /INVALID_INPUT/);
    assert.throws(() => s.communityRead(token, input(scope, { cursor: 'forged' })), /INVALID_INPUT/);
    s.communityLike(token, input(scope, { requestId: req(), commentId: b.items[0].id }));
    assert.equal(s.communityRead(token, input(scope, { sort: 'hot' })).items[0].id, b.items[0].id);
}
finally {
    f.s.close();
} });
test('likes are irreversible and shared across published author versions', async () => { const f = await fixture(); try {
    const { s, token, scope, shareScope } = f, c = s.communityComment(token, input(scope, { requestId: req(), parentId: null, text: 'comment' })).comment;
    const like = input(scope, { requestId: req(), commentId: c.id });
    assert.equal(s.communityLike(token, like).count, 1);
    assert.equal(s.communityLike(token, input(shareScope, { requestId: req(), commentId: c.id })).count, 1);
    s.communityGameLike(token, input(scope, { requestId: req() }));
    assert.equal(s.communityGameLike(token, input(shareScope, { requestId: req() })).count, 1);
    s.saveRecord(token, f.id, 1, { ...f.document, notes: '第二版' });
    s.publishRecord(token, f.id, 2);
    assert.equal(s.communityRead(token, input(scope)).gameLikes, 1);
    assert.equal(s.communityRead(token, input(scope)).items[0].likes, 1);
}
finally {
    f.s.close();
} });
test('reports, versioned moderation, narrow mute, idempotence and own private notices', async () => { const f = await fixture(); try {
    const { s, token, scope } = f;
    const c = s.communityComment(token, input(scope, { requestId: req(), parentId: null, text: '违规' })).comment;
    s.communityReport(token, input(scope, { requestId: req(), commentId: c.id, reason: '骚扰' }));
    assert.equal(s.communityReports(f.admin, {}).items.length, 1);
    assert.throws(() => s.communityReports(token, {}), /ADMIN_ONLY/);
    const report = s.communityReports(f.admin, {}).items[0];
    const action = { requestId: req(), confirmed: true as const, version: report.version, targetVersion: 0, action: 'mute' as const, reportId: report.id, reason: '持续骚扰', until: null };
    s.communityModerate(f.admin, action);
    s.communityModerate(f.admin, action);
    assert.equal(s.communityAudit(f.admin, {}).items.length, 1);
    assert.throws(() => s.communityModerate(f.admin, { ...action, requestId: req() }), /STALE_COMMUNITY/);
    assert.equal(s.communityMe(token).viewer.canInteract, false);
    assert.equal(s.communityMe(token).notices.length, 1);
    assert.equal(s.communityMe(f.admin).notices.length, 0);
    assert.throws(() => s.communityComment(token, input(scope, { requestId: req(), parentId: null, text: 'again' })), /COMMENT_MUTED/);
    assert.throws(() => s.communityLike(token, input(scope, { requestId: req(), commentId: c.id })), /COMMENT_MUTED/);
    assert.equal(s.communityGameLike(token, input(scope, { requestId: req() })).liked, true);
    assert.equal(s.communityReport(token, input(scope, { requestId: req(), commentId: c.id, reason: '仍可举报' })).reported, true);
    const restriction = s.communityUser(f.admin, f.account.id).restriction!;
    s.communityModerate(f.admin, { requestId: req(), confirmed: true, version: restriction.version, action: 'unmute', accountId: f.account.id, reason: '解除' });
    assert.equal(s.communityMe(token).viewer.canInteract, true);
}
finally {
    f.s.close();
} });
test('guest sessions cannot interact; unknown body fields and mismatched idempotence rejected', async () => { const f = await fixture(); try {
    const guest = randomBytes(32).toString('hex');
    f.s.issueSession(guest);
    assert.throws(() => f.s.communityComment(guest, input(f.shareScope, { requestId: req(), parentId: null, text: 'guest' })), /LOGIN_REQUIRED/);
    const command = input(f.scope, { requestId: req(), parentId: null, text: 'ok' });
    f.s.communityComment(f.token, command);
    assert.throws(() => f.s.communityComment(f.token, { ...command, text: 'different' }), /COMMUNITY_REQUEST_CONFLICT/);
    assert.throws(() => f.s.communityComment(f.token, { ...command, accountId: f.account.id }), /INVALID_INPUT/);
}
finally {
    f.s.close();
} });
test('share favorites preserve original link authority on reads, writes and retry', async () => { const f = await fixture(); try {
    const { s, token, shareScope } = f, id = s.saveSharedFavorite(token, shareScope.token).id, scope = { kind: 'shared-favorite', id }, command = input(scope, { requestId: req(), parentId: null, text: '收藏阅读者' });
    s.communityComment(token, command);
    assert.equal(s.communityRead(token, input(scope)).items.length, 1);
    s.shareRecord(token, f.recordId, { action: 'regenerate', revision: 1 });
    assert.throws(() => s.communityRead(token, input(scope)), /SHARE_UNAVAILABLE/);
    assert.throws(() => s.communityComment(token, command), /SHARE_UNAVAILABLE/);
}
finally {
    f.s.close();
} });
test('share author VIP/status and record withdrawal are revalidated for every command', async () => { const f = await fixture(); try {
    const { s, token, scope, shareScope } = f, command = input(shareScope, { requestId: req(), parentId: null, text: '公开' });
    s.communityComment(token, command);
    s.auth.setVip(f.admin, f.account.id, false, null);
    assert.throws(() => s.communityRead(token, input(shareScope)), /SHARE_UNAVAILABLE/);
    assert.throws(() => s.communityComment(token, command), /SHARE_UNAVAILABLE/);
    s.auth.setVip(f.admin, f.account.id, true, null);
    s.withdrawRecord(token, f.id, 1);
    assert.throws(() => s.communityRead(token, input(scope)), /RECORD_WITHDRAWN/);
    assert.throws(() => s.communityRead(token, input(shareScope)), /SHARE_UNAVAILABLE/);
    s.publishRecord(token, f.id, 1);
    s.auth.setStatus(f.admin, f.account.id, 'disabled');
    assert.throws(() => s.communityRead(undefined, input(shareScope)), /SHARE_UNAVAILABLE/);
    assert.throws(() => s.communityComment(token, command), /UNAUTHORIZED/);
}
finally {
    f.s.close();
} });
test('anonymous projections expose no private text, author identifiers, reporter or source scope', async () => { const f = await fixture(); try {
    const c = f.s.communityComment(f.token, input(f.scope, { requestId: req(), parentId: null, text: '<script>plain</script>' })).comment;
    const page = f.s.communityRead(undefined, input(f.shareScope));
    assert.equal(page.items[0].body, '<script>plain</script>');
    assert.deepEqual(Object.keys(page.items[0]).sort(), ['author', 'avatarUrl', 'body', 'childCount', 'createdAt', 'deleted', 'id', 'liked', 'likes', 'parentId', 'reported', 'rootId', 'version']);
    assert.equal(JSON.stringify(page).includes(f.account.id), false);
    assert.equal(JSON.stringify(page).includes(f.shareScope.token), false);
    assert.equal(JSON.stringify(page).includes('已发布复盘'), false);
    assert.equal(c.author, '分享作者');
}
finally {
    f.s.close();
} });
test('temporary mute expiry, 30 day notice expiry and Los Angeles DST day likes persist after cleanup/restart', async () => { const { mkdtempSync, rmSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path'); const { LobbyStore } = await import('../packages/storage/lobby.js'); const dir = mkdtempSync(join(tmpdir(), 'wolf-community-')), path = join(dir, 'test.sqlite'); let now = Date.parse('2026-11-01T07:30:00Z'), s = new LobbyStore(path, undefined, false, () => now); const f = await sharingFixture(path, s); f.publish(); const scope = { kind: 'record', id: f.recordId }; try {
    const c = s.communityComment(f.token, input(scope, { requestId: req(), parentId: null, text: '持久评论' })).comment;
    const like = input(scope, { requestId: req() });
    assert.equal(s.communityGameLike(f.token, like).count, 1);
    now = Date.parse('2026-11-01T09:30:00Z');
    assert.equal(s.communityGameLike(f.token, input(scope, { requestId: req() })).count, 1);
    s.communityModerate(f.admin, { requestId: req(), confirmed: true, version: 0, action: 'mute', accountId: f.account.id, reason: '临时限制', until: now + 1000 });
    assert.equal(s.communityMe(f.token).viewer.canInteract, false);
    now += 1001;
    assert.equal(s.communityMe(f.token).viewer.canInteract, true);
    s.close();
    s = new LobbyStore(path, undefined, false, () => now);
    assert.equal(s.communityRead(f.token, input(scope)).items[0].id, c.id);
    now = Date.parse('2026-11-02T08:30:00Z');
    assert.equal(s.communityGameLike(f.token, input(scope, { requestId: req() })).count, 2);
    assert.equal(s.communityGameLike(f.token, like).count, 2);
    s.cleanupExpiredRooms();
    assert.throws(() => s.snapshot(f.id), /ROOM_NOT_FOUND/);
    assert.equal(s.communityRead(f.token, input(scope)).items[0].body, '持久评论');
    now += 31 * 86400000;
    assert.equal(s.communityMe(f.token).notices.length, 0);
    assert.equal(s.communityAudit(f.admin, {}).items.length, 1);
}
finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
} });
test('warnings retain the reason and duration of an existing comment punishment', async () => { const f = await fixture(); try {
    const { s, admin, account, token } = f;
    s.communityModerate(admin, { requestId: req(), confirmed: true, version: 0, action: 'mute', accountId: account.id, reason: '持续骚扰处罚', until: null });
    s.communityModerate(admin, { requestId: req(), confirmed: true, version: 1, action: 'warn', accountId: account.id, reason: '新的文明交流提醒' });
    assert.equal(s.communityMe(token).viewer.restriction?.reason, '持续骚扰处罚');
    assert.equal(s.communityMe(token).viewer.restriction?.until, null);
    assert.equal(s.communityUser(admin, account.id).restriction?.version, 2);
    assert.equal(s.communityMe(token).notices.some(n => n.reason === '新的文明交流提醒'), true);
}
finally {
    f.s.close();
} });
test('all record authors share a thread; a different archived game grants no comment authority', async () => { const f = await fixture(); try {
    const { fillRealPlayers, confirmRealPlayers } = await import('./helpers/real-players.js');
    const { s, token, scope } = f;
    const root = s.communityComment(token, input(scope, { requestId: req(), parentId: null, text: '同局线程' })).comment;
    const secondAuthor = await s.auth.register(f.players[1], 'comment_second_author', 'correct-password', '第二作者');
    s.auth.setVip(f.admin, secondAuthor.account.id, true, null);
    s.recordsList(secondAuthor.token, f.id);
    s.saveRecord(secondAuthor.token, f.id, 0, { ...f.document, notes: '第二作者公开版' });
    const second = s.publishRecord(secondAuthor.token, f.id, 1);
    const secondScope = { kind: 'record', id: second.id };
    assert.equal(s.communityRead(secondAuthor.token, input(secondScope)).items[0].id, root.id);
    s.communityGameLike(secondAuthor.token, input(secondScope, { requestId: req() }));
    assert.equal(s.communityRead(token, input(scope)).gameLikes, 1);
    const room = s.create(token, '第二局').room;
    s.select(token, room.id, 1);
    s.configure(token, room.id, { dealMethod: 'online', gameMode: 'manual' });
    const players = fillRealPlayers(s, token, room.id);
    s.setReady(token, room.id, true, 1);
    s.deal(token, room.id);
    confirmRealPlayers(s, room.id, players);
    s.confirmIdentity(token, room.id);
    s.start(token, room.id);
    const record = s.recordsList(token, room.id).own!;
    const roles = players.map((p, i) => ({ seat: i + 1, role: s.identity(i === 0 ? token : p, room.id).role }));
    const doc = { ...f.document, deaths: roles.filter(r => r.role === 'wolf').map(r => ({ seat: r.seat, round: 1, period: 'night' as const, cause: 'unrecorded' as const })) };
    s.saveRecord(token, room.id, 0, doc);
    s.commitManual(token, room.id, 1);
    s.publishRecord(token, room.id, 1);
    const other = { kind: 'record', id: record.id };
    for (const [method, body] of [['communityComment', { parentId: root.id, text: 'forged parent' }], ['communityLike', { commentId: root.id }], ['communityReport', { commentId: root.id, reason: 'forged report' }]] as const)
        assert.throws(() => s[method](token, input(other, { requestId: req(), ...body })), /NOT_FOUND/);
    assert.throws(() => s.communityRead(token, input(other, { parentId: root.id })), /NOT_FOUND/);
    assert.equal(s.communityRead(token, input(other)).items.length, 0);
}
finally {
    f.s.close();
} });
test('plain text Unicode limits, deep child pages, and pagination reject forged targets', async () => { const f = await fixture(); try {
    const { s, token, scope } = f;
    const post = (parentId: string | null, text: string) => s.communityComment(token, input(scope, { requestId: req(), parentId, text })).comment;
    const root = post(null, '🙂'.repeat(2000));
    assert.equal(Array.from(root.body!).length, 2000);
    assert.throws(() => post(null, '🙂'.repeat(2001)), /INVALID_INPUT/);
    assert.throws(() => post(null, '  '), /INVALID_INPUT/);
    assert.throws(() => post(req(), 'unknown parent'), /NOT_FOUND/);
    const children: ReturnType<typeof post>[] = [];
    for (let i = 0; i < 4; i++)
        children.push(post(root.id, String(i)));
    const page = s.communityRead(token, input(scope, { parentId: root.id, limit: 2 })), next = s.communityRead(token, input(scope, { parentId: root.id, limit: 2, cursor: page.nextCursor }));
    assert.equal(new Set([...page.items, ...next.items].map(c => c.id)).size, 4);
    assert.equal(next.nextCursor, null);
    assert.throws(() => s.communityRead(token, input(scope, { parentId: children[0].id, cursor: page.nextCursor })), /INVALID_INPUT/);
    assert.throws(() => s.communityRead(token, input(scope, { parentId: root.id, sort: 'hot', cursor: page.nextCursor })), /INVALID_INPUT/);
    let parent = children[0];
    for (let i = 0; i < 16; i++)
        parent = post(parent.id, 'deep ' + i);
    assert.equal(parent.rootId, root.id);
    assert.equal(s.communityRead(token, input(scope)).items[0].childCount, 4);
}
finally {
    f.s.close();
} });
test('moderation target and version selection are strict and stale failed actions leave no audit', async () => { const f = await fixture(); try {
    const { s, token, scope, admin, account } = f, c = s.communityComment(token, input(scope, { requestId: req(), parentId: null, text: '删除对象' })).comment;
    const base = { requestId: req(), confirmed: true, version: 0, action: 'warn', accountId: account.id, reason: '警告原因' };
    for (const bad of [{ ...base, confirmed: false }, { ...base, reason: '' }, { ...base, commentId: c.id }, { ...base, action: 'dismiss' }, { ...base, until: null }, { ...base, action: 'mute' }, { ...base, action: 'mute', until: Date.now() - 1 }])
        assert.throws(() => s.communityModerate(admin, bad), /INVALID_INPUT/);
    assert.throws(() => s.communityModerate(admin, { ...base, version: 1 }), /STALE_COMMUNITY/);
    assert.equal(s.communityAudit(admin, {}).items.length, 0);
    s.communityModerate(admin, base);
    assert.throws(() => s.communityModerate(admin, { ...base, reason: 'different' }), /COMMUNITY_REQUEST_CONFLICT/);
    assert.throws(() => s.communityModerate(admin, { ...base, requestId: req() }), /STALE_COMMUNITY/);
    s.communityModerate(admin, { requestId: req(), confirmed: true, version: c.version, action: 'delete', commentId: c.id, reason: '删除原因' });
    assert.throws(() => s.communityModerate(admin, { requestId: req(), confirmed: true, version: c.version, action: 'delete', commentId: c.id, reason: '再次删除' }), /STALE_COMMUNITY/);
    assert.equal(s.communityAudit(admin, {}).items.length, 2);
}
finally {
    f.s.close();
} });
test('report-target actions reject a stale target version after a newer direct restriction',async()=>{const f=await fixture();try{const {s,token,scope,admin,account}=f,c=s.communityComment(token,input(scope,{requestId:req(),parentId:null,text:'待处理报告'})).comment;s.communityReport(token,input(scope,{requestId:req(),commentId:c.id,reason:'内容举报'}));const report=s.communityReports(admin,{}).items[0];s.communityModerate(admin,{requestId:req(),confirmed:true,version:0,action:'mute',accountId:account.id,reason:'新处罚',until:null});assert.throws(()=>s.communityModerate(admin,{requestId:req(),confirmed:true,version:report.version,targetVersion:0,action:'unmute',reportId:report.id,reason:'旧报告解除'}),/STALE_COMMUNITY/);assert.equal(s.communityMe(token).viewer.restriction?.reason,'新处罚');assert.equal(s.communityReports(admin,{}).items[0].version,report.version);assert.equal(s.communityAudit(admin,{}).items.length,1);}finally{f.s.close();}});
test('community public avatars never expose an author account UUID',async()=>{const f=await fixture();try{const {default:sharp}=await import('sharp');const avatar=await sharp({create:{width:2,height:2,channels:3,background:'#abcdef'}}).png().toBuffer();await f.s.uploadAvatar(f.token,avatar,'image/png');f.s.communityComment(f.token,input(f.scope,{requestId:req(),parentId:null,text:'头像作者公开评论'}));const page=f.s.communityRead(undefined,input(f.shareScope));assert.equal(page.items[0].avatarUrl,null);assert.equal(JSON.stringify(page).includes(f.account.id),false);}finally{f.s.close();}});
test('duplicate comment retries return a current tombstone and report queue cursors remain strict',async()=>{const f=await fixture();try{const {s,token,scope,admin}=f;const commands=[];for(let i=0;i<3;i++){const command=input(scope,{requestId:req(),parentId:null,text:'报告 '+i});const c=s.communityComment(token,command).comment;commands.push({command,c});s.communityReport(token,input(scope,{requestId:req(),commentId:c.id,reason:'原因 '+i}));}const page=s.communityReports(admin,{limit:'2'}),next=s.communityReports(admin,{limit:'2',cursor:page.nextCursor});assert.equal(new Set([...page.items,...next.items].map(r=>r.id)).size,3);assert.equal(next.nextCursor,null);assert.throws(()=>s.communityReports(admin,{status:'reviewed',cursor:page.nextCursor}),/INVALID_INPUT/);const report=page.items[0];assert.equal(report.comment.version,1);assert.throws(()=>s.communityModerate(admin,{requestId:req(),confirmed:true,version:report.version,action:'delete',reportId:report.id,reason:'缺目标版本'}),/INVALID_INPUT/);s.communityModerate(admin,{requestId:req(),confirmed:true,version:report.version,targetVersion:report.comment.version,action:'delete',reportId:report.id,reason:'移除公开内容'});const original=commands.find(item=>item.c.id===report.comment.id)!;assert.equal(s.communityComment(token,original.command).comment.body,null);assert.equal(s.communityComment(token,original.command).comment.deleted,true);assert.throws(()=>s.communityModerate(admin,{requestId:req(),confirmed:true,version:0,targetVersion:0,action:'warn',accountId:f.account.id,reason:'直接不允许目标版本'}),/INVALID_INPUT/);assert.equal(s.communityAudit(admin,{limit:'1'}).items.length,1);}finally{f.s.close();}});
