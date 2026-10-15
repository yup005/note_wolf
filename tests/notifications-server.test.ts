import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from '../apps/server/app.js';
import { sharingFixture } from './helpers/sharing-fixture.js';
test('notification wire is strict, own-only, denies guest/revoked retries and focus keeps original scope', async () => {
    const app = await createServer({ dbPath: ':memory:', allowTestPlayers: true });
    try {
        const f = await sharingFixture(':memory:', app.store);
        f.publish();
        const guest = randomBytes(32).toString('hex');
        app.store.issueSession(guest);
        const reader = await app.store.auth.register(guest, 'notification_wire', 'correct-password', '读者');
        const anonymous = randomBytes(32).toString('hex');
        app.store.issueSession(anonymous);
        await new Promise<void>(r => app.http.listen(0, '127.0.0.1', r));
        const address = app.http.address();
        if (!address || typeof address === 'string')
            throw Error('addr');
        const base = `http://127.0.0.1:${address.port}`;
        const request = (token: string, path: string, body?: unknown) => fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { cookie: `wolf_session=${token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
        assert.equal((await request(anonymous, '/api/notifications')).status, 403);
        assert.equal((await request(reader.token, '/api/notifications?limit=0')).status, 400);
        assert.equal((await request(reader.token, '/api/notifications?accountId=' + f.account.id)).status, 400);
        const setting = { requestId: randomUUID(), revision: 0, updates: false, replies: true, likes: true };
        assert.equal((await request(reader.token, '/api/notifications/settings', { ...setting, extra: true })).status, 400);
        assert.equal((await request(reader.token, '/api/notifications/settings', setting)).status, 200);
        const share = app.store.shareRecord(f.token, f.recordId, { action: 'create', revision: 0 }).token!, scope = { kind: 'share' as const, token: share }, parent = app.store.communityComment(reader.token, { scope, requestId: randomUUID(), parentId: null, text: 'private comment marker' }).comment, child = app.store.communityComment(f.token, { scope: { kind: 'record', id: f.recordId }, requestId: randomUUID(), parentId: parent.id, text: 'reply text marker' }).comment;
        const response = await request(reader.token, '/api/notifications'), page = await response.json();
        assert.equal(response.status, 200);
        assert.equal(page.unreadCount, 1);
        assert.equal(JSON.stringify(page).includes(share), false);
        assert.equal(JSON.stringify(page).includes('marker'), false);
        const id = page.items[0].id;
        assert.equal((await request(f.admin, `/api/notifications/${id}/open`, {})).status, 404);
        assert.equal((await request(reader.token, `/api/notifications/${id}/open`, { id })).status, 400);
        const target = await (await request(reader.token, `/api/notifications/${id}/open`, {})).json();
        assert.deepEqual(target, { scope, focusCommentId: child.id });
        assert.equal((await request(reader.token, '/api/community/focus', { scope, commentId: child.id, accountId: reader.account.id })).status, 400);
        const focused = await (await request(reader.token, '/api/community/focus', { scope, commentId: child.id })).json();
        assert.equal(focused.parent.id, parent.id);
        const command = { requestId: randomUUID(), action: 'read', id, version: page.items[0].revision };
        assert.equal((await request(reader.token, '/api/notifications/command', { ...command, through: page.watermark })).status, 400);
        assert.equal((await request(reader.token, '/api/notifications/command', command)).status, 200);
        assert.equal((await request(reader.token, '/api/notifications/command', command)).status, 200);
        const loginGuest = randomBytes(32).toString('hex');
        app.store.issueSession(loginGuest);
        await app.store.auth.login(loginGuest, 'notification_wire', 'correct-password');
        assert.equal((await request(reader.token, '/api/notifications/command', command)).status, 401);
        assert.equal((await request(reader.token, '/api/notifications/settings', setting)).status, 401);
    }
    finally {
        await app.close();
    }
});
test('public share GET acknowledges an exact authenticated owner favorite without cookies or authority transfer', async () => {
    const app = await createServer({ dbPath: ':memory:', allowTestPlayers: true });
    try {
        const f = await sharingFixture(':memory:', app.store);
        f.publish();
        const guest = randomBytes(32).toString('hex');
        app.store.issueSession(guest);
        const reader = await app.store.auth.register(guest, 'wire_share_seen', 'correct-password', '读者'), share = app.store.shareRecord(f.token, f.recordId, { action: 'create', revision: 0 }).token!, favorite = app.store.saveSharedFavorite(reader.token, share);
        app.store.saveRecord(f.token, f.id, 1, { ...f.document, notes: 'second shared version' });
        app.store.publishRecord(f.token, f.id, 2);
        await new Promise<void>(r => app.http.listen(0, '127.0.0.1', r));
        const address = app.http.address();
        if (!address || typeof address === 'string')
            throw Error('addr');
        const base = `http://127.0.0.1:${address.port}`, get = (token: string | undefined, source = share) => fetch(`${base}/api/shared-records/${source}`, { headers: token ? { cookie: `wolf_session=${token}` } : {} }), marker = () => app.store.favoriteLibrary(reader.token).items[0].hasUpdate;
        const anonymous = await get(undefined);
        assert.equal(anonymous.status, 200);
        assert.equal(anonymous.headers.get('set-cookie'), null);
        assert.equal(marker(), true);
        assert.equal((await get(f.token)).status, 200);
        assert.equal(marker(), true);
        assert.equal((await get(reader.token)).status, 200);
        assert.equal(marker(), false);
        app.store.saveRecord(f.token, f.id, 2, { ...f.document, notes: 'third shared version' });
        app.store.publishRecord(f.token, f.id, 3);
        const next = app.store.shareRecord(f.token, f.recordId, { action: 'regenerate', revision: 1 }).token!;
        assert.equal((await get(reader.token, next)).status, 200);
        const db = (app.store as unknown as {
            db: import('better-sqlite3').Database;
        }).db, seen = db.prepare('SELECT version FROM favorite_seen WHERE owner=? AND kind=? AND target_id=?').get('account:' + reader.account.id, 'share', favorite.id) as {
            version: number;
        };
        assert.equal(seen.version, 2);
        assert.equal(app.store.sharedFavoriteStatus(reader.token, next).saved, false);
    }
    finally {
        await app.close();
    }
});
test('retained mutation wire bodies reject an account switch even when the replacement account revision matches', async () => { const app = await createServer({ dbPath: ':memory:', allowTestPlayers: true }); try {
    const f = await sharingFixture(':memory:', app.store);
    f.publish();
    const guest = randomBytes(32).toString('hex');
    app.store.issueSession(guest);
    const a = await app.store.auth.register(guest, 'wire_intent_a', 'correct-password', '账号甲'), b = await app.store.auth.register(f.players[2], 'wire_intent_b', 'correct-password', '账号乙');
    app.store.auth.setVip(f.admin, b.account.id, true, null);
    await new Promise<void>(r => app.http.listen(0, '127.0.0.1', r));
    const address = app.http.address();
    if (!address || typeof address === 'string')
        throw Error('addr');
    const base = `http://127.0.0.1:${address.port}`, post = (token: string, path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { cookie: `wolf_session=${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), settings = { requestId: randomUUID(), expectedAccountId: a.account.id, revision: 0, updates: true, replies: false, likes: true };
    assert.equal((await post(a.token, '/api/notifications/settings', settings)).status, 200);
    const before = app.store.notificationsList(b.token, {}), clear = { requestId: randomUUID(), expectedAccountId: a.account.id, action: 'clear', through: before.watermark };
    assert.equal((await post(a.token, '/api/notifications/command', clear)).status, 200);
    assert.equal((await post(b.token, '/api/notifications/settings', settings)).status, 401);
    assert.equal((await post(b.token, '/api/notifications/command', clear)).status, 401);
    assert.deepEqual(app.store.notificationsList(b.token, {}), before);
    assert.equal((await post(a.token, '/api/notifications/settings', settings)).status, 200);
    assert.equal((await post(a.token, '/api/notifications/command', clear)).status, 200);
}
finally {
    await app.close();
} });
