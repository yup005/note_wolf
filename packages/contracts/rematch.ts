import {z} from 'zod';
import type {LobbyView} from './index.js';
import type {RoomBoardSnapshot} from './board.js';
export interface GameRef {gameId:string;roomId:string;gameNumber:number}
export const rematchSchema=z.object({requestId:z.string().uuid(),expectedGameId:z.string().uuid()}).strict();
export type RematchCommand=z.infer<typeof rematchSchema>;
export interface RematchResult {game:GameRef;view:LobbyView}
export interface GameRecordContext {game:GameRef;code:string;board:RoomBoardSnapshot|null;ended:boolean;isOriginalHost:boolean}
