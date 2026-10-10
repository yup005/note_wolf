import { z } from 'zod';
export const nameSchema=z.string().trim().min(1).max(24);
export const codeSchema=z.string().regex(/^\d{4}$/);
export const seatSchema=z.number().int().min(1).max(12);
export const createSchema=z.object({nickname:nameSchema,requestId:z.string().uuid()});
export const joinSchema=z.object({nickname:nameSchema,code:codeSchema});
export const selectSchema=z.object({seat:seatSchema});
export interface PublicSeat { number:number; memberId:string|null; nickname:string|null; isHost:boolean }
export interface RoomSnapshot { id:string; code:string; boardId:'seer-witch-hunter-idiot-12'; revision:number; seats:PublicSeat[] }
export interface MyMembership { id:string; nickname:string; isHost:boolean; seat:number|null }
export interface LobbyView { room:RoomSnapshot; me:MyMembership }
export interface ApiFailure { error:string; message:string }
export class LobbyError extends Error {
 constructor(public code:string,public status=400){super(code);}
}
export const messages:Record<string,string>={
 INVALID_NAME:'请输入 1–24 个字符的昵称',INVALID_CODE:'请输入四位数字房间号',INVALID_SEAT:'请选择 1–12 号座位',
 INVALID_INPUT:'输入格式不正确，请检查后重试',ROOM_NOT_FOUND:'未找到该房间，请检查房间号',ROOM_CODES_FULL:'可用房间号已满，请稍后重试',
 NOT_MEMBER:'请先加入房间',SEAT_TAKEN:'这个座位已被其他玩家选中，请选择空位',RULE_UNRESOLVED:'换座规则尚未确认，当前座位已保留',
 UNAUTHORIZED:'设备会话已失效，请返回首页重新加入',FORBIDDEN:'此请求来源不受支持',RATE_LIMITED:'操作太频繁，请稍后再试',
 INTERNAL_ERROR:'服务器暂时无法处理，请稍后重试'
};
