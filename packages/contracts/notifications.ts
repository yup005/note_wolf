import { z } from 'zod';
import type { CommunityScope } from './community.js';
export interface NotificationSettings {
    revision: number;
    updates: boolean;
    replies: boolean;
    likes: boolean;
}
export interface NotificationItem {
    id: string;
    kind: 'record-update' | 'reply' | 'like' | 'account' | 'moderation';
    title: string;
    body: string | null;
    createdAt: number;
    updatedAt: number;
    count: number;
    revision: number;
    readAt: number | null;
    available: boolean;
}
export interface NotificationPage {
    accountId: string;
    items: NotificationItem[];
    nextCursor: string | null;
    unreadCount: number;
    watermark: number;
    settings: NotificationSettings;
}
export interface NotificationTarget {
    scope: CommunityScope;
    focusCommentId?: string;
}
const uint = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), id = z.string().uuid();
export const notificationListSchema = z.object({ cursor: z.string().max(2048).optional(), limit: z.string().regex(/^(?:[1-9]|[1-4][0-9]|50)$/).transform(Number).optional() }).strict();
export const notificationSettingsSchema = z.object({ requestId: id, expectedAccountId: id.optional(), revision: uint, updates: z.boolean(), replies: z.boolean(), likes: z.boolean() }).strict();
export const notificationCommandSchema = z.object({ requestId: id, expectedAccountId: id.optional(), action: z.enum(['read', 'delete', 'read-all', 'clear']), id: id.optional(), version: uint.refine(v => v > 0).optional(), through: uint.optional() }).strict().superRefine((c, ctx) => {
    const single = c.action === 'read' || c.action === 'delete';
    if (single ? !c.id || c.version === undefined || c.through !== undefined : c.through === undefined || c.id !== undefined || c.version !== undefined)
        ctx.addIssue({ code: 'custom', message: 'Invalid notification command' });
});
export type NotificationQuery = z.infer<typeof notificationListSchema>;
export type NotificationSettingsCommand = z.infer<typeof notificationSettingsSchema>;
export type NotificationCommand = z.infer<typeof notificationCommandSchema>;
