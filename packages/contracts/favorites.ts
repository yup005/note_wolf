import {z} from 'zod';
export const favoriteKindSchema=z.enum(['game','record']);
export type FavoriteKind=z.infer<typeof favoriteKindSchema>;
const timestamp=z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const favoriteQuerySchema=z.object({q:z.string().trim().max(100).optional(),board:z.string().max(100).optional(),author:z.string().max(100).optional(),from:timestamp.optional(),to:timestamp.optional(),sort:z.enum(['saved-desc','saved-asc']).default('saved-desc')}).strict().refine(q=>q.from===undefined||q.to===undefined||q.from<=q.to);
export type FavoriteQuery=z.infer<typeof favoriteQuerySchema>;
export const favoriteNameSchema=z.object({name:z.string().trim().max(80),revision:z.number().int().nonnegative()}).strict();
export type FavoriteName=z.infer<typeof favoriteNameSchema>;
export interface FavoriteBoard {id:string;name:string}
export interface FavoriteItem {kind:FavoriteKind;id:string;code:string;author:string;title:string;customName:string|null;nameRevision:number;savedAt:number;board:FavoriteBoard|null;available:boolean;detail:string}
export interface FavoriteLibrary {advanced:boolean;items:FavoriteItem[];boards:FavoriteBoard[];authors:string[]}
