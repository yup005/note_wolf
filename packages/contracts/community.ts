import { z } from 'zod';
const id = z.string().uuid();
const text = (max: number) => z.string().trim().refine(s => Array.from(s).length > 0 && Array.from(s).length <= max);
export const communityScopeSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('record'), id }).strict(), z.object({ kind: z.literal('share'), token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(), z.object({ kind: z.literal('shared-favorite'), id }).strict()]);
export type CommunityScope = z.infer<typeof communityScopeSchema>;
export const communityReadSchema = z.object({ scope: communityScopeSchema, sort: z.enum(['latest', 'hot', 'oldest']).default('latest'), parentId: id.nullable().default(null), cursor: z.string().max(2048).nullable().default(null), limit: z.number().int().min(1).max(50).default(20) }).strict();
export type CommunityRead = z.infer<typeof communityReadSchema>;
const base = { scope: communityScopeSchema, requestId: id };
export const communityCommentSchema = z.object({ ...base, parentId: id.nullable(), text: text(2000) }).strict();
export const communityLikeSchema = z.object({ ...base, commentId: id }).strict();
export const communityGameLikeSchema = z.object(base).strict();
export const communityReportSchema = z.object({ ...base, commentId: id, reason: text(500) }).strict();
export type CommunityCommentCommand = z.infer<typeof communityCommentSchema>;
export type CommunityLikeCommand = z.infer<typeof communityLikeSchema>;
export type CommunityGameLikeCommand = z.infer<typeof communityGameLikeSchema>;
export type CommunityReportCommand = z.infer<typeof communityReportSchema>;
export interface CommunityRestriction {
    version: number;
    until: number | null;
    reason: string;
}
export interface CommunityViewer {
    account: {
        id: string;
        nickname: string;
    } | null;
    canInteract: boolean;
    restriction: CommunityRestriction | null;
}
export interface CommunityComment {
    id: string;
    parentId: string | null;
    rootId: string;
    author: string;
    avatarUrl: string | null;
    body: string | null;
    createdAt: number;
    deleted: boolean;
    version: number;
    likes: number;
    liked: boolean;
    reported: boolean;
    childCount: number;
}
export interface CommunityPage {
    items: CommunityComment[];
    nextCursor: string | null;
    gameLikes: number;
    gameLikedToday: boolean;
    viewer: CommunityViewer;
}
export interface CommunityNotice {
    id: string;
    at: number;
    action: string;
    reason: string;
    until: number | null;
}
export interface CommunityMe {
    viewer: CommunityViewer;
    notices: CommunityNotice[];
}
export interface CommunityReport {
    id: string;
    version: number;
    status: 'open' | 'reviewed';
    reason: string;
    at: number;
    reporter: string;
    comment: {
        id: string;
        version: number;
        body: string;
        deleted: boolean;
        author: string;
        accountId: string;
        roomCode: string;
    };
    restriction: CommunityRestriction | null;
}
export interface CommunityAudit {
    id: string;
    at: number;
    operator: string;
    action: string;
    reason: string;
    commentId: string | null;
    accountId: string | null;
}
export const communityListSchema = z.object({ cursor: z.string().max(2048).optional(), limit: z.string().regex(/^(?:[1-9]|[1-4][0-9]|50)$/).transform(Number).optional() }).strict();
export const communityReportsQuerySchema = communityListSchema.extend({ status: z.enum(['open', 'reviewed', 'all']).default('open') }).strict();
export type CommunityListQuery = z.infer<typeof communityListSchema>;
export type CommunityReportsQuery = z.infer<typeof communityReportsQuerySchema>;
export const communityModerationSchema = z.object({
    requestId: id, confirmed: z.literal(true), version: z.number().int().min(0), action: z.enum(['dismiss', 'delete', 'warn', 'mute', 'unmute']), reason: text(500), reportId: id.optional(), targetVersion: z.number().int().min(0).optional(), commentId: id.optional(), accountId: id.optional(), until: z.number().int().nonnegative().nullable().optional()
}).strict().superRefine((c, ctx) => {
    const invalid = () => ctx.addIssue({ code: 'custom', message: 'Invalid moderation target' });
    if (c.reportId) {
        if (c.commentId || c.accountId || c.action !== 'dismiss' && c.targetVersion === undefined || c.action === 'dismiss' && c.targetVersion !== undefined)
            invalid();
    }
    else if (c.targetVersion !== undefined || c.action === 'dismiss' || c.action === 'delete' && !c.commentId || c.action !== 'delete' && !c.commentId && !c.accountId || c.commentId && c.accountId)
        invalid();
    if (c.action === 'mute' && c.until === undefined || c.action !== 'mute' && c.until !== undefined)
        invalid();
});
export type CommunityModerationCommand = z.infer<typeof communityModerationSchema>;

export const communityFocusSchema=z.object({scope:communityScopeSchema,commentId:z.string().uuid()}).strict();
export interface CommunityFocus {comment:CommunityComment;parent:CommunityComment|null}
