import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { sharingFixture } from './helpers/sharing-fixture.js';
const req = () => randomUUID();
async function fixture() { const f = await sharingFixture(); f.publish(); const share = f.s.shareRecord(f.token, f.recordId, { action: 'create', revision: 0 }).token!; const guest = randomBytes(32).toString('hex'); f.s.issueSession(guest); const reader = await f.s.auth.register(guest, 'notice_reader', 'correct-password', '读者'); return { ...f, reader, scope: { kind: 'record' as const, id: f.recordId }, shareScope: { kind: 'share' as const, token: share } }; }
test('notification subscriptions default off and old optional events do not backfill on toggle/retry', async () => {
    const f = await fixture();
    try {
        const { s, reader, shareScope } = f;
        assert.deepEqual(s.notificationsList(reader.token, {}).settings, { revision: 0, updates: false, replies: false, likes: false });
        const root = s.communityComment(reader.token, { scope: shareScope, requestId: req(), parentId: null, text: '原评论' }).comment;
        const old = { scope: f.scope, requestId: req(), parentId: root.id, text: '先前回复' };
        s.communityComment(f.token, old);
        s.notificationSettings(reader.token, { requestId: req(), revision: 0, updates: true, replies: true, likes: true });
        s.communityComment(f.token, old);
        assert.equal(s.notificationsList(reader.token, {}).items.length, 0);
        const fresh = s.communityComment(f.token, { ...old, requestId: req(), text: '新回复' }).comment;
        const page = s.notificationsList(reader.token, {});
        assert.equal(page.items.length, 1);
        assert.equal(page.items[0].kind, 'reply');
        assert.equal(page.items[0].body, null);
        assert.equal(JSON.stringify(page).includes(shareScope.token), false);
        assert.deepEqual(s.notificationOpen(reader.token, page.items[0].id), { scope: shareScope, focusCommentId: fresh.id });
        s.shareRecord(f.token, f.recordId, { action: 'regenerate', revision: 1 });
        assert.equal(s.notificationsList(reader.token, {}).items[0].available, false);
        assert.throws(() => s.notificationOpen(reader.token, page.items[0].id), /NOTIFICATION_UNAVAILABLE/);
    }
    finally {
        f.s.close();
    }
});
test('notification commands bind owner, exact payload and watermark while new aggregate survives', async () => {
    const f = await fixture();
    try {
        const { s, reader, scope, shareScope } = f;
        s.notificationSettings(reader.token, { requestId: req(), revision: 0, updates: false, replies: false, likes: true });
        const comment = s.communityComment(reader.token, { scope: shareScope, requestId: req(), parentId: null, text: '被赞' }).comment;
        s.communityLike(f.token, { scope, requestId: req(), commentId: comment.id });
        const page = s.notificationsList(reader.token, {}), notice = page.items[0];
        const other = await s.auth.register(f.players[2], 'notice_other', 'correct-password', '另一个');
        s.communityLike(other.token, { scope: shareScope, requestId: req(), commentId: comment.id });
        s.notificationCommand(reader.token, { requestId: req(), action: 'clear', through: page.watermark });
        assert.equal(s.notificationsList(reader.token, {}).items[0].count, 2);
        assert.throws(() => s.notificationCommand(reader.token, { requestId: req(), action: 'read', id: notice.id, version: notice.revision }), /STALE_NOTIFICATION/);
        assert.throws(() => s.notificationOpen(f.admin, notice.id), /NOT_FOUND/);
        const latest = s.notificationsList(reader.token, {}).items[0], command = { requestId: req(), action: 'delete', id: notice.id, version: latest.revision };
        s.notificationCommand(reader.token, command);
        assert.deepEqual(s.notificationCommand(reader.token, command), { applied: true });
        assert.throws(() => s.notificationCommand(reader.token, { ...command, action: 'read' }), /INVALID_INPUT/);
        s.communityLike(f.token, { scope, requestId: req(), commentId: comment.id });
        assert.equal(s.notificationsList(reader.token, {}).items.length, 0);
    }
    finally {
        f.s.close();
    }
});
test('favorite update marker is independent of settings and list validation never acknowledges it', async () => {
    const f = await fixture();
    try {
        const { s, reader, recordId } = f;
        const favorite = s.saveSharedFavorite(reader.token, f.shareScope.token);
        assert.equal(s.favoriteLibrary(reader.token).items[0].hasUpdate, false);
        s.saveRecord(f.token, f.id, 1, { ...f.document, notes: '新版' });
        s.publishRecord(f.token, f.id, 2);
        assert.equal(s.favoriteLibrary(reader.token).items[0].hasUpdate, true);
        assert.equal(s.favoriteLibrary(reader.token).items[0].hasUpdate, true);
        assert.equal(s.notificationsList(reader.token, {}).items.length, 0);
        s.sharedFavorite(reader.token, favorite.id);
        assert.equal(s.favoriteLibrary(reader.token).items[0].hasUpdate, false);
        s.saveRecordFavorite(f.token, recordId);
        s.saveRecord(f.token, f.id, 2, { ...f.document, notes: '再新版' });
        s.publishRecord(f.token, f.id, 3);
        s.recordPost(f.token, recordId, 1);
        assert.equal(s.favoriteLibrary(f.token).items.find(i => i.kind === 'record')?.hasUpdate, true);
        s.recordPost(f.token, recordId);
        assert.equal(s.favoriteLibrary(f.token).items.find(i => i.kind === 'record')?.hasUpdate, false);
    }
    finally {
        f.s.close();
    }
});
test('mandatory changes are emitted only on actual state change and settings receipts survive later revisions', async () => {
    const f = await fixture();
    try {
        const { s, reader } = f;
        const settings = { requestId: req(), revision: 0, updates: true, replies: false, likes: false };
        const first = s.notificationSettings(reader.token, settings);
        s.notificationSettings(reader.token, { ...settings, requestId: req(), revision: 1, updates: false });
        assert.deepEqual(s.notificationSettings(reader.token, settings), first);
        assert.throws(() => s.notificationSettings(reader.token, { ...settings, likes: true }), /INVALID_INPUT/);
        s.auth.setVip(f.admin, reader.account.id, true, null);
        s.auth.setVip(f.admin, reader.account.id, true, null);
        assert.equal(s.notificationsList(reader.token, {}).items.length, 1);
        assert.equal(s.notificationsList(f.admin, {}).items.length, 0);
        const watermark = s.notificationsList(reader.token, {}).watermark;
        s.auth.setVip(f.admin, f.account.id, false, null);
        assert.equal(s.notificationsList(reader.token, {}).watermark, watermark);
        s.auth.setStatus(f.admin, reader.account.id, 'disabled');
        assert.throws(() => s.notificationsList(reader.token, {}), /UNAUTHORIZED/);
        s.auth.setStatus(f.admin, reader.account.id, 'active');
        const guest = randomBytes(32).toString('hex');
        s.issueSession(guest);
        const next = await s.auth.login(guest, 'notice_reader', 'correct-password');
        assert.equal(s.notificationsList(next.token, {}).items.length, 3);
        assert.throws(() => s.notificationSettings(reader.token, settings), /UNAUTHORIZED/);
    }
    finally {
        f.s.close();
    }
});
test('update recipients dedupe participant and original-share favorites, invalidate removed sources, preserve markers', async () => {
    const f = await fixture();
    try {
        const { s, scope, shareScope } = f;
        const reader = await s.auth.register(f.players[1], 'participant_reader', 'correct-password', '参与读者');
        s.notificationSettings(reader.token, { requestId: req(), revision: 0, updates: true, replies: false, likes: false });
        s.saveRecordFavorite(reader.token, f.recordId);
        s.saveSharedFavorite(reader.token, shareScope.token);
        s.saveRecord(f.token, f.id, 1, { ...f.document, notes: '通知新版' });
        s.publishRecord(f.token, f.id, 2);
        s.publishRecord(f.token, f.id, 2);
        const page = s.notificationsList(reader.token, {});
        assert.equal(page.items.length, 1);
        assert.deepEqual(s.notificationOpen(reader.token, page.items[0].id), { scope });
        assert.equal(s.favoriteLibrary(reader.token).items.every(i => i.hasUpdate), true);
        s.notificationsList(reader.token, {});
        assert.equal(s.favoriteLibrary(reader.token).items.every(i => i.hasUpdate), true);
        s.removeRecordFavorite(reader.token, f.recordId);
        assert.equal(s.notificationsList(reader.token, {}).items[0].available, false);
        assert.throws(() => s.notificationOpen(reader.token, page.items[0].id), /NOTIFICATION_UNAVAILABLE/);
        s.saveRecordFavorite(reader.token, f.recordId);
        assert.equal(s.favoriteLibrary(reader.token).items.find(i => i.kind === 'record')?.hasUpdate, false);
        s.withdrawRecord(f.token, f.id, 2);
        assert.equal(s.favoriteLibrary(reader.token).items.every(i => i.hasUpdate === false), true);
    }
    finally {
        f.s.close();
    }
});
test('signed cursors bind owner and focus fetches exact comment and tombstone parent outside normal page', async () => {
    const f = await fixture();
    try {
        const { s, reader, shareScope, scope } = f;
        s.notificationSettings(reader.token, { requestId: req(), revision: 0, updates: false, replies: true, likes: false });
        const root = s.communityComment(reader.token, { scope: shareScope, requestId: req(), parentId: null, text: 'parent' }).comment;
        let child!: ReturnType<typeof s.communityComment>['comment'];
        for (let i = 0; i < 3; i++)
            child = s.communityComment(f.token, { scope, requestId: req(), parentId: root.id, text: 'reply ' + i }).comment;
        const a = s.notificationsList(reader.token, { limit: '2' }), b = s.notificationsList(reader.token, { limit: '2', cursor: a.nextCursor });
        assert.equal(new Set([...a.items, ...b.items].map(i => i.id)).size, 3);
        assert.throws(() => s.notificationsList(f.token, { cursor: a.nextCursor }), /INVALID_INPUT/);
        assert.throws(() => s.notificationsList(reader.token, { cursor: 'bad' }), /INVALID_INPUT/);
        s.communityModerate(f.admin, { requestId: req(), confirmed: true, action: 'delete', commentId: root.id, version: root.version, reason: '移除' });
        const focus = s.communityFocus(reader.token, { scope: shareScope, commentId: child.id });
        assert.equal(focus.comment.body, 'reply 2');
        assert.equal(focus.parent?.body, null);
        assert.equal(focus.parent?.deleted, true);
        assert.throws(() => s.communityFocus(reader.token, { scope: { kind: 'record', id: req() }, commentId: child.id }), /NOT_FOUND/);
        s.communityModerate(f.admin, { requestId: req(), confirmed: true, action: 'delete', commentId: child.id, version: child.version, reason: '移除回复' });
        assert.equal(s.communityFocus(undefined, { scope: shareScope, commentId: child.id }).comment.body, null);
    }
    finally {
        f.s.close();
    }
});
test('like aggregate has fixed generation expiry; new actor may replace expiry but old likes never resurrect it', async () => {
    const { LobbyStore } = await import('../packages/storage/lobby.js');
    let now = 100000;
    const s = new LobbyStore(':memory:', undefined, false, () => now);
    const f = await sharingFixture(':memory:', s);
    f.publish();
    try {
        const share = s.shareRecord(f.token, f.recordId, { action: 'create', revision: 0 }).token!, scope = { kind: 'share' as const, token: share }, g = randomBytes(32).toString('hex');
        s.issueSession(g);
        const recipient = await s.auth.register(g, 'expiry_recipient', 'correct-password', '收件人');
        s.notificationSettings(recipient.token, { requestId: req(), revision: 0, updates: false, replies: false, likes: true });
        const c = s.communityComment(recipient.token, { scope, requestId: req(), parentId: null, text: 'comment' }).comment;
        s.communityLike(f.token, { scope, requestId: req(), commentId: c.id });
        const original = s.notificationsList(recipient.token, {}).items[0];
        now += 29 * 86400000;
        const second = await s.auth.register(f.players[2], 'expiry_second', 'correct-password', '第二人');
        s.communityLike(second.token, { scope, requestId: req(), commentId: c.id });
        assert.equal(s.notificationsList(recipient.token, {}).items[0].createdAt, original.createdAt);
        assert.equal(s.notificationsList(recipient.token, {}).items[0].count, 2);
        now = original.createdAt + 30 * 86400000;
        assert.equal(s.cleanupNotifications(), 2);
        assert.equal(s.notificationsList(recipient.token, {}).items.length, 0);
        s.communityLike(f.token, { scope, requestId: req(), commentId: c.id });
        assert.equal(s.notificationsList(recipient.token, {}).items.length, 0);
        const third = await s.auth.register(f.players[3], 'expiry_third', 'correct-password', '第三人');
        s.communityLike(third.token, { scope, requestId: req(), commentId: c.id });
        assert.equal(s.notificationsList(recipient.token, {}).items[0].count, 1);
        assert.notEqual(s.notificationsList(recipient.token, {}).items[0].id, original.id);
    }
    finally {
        s.close();
    }
});
test('legacy migration retains original invalid scope, seeds source events, and cleared mandatory messages never return', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs'), { tmpdir } = await import('node:os'), { join } = await import('node:path'), { LobbyStore } = await import('../packages/storage/lobby.js');
    const dir = mkdtempSync(join(tmpdir(), 'wolf-notice-')), file = join(dir, 'db');
    let now = 100000, s = new LobbyStore(file, undefined, false, () => now);
    try {
        const f = await sharingFixture(file, s);
        f.publish();
        const share = s.shareRecord(f.token, f.recordId, { action: 'create', revision: 0 }).token!, scope = { kind: 'share' as const, token: share };
        const g = randomBytes(32).toString('hex');
        s.issueSession(g);
        const reader = await s.auth.register(g, 'legacy_reader', 'correct-password', '旧读者');
        const parent = s.communityComment(reader.token, { scope, requestId: req(), parentId: null, text: 'legacy parent' }).comment;
        s.communityLike(f.token, { scope, requestId: req(), commentId: parent.id });
        s.saveSharedFavorite(reader.token, share);
        s.communityModerate(f.admin, { requestId: req(), confirmed: true, action: 'warn', accountId: reader.account.id, version: 0, reason: '旧审核消息' });
        s.shareRecord(f.token, f.recordId, { action: 'regenerate', revision: 1 });
        const db = (s as unknown as {
            db: import('better-sqlite3').Database;
        }).db;
        db.exec("DELETE FROM notifications;DELETE FROM notification_events;DELETE FROM notification_comment_sources;DELETE FROM favorite_seen;DELETE FROM notification_config WHERE key='source-migration'");
        s.close();
        s = new LobbyStore(file, undefined, false, () => now);
        const migrated = s.notificationsList(reader.token, {});
        assert.equal(migrated.items.length, 1);
        assert.equal(migrated.items[0].kind, 'moderation');
        assert.match(migrated.items[0].body!, /旧审核消息/);
        s.notificationSettings(reader.token, { requestId: req(), revision: 0, updates: true, replies: true, likes: true });
        s.publishRecord(f.token, f.id, 1);
        s.communityLike(f.token, { scope: { kind: 'record', id: f.recordId }, requestId: req(), commentId: parent.id });
        assert.equal(s.notificationsList(reader.token, {}).items.length, 1);
        s.communityComment(f.token, { scope: { kind: 'record', id: f.recordId }, requestId: req(), parentId: parent.id, text: 'new reply' });
        const reply = s.notificationsList(reader.token, {}).items.find(n => n.kind === 'reply')!;
        assert.equal(reply.available, false);
        assert.throws(() => s.notificationOpen(reader.token, reply.id), /NOTIFICATION_UNAVAILABLE/);
        const page = s.notificationsList(reader.token, {}), clear = { requestId: req(), action: 'clear', through: page.watermark };
        s.notificationCommand(reader.token, clear);
        s.close();
        s = new LobbyStore(file, undefined, false, () => now);
        assert.equal(s.notificationsList(reader.token, {}).items.length, 0);
        assert.deepEqual(s.notificationCommand(reader.token, clear), { applied: true });
        assert.equal(s.communityMe(reader.token).notices.length, 0);
        assert.equal(s.communityAudit(f.admin, {}).items.length, 1);
        now += 31 * 86400000;
        s.cleanupNotifications();
        assert.equal(s.communityRead(f.token, { scope: { kind: 'record', id: f.recordId } }).items.length, 1);
        assert.equal(s.recordPost(f.token, f.recordId).document.notes, '已发布复盘');
    }
    finally {
        s.close();
        rmSync(dir, { recursive: true, force: true });
    }
});
test('notification source failures roll back comments, publication, moderation and direct VIP writes', async () => {
    const f = await fixture();
    try {
        const { s } = f, db = (s as unknown as {
            db: import('better-sqlite3').Database;
        }).db;
        db.exec("CREATE TRIGGER reject_notice_event BEFORE INSERT ON notification_events BEGIN SELECT RAISE(ABORT,'notification-failure'); END");
        assert.throws(() => s.communityComment(f.token, { scope: f.scope, requestId: req(), parentId: null, text: 'must rollback' }), /notification-failure/);
        assert.equal(s.communityRead(f.token, { scope: f.scope }).items.length, 0);
        s.saveRecord(f.token, f.id, 1, { ...f.document, notes: 'new draft' });
        assert.throws(() => s.publishRecord(f.token, f.id, 2), /notification-failure/);
        assert.equal(s.recordPost(f.token, f.recordId).version, 1);
        assert.throws(() => s.communityModerate(f.admin, { requestId: req(), confirmed: true, version: 0, action: 'warn', accountId: f.reader.account.id, reason: 'must rollback' }), /notification-failure/);
        assert.equal(s.communityAudit(f.admin, {}).items.length, 0);
        db.exec("DROP TRIGGER reject_notice_event;CREATE TRIGGER reject_notice BEFORE INSERT ON notifications BEGIN SELECT RAISE(ABORT,'inbox-failure'); END");
        assert.throws(() => s.auth.setVip(f.admin, f.reader.account.id, true, null), /inbox-failure/);
        assert.equal(s.auth.account(f.reader.token)?.vip?.active, false);
    }
    finally {
        f.s.close();
    }
});
test('guest favorite seen state binds safely without moving account inbox or settings', async () => {
    const f = await fixture();
    try {
        const { s } = f, guest = f.players[1];
        s.saveRecordFavorite(guest, f.recordId);
        s.saveRecord(f.token, f.id, 1, { ...f.document, notes: 'newer than guest seen' });
        s.publishRecord(f.token, f.id, 2);
        assert.equal(s.favoriteLibrary(guest).items[0].hasUpdate, true);
        const bound = await s.auth.register(guest, 'bound_reader', 'correct-password', '绑定读者');
        assert.equal(s.favoriteLibrary(bound.token).items[0].hasUpdate, true);
        assert.deepEqual(s.notificationsList(bound.token, {}).settings, { revision: 0, updates: false, replies: false, likes: false });
        assert.equal(s.notificationsList(bound.token, {}).items.length, 0);
        s.recordPost(bound.token, f.recordId);
        assert.equal(s.favoriteLibrary(bound.token).items[0].hasUpdate, false);
    }
    finally {
        f.s.close();
    }
});
test('expiry physically removes inbox and legacy display only, retaining restrictions/audit/source records', async () => {
    const { LobbyStore } = await import('../packages/storage/lobby.js');
    let now = 100000;
    const s = new LobbyStore(':memory:', undefined, false, () => now), f = await sharingFixture(':memory:', s);
    f.publish();
    try {
        s.communityModerate(f.admin, { requestId: req(), confirmed: true, version: 0, action: 'mute', accountId: f.account.id, reason: '永久处罚', until: null });
        assert.equal(s.communityMe(f.token).notices.length, 1);
        assert.equal(s.communityUser(f.admin, f.account.id).notices.length, 0);
        assert.equal(s.communityUser(f.admin, f.account.id).restriction?.reason, '永久处罚');
        const db = (s as unknown as {
            db: import('better-sqlite3').Database;
        }).db;
        now += 30 * 86400000;
        s.cleanupNotifications();
        assert.equal((db.prepare('SELECT count(*) n FROM notifications').get() as {
            n: number;
        }).n, 0);
        assert.equal((db.prepare('SELECT count(*) n FROM community_notices').get() as {
            n: number;
        }).n, 0);
        assert.equal(s.communityMe(f.token).viewer.canInteract, false);
        assert.equal(s.communityAudit(f.admin, {}).items.length, 1);
        assert.equal(s.recordPost(f.token, f.recordId).document.notes, '已发布复盘');
    }
    finally {
        s.close();
    }
});
test('guest favorite binding preserves existing account seen version and optional settings', async () => {
    const f = await fixture();
    try {
        const { s } = f, guest = f.players[1], reader = await s.auth.register(f.players[2], 'existing_seen', 'correct-password', '已有账号');
        s.saveRecordFavorite(guest, f.recordId);
        s.saveRecordFavorite(reader.token, f.recordId);
        s.notificationSettings(reader.token, { requestId: req(), revision: 0, updates: false, replies: true, likes: false });
        s.saveRecord(f.token, f.id, 1, { ...f.document, notes: 'new published' });
        s.publishRecord(f.token, f.id, 2);
        s.recordPost(reader.token, f.recordId);
        assert.equal(s.favoriteLibrary(guest).items[0].hasUpdate, true);
        const db = (s as unknown as {
            db: import('better-sqlite3').Database;
        }).db;
        db.prepare('DELETE FROM rooms WHERE id=?').run(f.id);
        const next = await s.auth.login(guest, 'existing_seen', 'correct-password');
        assert.equal(s.favoriteLibrary(next.token).items[0].hasUpdate, false);
        assert.equal(s.notificationsList(next.token, {}).settings.replies, true);
        assert.throws(() => s.notificationsList(reader.token, {}), /UNAUTHORIZED/);
    }
    finally {
        f.s.close();
    }
});
test('stale read-all preserves new merged likes and replies; receipt kinds and stale settings cannot cross', async () => {
    const f = await fixture();
    try {
        const { s, reader, shareScope, scope } = f, setting = { requestId: req(), revision: 0, updates: false, replies: true, likes: true };
        s.notificationSettings(reader.token, setting);
        assert.throws(() => s.notificationSettings(reader.token, { ...setting, requestId: req(), likes: false }), /STALE_NOTIFICATION/);
        assert.deepEqual(s.notificationsList(reader.token, {}).settings, { revision: 1, updates: false, replies: true, likes: true });
        assert.throws(() => s.notificationCommand(reader.token, { requestId: setting.requestId, action: 'clear', through: 0 }), /INVALID_INPUT/);
        const root = s.communityComment(reader.token, { scope: shareScope, requestId: req(), parentId: null, text: 'root' }).comment;
        s.communityLike(f.token, { scope, requestId: req(), commentId: root.id });
        const old = s.notificationsList(reader.token, {}), second = await s.auth.register(f.players[2], 'readall_second', 'correct-password', '第二人');
        s.communityLike(second.token, { scope: shareScope, requestId: req(), commentId: root.id });
        s.communityComment(f.token, { scope, requestId: req(), parentId: root.id, text: 'new reply' });
        s.notificationCommand(reader.token, { requestId: req(), action: 'read-all', through: old.watermark });
        const page = s.notificationsList(reader.token, {});
        assert.equal(page.items.length, 2);
        assert.equal(page.items.every(n => n.readAt === null), true);
        s.notificationCommand(reader.token, { requestId: req(), action: 'read-all', through: page.watermark });
        const read = s.notificationsList(reader.token, {});
        assert.equal(read.unreadCount, 0);
        assert.equal(read.watermark, page.watermark);
        assert.deepEqual(read.items.map(i => i.revision), page.items.map(i => i.revision));
    }
    finally {
        f.s.close();
    }
});
test('community/focus/notification source validation never acknowledges a shared favorite update', async () => {
    const f = await fixture();
    try {
        const { s, reader } = f;
        s.notificationSettings(reader.token, { requestId: req(), revision: 0, updates: true, replies: true, likes: true });
        const favorite = s.saveSharedFavorite(reader.token, f.shareScope.token), scope = { kind: 'shared-favorite' as const, id: favorite.id }, parent = s.communityComment(reader.token, { scope, requestId: req(), parentId: null, text: 'own parent' }).comment;
        s.saveRecord(f.token, f.id, 1, { ...f.document, notes: 'updated' });
        s.publishRecord(f.token, f.id, 2);
        const child = s.communityComment(f.token, { scope: f.scope, requestId: req(), parentId: parent.id, text: 'reply' }).comment;
        const updated = () => s.favoriteLibrary(reader.token).items[0].hasUpdate;
        assert.equal(updated(), true);
        s.communityRead(reader.token, { scope });
        assert.equal(updated(), true);
        s.communityFocus(reader.token, { scope, commentId: child.id });
        assert.equal(updated(), true);
        const notice = s.notificationsList(reader.token, {}).items.find(n => n.kind === 'record-update')!;
        s.notificationOpen(reader.token, notice.id);
        assert.equal(updated(), true);
        s.auth.setVip(f.admin, f.account.id, false, null);
        assert.equal(updated(), false);
        assert.equal(s.notificationsList(reader.token, {}).items.every(n => !n.available), true);
        s.auth.setVip(f.admin, f.account.id, true, null);
        assert.equal(updated(), true);
        assert.deepEqual(s.notificationOpen(reader.token, notice.id), { scope });
        s.sharedFavorite(reader.token, favorite.id);
        assert.equal(updated(), false);
    }
    finally {
        f.s.close();
    }
});
test('authenticated public shared-record reads acknowledge only the exact owned original favorite', async () => {
    const f = await fixture();
    try {
        const { s, reader } = f, favorite = s.saveSharedFavorite(reader.token, f.shareScope.token);
        s.saveRecord(f.token, f.id, 1, { ...f.document, notes: 'shared latest' });
        s.publishRecord(f.token, f.id, 2);
        const marker = () => s.favoriteLibrary(reader.token).items[0].hasUpdate;
        assert.equal(marker(), true);
        s.sharedRecord(f.shareScope.token);
        assert.equal(marker(), true);
        s.sharedRecord(f.shareScope.token, f.token);
        assert.equal(marker(), true);
        s.sharedRecord(f.shareScope.token, 'invalid-revoked-token');
        assert.equal(marker(), true);
        s.sharedRecord(f.shareScope.token, reader.token);
        assert.equal(marker(), false);
        s.saveRecord(f.token, f.id, 2, { ...f.document, notes: 'next latest' });
        s.publishRecord(f.token, f.id, 3);
        const next = s.shareRecord(f.token, f.recordId, { action: 'regenerate', revision: 1 }).token!;
        s.sharedRecord(next, reader.token);
        const db = (s as unknown as {
            db: import('better-sqlite3').Database;
        }).db, seen = db.prepare('SELECT version FROM favorite_seen WHERE owner=? AND kind=? AND target_id=?').get('account:' + reader.account.id, 'share', favorite.id) as {
            version: number;
        };
        assert.equal(seen.version, 2);
        assert.equal(s.sharedFavoriteStatus(reader.token, next).saved, false);
    }
    finally {
        f.s.close();
    }
});
test('retained settings and bulk intents reject another active cookie owner before receipts or mutation', async () => { const f = await fixture(); try {
    const { s, reader } = f;
    const settings = { requestId: req(), expectedAccountId: reader.account.id, revision: 0, updates: true, replies: true, likes: false };
    s.notificationSettings(reader.token, settings);
    const other = await s.auth.register(f.players[2], 'intent_other', 'correct-password', '其他账号');
    s.auth.setVip(f.admin, other.account.id, true, null);
    const before = s.notificationsList(other.token, {}), clear = { requestId: req(), expectedAccountId: reader.account.id, action: 'clear', through: before.watermark };
    assert.deepEqual(s.notificationCommand(reader.token, clear), { applied: true });
    assert.throws(() => s.notificationSettings(other.token, settings), /UNAUTHORIZED/);
    assert.throws(() => s.notificationCommand(other.token, clear), /UNAUTHORIZED/);
    assert.deepEqual(s.notificationsList(other.token, {}), before);
    assert.deepEqual(s.notificationSettings(reader.token, settings).settings, { revision: 1, updates: true, replies: true, likes: false });
    assert.deepEqual(s.notificationCommand(reader.token, clear), { applied: true });
}
finally {
    f.s.close();
} });
