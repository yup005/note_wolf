import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from '../apps/server/app.js';
import { sharingFixture } from './helpers/sharing-fixture.js';
async function setup() { const app = await createServer({ dbPath: ':memory:' }); await new Promise<void>(r => app.http.listen(0, '127.0.0.1', r)); const address = app.http.address(); assert.ok(address && typeof address === 'object'); const base = `http://127.0.0.1:${address.port}`, f = await sharingFixture(':memory:', app.store); f.publish(); const share = app.store.shareRecord(f.token, f.recordId, { action: 'create', revision: 0 }).token!; const send = (path: string, body: unknown, token?: string) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { cookie: 'wolf_session=' + token } : {}) }, body: JSON.stringify(body) }); return { app, base, f, scope: { kind: 'share', token: share }, send }; }
test('anonymous community read creates no session/cookie; commands need login and strict input', async () => { const t = await setup(); try {
    const read = await t.send('/api/community/read', { scope: t.scope });
    assert.equal(read.status, 200);
    assert.equal(read.headers.get('set-cookie'), null);
    assert.equal((await read.json()).viewer.account, null);
    for (const path of ['comment', 'like', 'game-like', 'report']) {
        const response = await t.send('/api/community/' + path, { scope: t.scope, requestId: randomUUID(), parentId: null, text: 'x' });
        assert.equal(response.status, 401);
    }
    for (const body of [{ scope: { kind: 'room', id: t.f.id } }, { scope: t.scope, author: t.f.account.id }, { scope: t.scope, limit: 51 }, { scope: t.scope, cursor: 'forged' }]) {
        const response = await t.send('/api/community/read', body);
        assert.equal(response.status, 400);
    }
    assert.equal((await t.send('/api/community/read?roomId=' + t.f.id, { scope: t.scope })).status, 400);
    const post = await t.send('/api/community/comment', { scope: t.scope, requestId: randomUUID(), parentId: null, text: '<script>原样文本</script>' }, t.f.token);
    assert.equal(post.status, 200);
    const comment = (await post.json()).comment;
    assert.equal(comment.body, '<script>原样文本</script>');
    assert.equal((await fetch(t.base + '/api/community/me', { headers: { cookie: 'wolf_session=' + t.f.token } })).status, 200);
    assert.equal((await fetch(t.base + '/api/admin/community/reports', { headers: { cookie: 'wolf_session=' + t.f.token } })).status, 403);
    assert.equal((await fetch(t.base + '/api/community/me?accountId=' + t.f.account.id, { headers: { cookie: 'wolf_session=' + t.f.token } })).status, 400);
    assert.equal((await t.send('/api/community/comment/' + comment.id, { text: 'edit' }, t.f.token)).status, 404);
}
finally {
    await t.app.close();
} });
test('HTTP moderation requires superadmin, explicit confirmation and current version', async () => { const t = await setup(); try {
    const c = await (await t.send('/api/community/comment', { scope: t.scope, requestId: randomUUID(), parentId: null, text: '违规评论' }, t.f.token)).json();
    assert.equal((await t.send('/api/community/report', { scope: t.scope, requestId: randomUUID(), commentId: c.comment.id, reason: '举报原因' }, t.f.token)).status, 200);
    const headers = { cookie: 'wolf_session=' + t.f.admin };
    const queue = await fetch(t.base + '/api/admin/community/reports', { headers });
    const r = (await queue.json()).items[0];
    const action = { requestId: randomUUID(), confirmed: true, version: r.version, targetVersion: r.comment.version, action: 'delete', reportId: r.id, reason: '移除违规' };
    assert.equal((await t.send('/api/admin/community/action', { ...action, confirmed: false }, t.f.admin)).status, 400);
    assert.equal((await t.send('/api/admin/community/action', { ...action, reason: '' }, t.f.admin)).status, 400);
    assert.equal((await t.send('/api/admin/community/action', action, t.f.token)).status, 403);
    assert.equal((await t.send('/api/admin/community/action', action, t.f.admin)).status, 200);
    assert.equal((await t.send('/api/admin/community/action', action, t.f.admin)).status, 200);
    assert.equal((await t.send('/api/admin/community/action', { ...action, requestId: randomUUID() }, t.f.admin)).status, 409);
    const publicPage = await (await t.send('/api/community/read', { scope: t.scope })).json();
    assert.equal(publicPage.items[0].body, null);
    assert.equal(publicPage.items[0].deleted, true);
    const reports = await fetch(t.base + '/api/admin/community/reports?status=reviewed&limit=1', { headers });
    assert.equal((await reports.json()).items.length, 1);
    for (const query of ['?status=invalid', '?limit=1&limit=2', '?accountId=' + t.f.account.id, '?cursor=forged'])
        assert.equal((await fetch(t.base + '/api/admin/community/reports' + query, { headers })).status, 400);
    assert.equal((await fetch(t.base + '/api/admin/community/audit', { headers })).status, 200);
    assert.equal((await fetch(t.base + '/api/admin/community/users/' + t.f.account.id, { headers })).status, 200);
    t.app.store.shareRecord(t.f.token, t.f.recordId, { action: 'revoke', revision: 1 });
    assert.equal((await t.send('/api/community/read', { scope: t.scope })).status, 404);
}
finally {
    await t.app.close();
} });
test('private community GET endpoints reject injected bodies', async () => { const t = await setup(); try {
    const { request } = await import('node:http');
    for (const path of ['/api/community/me', '/api/admin/community/reports', '/api/admin/community/audit', '/api/admin/community/users/' + t.f.account.id]) {
        const status = await new Promise<number>((resolve, reject) => { const data = JSON.stringify({ accountId: t.f.account.id }); const r = request(t.base + path, { method: 'GET', headers: { cookie: 'wolf_session=' + t.f.admin, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, res => { res.resume(); resolve(res.statusCode!); }); r.on('error', reject); r.end(data); });
        assert.equal(status, 400, path);
    }
}
finally {
    await t.app.close();
} });
