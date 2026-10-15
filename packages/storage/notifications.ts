import type Database from 'better-sqlite3';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { ZodType } from 'zod';
import { LobbyError } from '../contracts/index.js';
import { communityScopeSchema, type CommunityScope } from '../contracts/community.js';
import { notificationListSchema, notificationSettingsSchema, notificationCommandSchema, type NotificationSettings, type NotificationItem, type NotificationPage, type NotificationTarget } from '../contracts/notifications.js';
import type { AuthStore } from './auth.js';
const ttl = 30 * 86400000;
const parse = <T>(schema: ZodType<T>, input: unknown): T => {
    const c = schema.safeParse(input);
    if (!c.success)
        throw new LobbyError('INVALID_INPUT');
    return c.data;
};
interface NoticeRow {
    id: string;
    account_id: string;
    kind: NotificationItem['kind'];
    body: string | null;
    created_at: number;
    updated_at: number;
    count: number;
    revision: number;
    read_at: number | null;
    scope: string | null;
    focus_id: string | null;
    favorite_kind: 'record' | 'share' | null;
    favorite_id: string | null;
    group_id: string | null;
}
interface LegacyNotice {
    id: string;
    account_id: string;
    at: number;
    action: string;
    reason: string;
    until: number | null;
}
type Validate = (owner: string, scope: CommunityScope) => void;
/** Private inbox metadata; source bodies and bearer authority never enter projections. */
export class NotificationsStore {
    private key: Buffer;
    constructor(private db: Database.Database, private auth: AuthStore, private now: () => number, private validate: Validate) {
        db.exec(`CREATE TABLE IF NOT EXISTS notification_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS notification_settings(account_id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,updates INTEGER NOT NULL DEFAULT 0,replies INTEGER NOT NULL DEFAULT 0,likes INTEGER NOT NULL DEFAULT 0,sequence INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,kind TEXT NOT NULL,body TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,count INTEGER NOT NULL,revision INTEGER NOT NULL,read_at INTEGER,scope TEXT,focus_id TEXT,favorite_kind TEXT,favorite_id TEXT,group_id TEXT);
   CREATE INDEX IF NOT EXISTS notification_inbox ON notifications(account_id,updated_at DESC,id DESC);
   CREATE TABLE IF NOT EXISTS notification_events(event_key TEXT PRIMARY KEY);
   CREATE TABLE IF NOT EXISTS notification_receipts(account_id TEXT NOT NULL,request_id TEXT NOT NULL,payload TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(account_id,request_id));
   CREATE TABLE IF NOT EXISTS notification_comment_sources(comment_id TEXT PRIMARY KEY,account_id TEXT NOT NULL,scope TEXT);
   CREATE TABLE IF NOT EXISTS favorite_seen(owner TEXT NOT NULL,kind TEXT NOT NULL,target_id TEXT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(owner,kind,target_id));`);
        db.prepare('INSERT OR IGNORE INTO notification_config VALUES (?,?)').run('cursor-key', randomBytes(32).toString('hex'));
        this.key = Buffer.from((db.prepare('SELECT value FROM notification_config WHERE key=?').get('cursor-key') as {
            value: string;
        }).value, 'hex');
        db.transaction(() => {
            if (!db.prepare('SELECT 1 FROM notification_config WHERE key=?').get('source-migration')) {
                for (const row of db.prepare('SELECT record_id,version FROM record_versions').all() as {
                    record_id: string;
                    version: number;
                }[])
                    this.consume(`publication:${row.record_id}:${row.version}`);
                for (const row of db.prepare('SELECT id,account_id FROM community_comments').all() as {
                    id: string;
                    account_id: string;
                }[]) {
                    this.consume('comment:' + row.id);
                    this.saveCommentSource(row.id, row.account_id, this.legacyScope(row.id, row.account_id));
                }
                for (const row of db.prepare('SELECT comment_id,account_id FROM community_likes').all() as {
                    comment_id: string;
                    account_id: string;
                }[])
                    this.consume(`like:${row.comment_id}:${row.account_id}`);
                // Favorites existing before upgrade start at the currently published version.
                db.exec(`INSERT OR IGNORE INTO favorite_seen SELECT f.owner,'record',f.record_id,COALESCE(d.published_version,0) FROM record_favorites f JOIN record_drafts d ON d.id=f.record_id;
     INSERT OR IGNORE INTO favorite_seen SELECT f.owner,'share',f.id,COALESCE(d.published_version,0) FROM shared_record_favorites f JOIN record_drafts d ON d.id=f.record_id;`);
                db.prepare('INSERT INTO notification_config VALUES (?,?)').run('source-migration', '1');
            }
            this.moderation();
            this.cleanup();
        }).immediate();
    }
    private consume(key: string) { return this.db.prepare('INSERT OR IGNORE INTO notification_events VALUES (?)').run(key).changes > 0; }
    private ensure(id: string) { this.db.prepare('INSERT OR IGNORE INTO notification_settings(account_id) VALUES (?)').run(id); }
    private sequence(id: string) {
        this.ensure(id);
        this.db.prepare('UPDATE notification_settings SET sequence=sequence+1 WHERE account_id=?').run(id);
        return (this.db.prepare('SELECT sequence FROM notification_settings WHERE account_id=?').get(id) as {
            sequence: number;
        }).sequence;
    }
    private settings(id: string): NotificationSettings {
        this.ensure(id);
        const r = this.db.prepare('SELECT * FROM notification_settings WHERE account_id=?').get(id) as {
            revision: number;
            updates: number;
            replies: number;
            likes: number;
        };
        return { revision: r.revision, updates: !!r.updates, replies: !!r.replies, likes: !!r.likes };
    }
    private active(id: string) { return !!this.db.prepare("SELECT 1 FROM accounts WHERE id=? AND status='active'").get(id); }
    private insert(id: string, kind: NotificationItem['kind'], target: NotificationTarget | null, body: string | null, extra: {
        id?: string;
        at?: number;
        favoriteKind?: 'record' | 'share';
        favoriteId?: string;
        group?: string;
    } = {}) {
        const at = extra.at ?? this.now();
        this.db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(extra.id ?? randomUUID(), id, kind, body, at, at, 1, this.sequence(id), null, target ? JSON.stringify(target.scope) : null, target?.focusCommentId ?? null, extra.favoriteKind ?? null, extra.favoriteId ?? null, extra.group ?? null);
    }
    cleanup() { const cutoff = this.now() - ttl; const removed = this.db.prepare('DELETE FROM notifications WHERE created_at<=?').run(cutoff).changes; this.db.prepare('DELETE FROM community_notices WHERE at<=?').run(cutoff); return removed; }
    private legacyScope(commentId: string, accountId: string): CommunityScope | null {
        for (const row of this.db.prepare("SELECT payload FROM community_requests WHERE account_id=? AND kind='comment' AND target=?").all(accountId, commentId) as {
            payload: string;
        }[]) {
            try {
                const c = JSON.parse(row.payload);
                if (c.parentId === undefined || typeof c.text !== 'string')
                    continue;
                const p = communityScopeSchema.safeParse(c.scope);
                if (p.success)
                    return p.data;
            }
            catch { /* No guessed bearer fallback. */ }
        }
        // Legacy participants may retain their own participant scope, never another author's share.
        const row = this.db.prepare('SELECT d.id FROM record_drafts d JOIN community_comments c ON c.room_id=d.room_id WHERE c.id=? AND d.published_version IS NOT NULL AND d.deleted=0 ORDER BY d.id LIMIT 1').get(commentId) as {
            id: string;
        } | undefined;
        if (row) {
            const scope = { kind: 'record' as const, id: row.id };
            try {
                this.validate('account:' + accountId, scope);
                return scope;
            }
            catch { }
        }
        return null;
    }
    private saveCommentSource(commentId: string, accountId: string, scope: CommunityScope | null) { this.db.prepare('INSERT OR IGNORE INTO notification_comment_sources VALUES (?,?,?)').run(commentId, accountId, scope ? JSON.stringify(scope) : null); }
    comment(commentId: string, accountId: string, scope: CommunityScope) {
        this.cleanup();
        this.saveCommentSource(commentId, accountId, scope);
        if (!this.consume('comment:' + commentId))
            return;
        const row = this.db.prepare('SELECT parent_id FROM community_comments WHERE id=?').get(commentId) as {
            parent_id: string | null;
        };
        if (!row.parent_id)
            return;
        const parent = this.db.prepare('SELECT account_id,scope FROM notification_comment_sources WHERE comment_id=?').get(row.parent_id) as {
            account_id: string;
            scope: string | null;
        } | undefined;
        if (parent && parent.account_id !== accountId && this.active(parent.account_id) && this.settings(parent.account_id).replies)
            this.insert(parent.account_id, 'reply', parent.scope ? { scope: JSON.parse(parent.scope), focusCommentId: commentId } : null, null);
    }
    like(commentId: string, actorId: string) {
        this.cleanup();
        if (!this.consume(`like:${commentId}:${actorId}`))
            return;
        const source = this.db.prepare('SELECT account_id,scope FROM notification_comment_sources WHERE comment_id=?').get(commentId) as {
            account_id: string;
            scope: string | null;
        } | undefined;
        if (!source || source.account_id === actorId || !this.active(source.account_id) || !this.settings(source.account_id).likes)
            return;
        const existing = this.db.prepare("SELECT id FROM notifications WHERE account_id=? AND kind='like' AND group_id=?").get(source.account_id, commentId) as {
            id: string;
        } | undefined;
        if (existing)
            this.db.prepare('UPDATE notifications SET count=count+1,updated_at=?,revision=?,read_at=NULL WHERE id=?').run(this.now(), this.sequence(source.account_id), existing.id);
        else
            this.insert(source.account_id, 'like', source.scope ? { scope: JSON.parse(source.scope), focusCommentId: commentId } : null, null, { group: commentId });
    }
    publication(recordId: string, version: number) {
        this.cleanup();
        if (!this.consume(`publication:${recordId}:${version}`))
            return;
        const draft = this.db.prepare('SELECT owner FROM record_drafts WHERE id=?').get(recordId) as {
            owner: string;
        };
        const candidates = [...(this.db.prepare("SELECT owner,'record' kind,record_id id FROM record_favorites WHERE record_id=?").all(recordId) as {
                owner: string;
                kind: 'record';
                id: string;
            }[]), ...(this.db.prepare("SELECT owner,'share' kind,id FROM shared_record_favorites WHERE record_id=?").all(recordId) as {
                owner: string;
                kind: 'share';
                id: string;
            }[])];
        const sent = new Set<string>();
        for (const f of candidates) {
            if (!f.owner.startsWith('account:') || f.owner === draft.owner || sent.has(f.owner))
                continue;
            const accountId = f.owner.slice(8);
            if (!this.active(accountId) || !this.settings(accountId).updates)
                continue;
            const scope: CommunityScope = f.kind === 'record' ? { kind: 'record', id: f.id } : { kind: 'shared-favorite', id: f.id };
            try {
                this.validate(f.owner, scope);
            }
            catch {
                continue;
            }
            this.insert(accountId, 'record-update', { scope }, null, { favoriteKind: f.kind, favoriteId: f.id });
            sent.add(f.owner);
        }
    }
    moderation() {
        this.cleanup();
        for (const row of this.db.prepare('SELECT * FROM community_notices').all() as LegacyNotice[]) {
            if (!this.consume('moderation:' + row.id) || row.at <= this.now() - ttl)
                continue;
            const label: Record<string, string> = { delete: '评论已删除', warn: '社区警告', mute: '禁止评论', unmute: '解除禁评' };
            const status = row.action === 'mute' ? (row.until === null ? '；永久禁评' : `；至 ${new Date(row.until).toISOString()}`) : '';
            this.insert(row.account_id, 'moderation', null, `${label[row.action] ?? '社区管理'}：${row.reason}${status}`, { id: row.id, at: row.at });
        }
    }
    account(id: string, body: string) { this.cleanup(); this.insert(id, 'account', null, body); }
    private available(owner: string, row: NoticeRow) {
        if (row.kind === 'account' || row.kind === 'moderation')
            return true;
        if (!row.scope)
            return false;
        if (row.favorite_kind) {
            const exists = row.favorite_kind === 'record' ? this.db.prepare('SELECT 1 FROM record_favorites WHERE owner=? AND record_id=?').get(owner, row.favorite_id) : this.db.prepare('SELECT 1 FROM shared_record_favorites WHERE owner=? AND id=?').get(owner, row.favorite_id);
            if (!exists)
                return false;
        }
        try {
            this.validate(owner, JSON.parse(row.scope));
            return true;
        }
        catch (error) {
            if (error instanceof LobbyError)
                return false;
            throw error;
        }
    }
    private title(kind: NotificationItem['kind']) { return { 'record-update': '收藏的复盘有更新', reply: '收到新的回复', like: '评论收到新的点赞', account: '账号消息', moderation: '社区管理消息' }[kind]; }
    private project(owner: string, r: NoticeRow): NotificationItem { return { id: r.id, kind: r.kind, title: this.title(r.kind), body: r.body, createdAt: r.created_at, updatedAt: r.updated_at, count: r.count, revision: r.revision, readAt: r.read_at, available: this.available(owner, r) }; }
    private encode(data: unknown) { const b = Buffer.from(JSON.stringify(data)).toString('base64url'); return b + '.' + createHmac('sha256', this.key).update(b).digest('hex'); }
    private decode(cursor: string, accountId: string): {
        at: number;
        id: string;
    } {
        try {
            const [b, s, ...rest] = cursor.split('.');
            if (rest.length || !b || !s || !/^[a-f0-9]{64}$/.test(s) || !timingSafeEqual(Buffer.from(s, 'hex'), createHmac('sha256', this.key).update(b).digest()))
                throw 0;
            const d = JSON.parse(Buffer.from(b, 'base64url').toString());
            if (d.accountId !== accountId || !Number.isSafeInteger(d.at) || typeof d.id !== 'string')
                throw 0;
            return d;
        }
        catch {
            throw new LobbyError('INVALID_INPUT');
        }
    }
    list(token: string, input: unknown = {}): NotificationPage {
        const account = this.auth.requireAccount(token), q = parse(notificationListSchema, input);
        this.cleanup();
        const settings = this.settings(account.id), c = q.cursor ? this.decode(q.cursor, account.id) : null, limit = q.limit ?? 20;
        const rows = this.db.prepare(`SELECT * FROM notifications WHERE account_id=? ${c ? 'AND (updated_at<? OR (updated_at=? AND id<?))' : ''} ORDER BY updated_at DESC,id DESC LIMIT ?`).all(account.id, ...(c ? [c.at, c.at, c.id] : []), limit + 1) as NoticeRow[], last = rows[limit - 1];
        return { accountId: account.id, items: rows.slice(0, limit).map(r => this.project('account:' + account.id, r)), nextCursor: rows.length > limit && last ? this.encode({ accountId: account.id, at: last.updated_at, id: last.id }) : null, unreadCount: (this.db.prepare('SELECT count(*) n FROM notifications WHERE account_id=? AND read_at IS NULL').get(account.id) as {
                n: number;
            }).n, watermark: (this.db.prepare('SELECT sequence FROM notification_settings WHERE account_id=?').get(account.id) as {
                sequence: number;
            }).sequence, settings };
    }
    private receipt<T>(accountId: string, requestId: string, payload: unknown, run: () => T): T {
        const body = JSON.stringify(payload), old = this.db.prepare('SELECT payload,result FROM notification_receipts WHERE account_id=? AND request_id=?').get(accountId, requestId) as {
            payload: string;
            result: string;
        } | undefined;
        if (old) {
            if (old.payload !== body)
                throw new LobbyError('INVALID_INPUT');
            return JSON.parse(old.result) as T;
        }
        const result = run();
        this.db.prepare('INSERT INTO notification_receipts VALUES (?,?,?,?)').run(accountId, requestId, body, JSON.stringify(result));
        return result;
    }
    setSettings(token: string, input: unknown) {
        const c = parse(notificationSettingsSchema, input);
        return this.db.transaction(() => {
            const account = this.auth.requireAccount(token);
            if (c.expectedAccountId !== undefined && c.expectedAccountId !== account.id)
                throw new LobbyError('UNAUTHORIZED', 401);
            this.cleanup();
            return this.receipt(account.id, c.requestId, { kind: 'settings', ...c }, () => {
                const settings = this.settings(account.id);
                if (settings.revision !== c.revision)
                    throw new LobbyError('STALE_NOTIFICATION', 409);
                this.db.prepare('UPDATE notification_settings SET revision=revision+1,updates=?,replies=?,likes=? WHERE account_id=?').run(+c.updates, +c.replies, +c.likes, account.id);
                return { settings: this.settings(account.id) };
            });
        }).immediate();
    }
    command(token: string, input: unknown) {
        const c = parse(notificationCommandSchema, input);
        return this.db.transaction(() => {
            const account = this.auth.requireAccount(token);
            if (c.expectedAccountId !== undefined && c.expectedAccountId !== account.id)
                throw new LobbyError('UNAUTHORIZED', 401);
            this.cleanup();
            return this.receipt(account.id, c.requestId, { kind: 'command', ...c }, () => {
                if (c.action === 'read' || c.action === 'delete') {
                    const row = this.db.prepare('SELECT * FROM notifications WHERE account_id=? AND id=?').get(account.id, c.id) as NoticeRow | undefined;
                    if (!row)
                        throw new LobbyError('NOT_FOUND', 404);
                    if (row.revision !== c.version)
                        throw new LobbyError('STALE_NOTIFICATION', 409);
                    if (c.action === 'read')
                        this.db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=?').run(this.now(), row.id);
                    else
                        this.remove([row.id]);
                }
                else if (c.action === 'read-all')
                    this.db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE account_id=? AND revision<=?').run(this.now(), account.id, c.through);
                else {
                    const ids = this.db.prepare('SELECT id FROM notifications WHERE account_id=? AND revision<=?').all(account.id, c.through) as {
                        id: string;
                    }[];
                    this.remove(ids.map(r => r.id));
                }
                return { applied: true as const };
            });
        }).immediate();
    }
    private remove(ids: string[]) {
        for (const id of ids) {
            this.db.prepare('DELETE FROM notifications WHERE id=?').run(id);
            this.db.prepare('DELETE FROM community_notices WHERE id=?').run(id);
        }
    }
    open(token: string, id: string): NotificationTarget {
        const account = this.auth.requireAccount(token);
        this.cleanup();
        const row = this.db.prepare('SELECT * FROM notifications WHERE account_id=? AND id=?').get(account.id, id) as NoticeRow | undefined;
        if (!row)
            throw new LobbyError('NOT_FOUND', 404);
        if (!row.scope || !this.available('account:' + account.id, row))
            throw new LobbyError('NOTIFICATION_UNAVAILABLE', 404);
        return { scope: JSON.parse(row.scope), ...(row.focus_id ? { focusCommentId: row.focus_id } : {}) };
    }
    seen(owner: string, kind: 'record' | 'share', id: string, version: number) { this.db.prepare('INSERT INTO favorite_seen VALUES (?,?,?,?) ON CONFLICT(owner,kind,target_id) DO UPDATE SET version=MAX(version,excluded.version)').run(owner, kind, id, version); }
    forgetSeen(owner: string, kind: 'record' | 'share', id: string) { this.db.prepare('DELETE FROM favorite_seen WHERE owner=? AND kind=? AND target_id=?').run(owner, kind, id); }
    hasUpdate(owner: string, kind: 'record' | 'share', id: string, version: number) {
        const r = this.db.prepare('SELECT version FROM favorite_seen WHERE owner=? AND kind=? AND target_id=?').get(owner, kind, id) as {
            version: number;
        } | undefined;
        return r !== undefined && version > r.version;
    }
}
