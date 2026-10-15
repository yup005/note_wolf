import type Database from 'better-sqlite3';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { ZodType } from 'zod';
import { LobbyError } from '../contracts/index.js';
import type { AuthStore } from './auth.js';
import { communityFocusSchema, communityReadSchema, communityCommentSchema, communityLikeSchema, communityGameLikeSchema, communityReportSchema, communityModerationSchema, communityListSchema, communityReportsQuerySchema, type CommunityScope, type CommunityComment, type CommunityViewer, type CommunityRestriction, type CommunityNotice, type CommunityPage, type CommunityReport, type CommunityAudit } from '../contracts/community.js';
interface CommentRow {
    id: string;
    room_id: string;
    account_id: string;
    parent_id: string | null;
    root_id: string;
    body: string;
    created_at: number;
    deleted: number;
    version: number;
}
interface RestrictionRow {
    version: number;
    until: number | null;
    reason: string;
}
interface ReportRow {
    id: string;
    comment_id: string;
    reporter_id: string;
    reason: string;
    at: number;
    status: 'open' | 'reviewed';
    version: number;
}
const parse = <T>(schema: ZodType<T>, input: unknown): T => {
    const p = schema.safeParse(input);
    if (!p.success)
        throw new LobbyError('INVALID_INPUT');
    return p.data;
};
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
export class CommunityStore {
    private cursorKey: Buffer;
    constructor(private db: Database.Database, private auth: AuthStore, private now: () => number, private resolve: (token: string | undefined, scope: CommunityScope) => string, private events: {comment?:(id:string,accountId:string,scope:CommunityScope)=>void;like?:(id:string,actorId:string)=>void;moderation?:()=>void}={}) {
        db.exec(`CREATE TABLE IF NOT EXISTS community_comments(id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES record_rooms(room_id),account_id TEXT NOT NULL REFERENCES accounts(id),parent_id TEXT REFERENCES community_comments(id),root_id TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1);
   CREATE INDEX IF NOT EXISTS community_comment_tree ON community_comments(room_id,parent_id,created_at,id);
   CREATE TABLE IF NOT EXISTS community_likes(comment_id TEXT NOT NULL REFERENCES community_comments(id),account_id TEXT NOT NULL REFERENCES accounts(id),PRIMARY KEY(comment_id,account_id));
   CREATE TABLE IF NOT EXISTS community_game_likes(room_id TEXT NOT NULL REFERENCES record_rooms(room_id),account_id TEXT NOT NULL REFERENCES accounts(id),day TEXT NOT NULL,PRIMARY KEY(room_id,account_id,day));
   CREATE TABLE IF NOT EXISTS community_reports(id TEXT PRIMARY KEY,comment_id TEXT NOT NULL REFERENCES community_comments(id),reporter_id TEXT NOT NULL REFERENCES accounts(id),reason TEXT NOT NULL,at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'open',version INTEGER NOT NULL DEFAULT 1,UNIQUE(comment_id,reporter_id));
   CREATE TABLE IF NOT EXISTS community_restrictions(account_id TEXT PRIMARY KEY REFERENCES accounts(id),version INTEGER NOT NULL,until INTEGER,reason TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS community_audit(id TEXT PRIMARY KEY,at INTEGER NOT NULL,operator_id TEXT NOT NULL REFERENCES accounts(id),action TEXT NOT NULL,reason TEXT NOT NULL,comment_id TEXT REFERENCES community_comments(id),account_id TEXT REFERENCES accounts(id),request_id TEXT NOT NULL,state_version INTEGER NOT NULL,target_version INTEGER);
   CREATE TABLE IF NOT EXISTS community_notices(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),at INTEGER NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,until INTEGER);
   CREATE TABLE IF NOT EXISTS community_requests(account_id TEXT NOT NULL REFERENCES accounts(id),request_id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,target TEXT,PRIMARY KEY(account_id,request_id));
   CREATE TABLE IF NOT EXISTS community_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
        if (!(db.prepare('PRAGMA table_info(community_audit)').all() as {name:string}[]).some(column=>column.name==='target_version'))db.exec('ALTER TABLE community_audit ADD COLUMN target_version INTEGER');
        db.prepare('INSERT OR IGNORE INTO community_settings VALUES (?,?)').run('cursor-key', randomBytes(32).toString('hex'));
        this.cursorKey = Buffer.from((db.prepare('SELECT value FROM community_settings WHERE key=?').get('cursor-key') as {
            value: string;
        }).value, 'hex');
    }
    private day() {
        return dayFormatter.format(this.now());
    }
    private restriction(id: string): CommunityRestriction | null {
        return this.db.prepare('SELECT version,until,reason FROM community_restrictions WHERE account_id=?').get(id) as RestrictionRow | undefined ?? null;
    }
    viewer(token: string | undefined): CommunityViewer {
        const a = token ? this.auth.account(token) : null;
        const r = a ? this.restriction(a.id) : null, active = r && (r.until === null || r.until > this.now()) ? r : null;
        return { account: a ? { id: a.id, nickname: a.nickname } : null, canInteract: !!a && !active, restriction: active };
    }
    private actor(token: string, mute = false) {
        const a = this.auth.requireAccount(token);
        if (mute && !this.viewer(token).canInteract)
            throw new LobbyError('COMMENT_MUTED', 403);
        return a;
    }
    private comment(id: string, room?: string, live = false) {
        const row = this.db.prepare('SELECT * FROM community_comments WHERE id=?').get(id) as CommentRow | undefined;
        if (!row || room !== undefined && row.room_id !== room)
            throw new LobbyError('NOT_FOUND', 404);
        if (live && row.deleted)
            throw new LobbyError('COMMENT_DELETED', 409);
        return row;
    }
    private count(sql: string, ...values: (string | null)[]) {
        return (this.db.prepare(sql).get(...values) as {
            n: number;
        }).n;
    }
    private project(row: CommentRow, accountId: string | null): CommunityComment {
        const a = this.db.prepare('SELECT nickname FROM accounts WHERE id=?').get(row.account_id) as {
            nickname: string;
            };
        return {
            id: row.id, parentId: row.parent_id, rootId: row.root_id, author: a.nickname, avatarUrl: null, body: row.deleted ? null : row.body, createdAt: row.created_at, deleted: !!row.deleted, version: row.version, likes: this.count('SELECT count(*) n FROM community_likes WHERE comment_id=?', row.id), liked: !!accountId && !!this.db.prepare('SELECT 1 FROM community_likes WHERE comment_id=? AND account_id=?').get(row.id, accountId), reported: !!accountId && !!this.db.prepare('SELECT 1 FROM community_reports WHERE comment_id=? AND reporter_id=?').get(row.id, accountId), childCount: this.count('SELECT count(*) n FROM community_comments WHERE parent_id=?', row.id)
        };
    }
    private encode(data: unknown) {
        const body = Buffer.from(JSON.stringify(data)).toString('base64url');
        return body + '.' + createHmac('sha256', this.cursorKey).update(body).digest('hex');
    }
    private decode(value: string, bind: string): {
        at: number;
        id: string;
        heat: number;
    } {
        try {
            const [body, sig, ...tail] = value.split('.'), expected = createHmac('sha256', this.cursorKey).update(body!).digest();
            if (tail.length || !sig || !/^[a-f0-9]{64}$/.test(sig) || !timingSafeEqual(Buffer.from(sig, 'hex'), expected))
                throw 0;
            const o = JSON.parse(Buffer.from(body!, 'base64url').toString());
            if (o.bind !== bind || typeof o.id !== 'string' || !Number.isSafeInteger(o.at) || !Number.isSafeInteger(o.heat))
                throw 0;
            return o;
        }
        catch {
            throw new LobbyError('INVALID_INPUT');
        }
    }
    read(token: string | undefined, input: unknown): CommunityPage {
        const c = parse(communityReadSchema, input), room = this.resolve(token, c.scope), viewer = this.viewer(token);
        if (c.parentId)
            this.comment(c.parentId, room);
        const sort = c.parentId ? 'oldest' : c.sort, bind = JSON.stringify([room, c.parentId, c.sort]), cursor = c.cursor ? this.decode(c.cursor, bind) : null;
        const dir = sort === 'oldest' ? 'ASC' : 'DESC', op = sort === 'oldest' ? '>' : '<';
        const heat = `(SELECT count(*) FROM community_likes l JOIN community_comments t ON t.id=l.comment_id WHERE t.root_id=c.id AND t.deleted=0)`;
        let condition = '', args: (string | number | null)[] = [room, c.parentId];
        if (cursor) {
            condition = sort === 'hot' ? `AND (${heat}<? OR (${heat}=? AND (c.created_at<? OR (c.created_at=? AND c.id<?))))` : `AND (c.created_at${op}? OR (c.created_at=? AND c.id${op}?))`;
            args.push(...(sort === 'hot' ? [cursor.heat, cursor.heat, cursor.at, cursor.at, cursor.id] : [cursor.at, cursor.at, cursor.id]));
        }
        args.push(c.limit + 1);
        const rows = this.db.prepare(`SELECT c.*,${heat} heat FROM community_comments c WHERE c.room_id=? AND c.parent_id IS ? ${condition} ORDER BY ${sort === 'hot' ? 'heat DESC,' : ''}c.created_at ${dir},c.id ${dir} LIMIT ?`).all(...args) as (CommentRow & {
            heat: number;
        })[];
        const more = rows.length > c.limit, items = rows.slice(0, c.limit), last = items.at(-1);
        return { items: items.map(r => this.project(r, viewer.account?.id ?? null)), nextCursor: more && last ? this.encode({ bind, at: last.created_at, id: last.id, heat: last.heat }) : null, gameLikes: this.count('SELECT count(*) n FROM community_game_likes WHERE room_id=?', room), gameLikedToday: !!viewer.account && !!this.db.prepare('SELECT 1 FROM community_game_likes WHERE room_id=? AND account_id=? AND day=?').get(room, viewer.account.id, this.day()), viewer };
    }
    focus(token:string|undefined,input:unknown) {
        const c=parse(communityFocusSchema,input),room=this.resolve(token,c.scope),viewer=this.viewer(token),comment=this.comment(c.commentId,room);
        return {comment:this.project(comment,viewer.account?.id??null),parent:comment.parent_id?this.project(this.comment(comment.parent_id,room),viewer.account?.id??null):null};
    }
    private request(account: string, id: string, kind: string, payload: unknown) {
        const row = this.db.prepare('SELECT kind,payload,target FROM community_requests WHERE account_id=? AND request_id=?').get(account, id) as {
            kind: string;
            payload: string;
            target: string | null;
        } | undefined;
        if (row && (row.kind !== kind || row.payload !== JSON.stringify(payload)))
            throw new LobbyError('COMMUNITY_REQUEST_CONFLICT', 409);
        return row;
    }
    private remember(account: string, id: string, kind: string, payload: unknown, target: string | null) {
        this.db.prepare('INSERT INTO community_requests VALUES (?,?,?,?,?)').run(account, id, kind, JSON.stringify(payload), target);
    }
    post(token: string, input: unknown) {
        const c = parse(communityCommentSchema, input);
        return this.db.transaction(() => {
            const a = this.actor(token, true), room = this.resolve(token, c.scope), previous = this.request(a.id, c.requestId, 'comment', c);
            if (previous)
                return { comment: this.project(this.comment(previous.target!, room), a.id) };
            const parent = c.parentId ? this.comment(c.parentId, room, true) : null, id = randomUUID();
            this.db.prepare('INSERT INTO community_comments(id,room_id,account_id,parent_id,root_id,body,created_at) VALUES (?,?,?,?,?,?,?)').run(id, room, a.id, c.parentId, parent?.root_id ?? id, c.text, this.now());
            this.events.comment?.(id,a.id,c.scope);
            this.remember(a.id, c.requestId, 'comment', c, id);
            return { comment: this.project(this.comment(id), a.id) };
        }).immediate();
    }
    like(token: string, input: unknown) {
        const c = parse(communityLikeSchema, input);
        return this.db.transaction(() => {
            const a = this.actor(token, true), room = this.resolve(token, c.scope);
            this.comment(c.commentId, room, true);
            const previous = this.request(a.id, c.requestId, 'like', c);
            const inserted=this.db.prepare('INSERT OR IGNORE INTO community_likes VALUES (?,?)').run(c.commentId, a.id);
            if(inserted.changes)this.events.like?.(c.commentId,a.id);
            if (!previous)
                this.remember(a.id, c.requestId, 'like', c, c.commentId);
            return { liked: true as const, count: this.count('SELECT count(*) n FROM community_likes WHERE comment_id=?', c.commentId) };
        }).immediate();
    }
    gameLike(token: string, input: unknown) {
        const c = parse(communityGameLikeSchema, input);
        return this.db.transaction(() => {
            const a = this.actor(token), room = this.resolve(token, c.scope), previous = this.request(a.id, c.requestId, 'game-like', c);
            if (!previous) {
                this.db.prepare('INSERT OR IGNORE INTO community_game_likes VALUES (?,?,?)').run(room, a.id, this.day());
                this.remember(a.id, c.requestId, 'game-like', c, room);
            }
            return { liked: true as const, count: this.count('SELECT count(*) n FROM community_game_likes WHERE room_id=?', room) };
        }).immediate();
    }
    report(token: string, input: unknown) {
        const c = parse(communityReportSchema, input);
        return this.db.transaction(() => {
            const a = this.actor(token), room = this.resolve(token, c.scope);
            this.comment(c.commentId, room, true);
            const previous = this.request(a.id, c.requestId, 'report', c);
            this.db.prepare('INSERT OR IGNORE INTO community_reports(id,comment_id,reporter_id,reason,at) VALUES (?,?,?,?,?)').run(randomUUID(), c.commentId, a.id, c.reason, this.now());
            if (!previous)
                this.remember(a.id, c.requestId, 'report', c, c.commentId);
            return { reported: true as const };
        }).immediate();
    }
    private notices(id: string): CommunityNotice[] {
        return this.db.prepare('SELECT id,at,action,reason,until FROM community_notices WHERE account_id=? AND at>? ORDER BY at DESC,id DESC').all(id, this.now() - 30 * 86400000) as CommunityNotice[];
    }
    me(token: string) {
        const a = this.actor(token);
        return { viewer: this.viewer(token), notices: this.notices(a.id) };
    }
    user(token: string, id: string) {
        this.auth.requireAdmin(token);
        if (!this.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(id))
            throw new LobbyError('NOT_FOUND', 404);
        return { restriction: this.restriction(id), notices: this.auth.requireAccount(token).id===id?this.notices(id):[] };
    }
    reports(token: string, input: unknown) {
        this.auth.requireAdmin(token);
        const c = parse(communityReportsQuerySchema, input), bind = 'reports:' + c.status, cur = c.cursor ? this.decode(c.cursor, bind) : null, args: (string | number)[] = [];
        let where = c.status === 'all' ? '1=1' : 'status=?';
        if (c.status !== 'all')
            args.push(c.status);
        if (cur) {
            where += ' AND (at<? OR (at=? AND id<?))';
            args.push(cur.at, cur.at, cur.id);
        }
        const limit = c.limit ?? 20;
        args.push(limit + 1);
        const rows = this.db.prepare(`SELECT * FROM community_reports WHERE ${where} ORDER BY at DESC,id DESC LIMIT ?`).all(...args) as ReportRow[];
        const items = rows.slice(0, limit).map(r => {
            const comment = this.comment(r.comment_id), account = this.db.prepare('SELECT nickname FROM accounts WHERE id=?').get(comment.account_id) as {
                nickname: string;
            }, reporter = this.db.prepare('SELECT nickname FROM accounts WHERE id=?').get(r.reporter_id) as {
                nickname: string;
            }, room = this.db.prepare('SELECT code FROM record_rooms WHERE room_id=?').get(comment.room_id) as {
                code: string;
            };
            return {
                id: r.id, version: r.version, status: r.status, reason: r.reason, at: r.at, reporter: reporter.nickname, comment: {
                    id: comment.id, version: comment.version, body: comment.body, deleted: !!comment.deleted, author: account.nickname, accountId: comment.account_id, roomCode: room.code
                }, restriction: this.restriction(comment.account_id)
            } satisfies CommunityReport;
        });
        const last = rows[limit - 1];
        return { items, nextCursor: rows.length > limit && last ? this.encode({ bind, at: last.at, id: last.id, heat: 0 }) : null };
    }
    audit(token: string, input: unknown) {
        this.auth.requireAdmin(token);
        const c = parse(communityListSchema, input), bind = 'audit', cur = c.cursor ? this.decode(c.cursor, bind) : null, args: (string | number)[] = cur ? [cur.at, cur.at, cur.id] : [];
        const limit = c.limit ?? 20;
        args.push(limit + 1);
        const rows = this.db.prepare(`SELECT u.*,a.nickname operator FROM community_audit u JOIN accounts a ON a.id=u.operator_id ${cur ? 'WHERE (u.at<? OR (u.at=? AND u.id<?))' : ''} ORDER BY u.at DESC,u.id DESC LIMIT ?`).all(...args) as {
            id: string;
            at: number;
            operator: string;
            action: string;
            reason: string;
            comment_id: string | null;
            account_id: string | null;
        }[];
        const items = rows.slice(0, limit).map(r => ({
            id: r.id, at: r.at, operator: r.operator, action: r.action, reason: r.reason, commentId: r.comment_id, accountId: r.account_id
        } satisfies CommunityAudit)), last = rows[limit - 1];
        return { items, nextCursor: rows.length > limit && last ? this.encode({ bind, at: last.at, id: last.id, heat: 0 }) : null };
    }
    moderate(token: string, input: unknown) {
        const c = parse(communityModerationSchema, input);
        return this.db.transaction(() => {
            this.auth.requireAdmin(token);
            const operator = this.actor(token);
            if (this.request(operator.id, c.requestId, 'moderation', c))
                return { applied: true as const };
            const report = c.reportId ? this.db.prepare('SELECT * FROM community_reports WHERE id=?').get(c.reportId) as ReportRow | undefined : undefined;
            if (c.reportId && !report)
                throw new LobbyError('NOT_FOUND', 404);
            const comment = report ? this.comment(report.comment_id) : c.commentId ? this.comment(c.commentId) : null, accountId = comment?.account_id ?? c.accountId ?? null;
            if (accountId && !this.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(accountId))
                throw new LobbyError('NOT_FOUND', 404);
            const restriction = accountId ? this.restriction(accountId) : null, version = report?.version ?? (c.action === 'delete' ? comment?.version : restriction?.version ?? 0);
            const targetVersion = c.action === 'delete' ? comment?.version : restriction?.version ?? 0;
            if (version !== c.version || report && c.action !== 'dismiss' && targetVersion !== c.targetVersion)
                throw new LobbyError('STALE_COMMUNITY', 409);
            if (c.action === 'mute' && c.until !== null && c.until! <= this.now())
                throw new LobbyError('INVALID_INPUT');
            if (c.action === 'delete') {
                if (!comment)
                    throw new LobbyError('INVALID_INPUT');
                if (comment.deleted)
                    throw new LobbyError('COMMENT_DELETED', 409);
                this.db.prepare('UPDATE community_comments SET deleted=1,version=version+1 WHERE id=?').run(comment.id);
            }
            if (['warn', 'mute', 'unmute'].includes(c.action)) {
                if (!accountId)
                    throw new LobbyError('INVALID_INPUT');
                const until = c.action === 'mute' ? c.until! : c.action === 'unmute' ? 0 : restriction ? restriction.until : 0;
                const restrictionReason = c.action === 'warn' && restriction ? restriction.reason : c.reason;
                this.db.prepare('INSERT INTO community_restrictions VALUES (?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET version=excluded.version,until=excluded.until,reason=excluded.reason').run(accountId, (restriction?.version ?? 0) + 1, until, restrictionReason);
            }
            if (report)
                this.db.prepare("UPDATE community_reports SET status='reviewed',version=version+1 WHERE id=?").run(report.id);
            const at = this.now();
            this.db.prepare('INSERT INTO community_audit VALUES (?,?,?,?,?,?,?,?,?,?)').run(randomUUID(), at, operator.id, c.action, c.reason, comment?.id ?? null, accountId, c.requestId, c.version, c.action==='dismiss'?null:targetVersion);
            if (c.action !== 'dismiss' && accountId)
                this.db.prepare('INSERT INTO community_notices VALUES (?,?,?,?,?,?)').run(randomUUID(), accountId, at, c.action, c.reason, c.action === 'mute' ? c.until! : null);
            this.events.moderation?.();
            this.remember(operator.id, c.requestId, 'moderation', c, null);
            return { applied: true as const };
        }).immediate();
    }
}
