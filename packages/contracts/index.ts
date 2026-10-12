import { z } from 'zod';
import {boardRoleSchema} from './board.js';
export const nameSchema=z.string().trim().min(1).max(24);
export const codeSchema=z.string().regex(/^\d{4}$/);
export const seatSchema=z.number().int().min(1).max(256);
export const createSchema=z.object({nickname:nameSchema,requestId:z.string().uuid()});
export const joinSchema=z.object({nickname:nameSchema,code:codeSchema});
export const selectSchema=z.object({seat:z.number().int().positive().max(256)}).strict();
export interface PublicSeat { number:number; memberId:string|null; nickname:string|null; avatarUrl?:string|null; isHost:boolean; isTestPlayer:boolean; ready:boolean }
export interface RoomSnapshot { board:import('./board.js').RoomBoardSnapshot; manual?:import('./records.js').ManualPublic|null; control?:import('./control.js').GameControl; testRoom:boolean; id:string; code:string; boardId:string; revision:number; seats:PublicSeat[]; preparation:PreparationState; night?:import('./night.js').NightPublic|null; day?:import('./day.js').DayPublic|null }
export interface MyMembership { id:string; nickname:string; isHost:boolean; seat:number|null }
export interface LobbyView { testPlayersEnabled:boolean; room:RoomSnapshot; me:MyMembership }
export interface ApiFailure { error:string; message:string }
export class LobbyError extends Error {
 constructor(public code:string,public status=400){super(code);}
}
export const messages:Record<string,string>={
 VOICE_BUSY:'本房间已有另一台设备播报，请先关闭或等待15秒后重试',VOICE_LEASE_LOST:'播报连接已失效，请重新开启',
 INVALID_NAME:'请输入 1–24 个字符的昵称',INVALID_CODE:'请输入四位数字房间号',INVALID_SEAT:'请选择本局有效座位',
 INVALID_INPUT:'输入格式不正确，请检查后重试',ROOM_NOT_FOUND:'未找到该房间，请检查房间号',ROOM_CODES_FULL:'可用房间号已满，请稍后重试',
 NOT_MEMBER:'请先加入房间',SEAT_TAKEN:'这个座位已被其他玩家选中，请选择空位',RULE_UNRESOLVED:'换座规则尚未确认，当前座位已保留',
 UNAUTHORIZED:'设备会话已失效，请返回首页重新加入',FORBIDDEN:'此请求来源不受支持',RATE_LIMITED:'操作太频繁，请稍后再试',
 PARTICIPANT_ONLY:'只有本局参赛玩家可以查看完整记录',PRIORITY_WOLF_ONLY:'本夜需由优先指刀的狼人确认',INTERNAL_ERROR:'服务器暂时无法处理，请稍后重试'
};
Object.assign(messages,{INVALID_BOARD_CONFIGURATION:'角色总数须与人数一致，特殊角色只能有一位',BOARD_NOT_IMPLEMENTED:'此板子配置可保存；完整玩法开发中，暂不能发牌',BOARD_NOT_FOUND:'未找到你的自定义板子',STALE_BOARD:'板子已更新，请重新载入',BOARD_VERSION_UNSUPPORTED:'此板子的规则版本暂不受支持',OCCUPIED_SEATS_OUTSIDE_BOARD:'缩减人数前，请超出范围的玩家自行取消入座'});

export const roleSchema=boardRoleSchema;
export type Role=z.infer<typeof roleSchema>;
export const settingsSchema=z.object({dealMethod:z.enum(['online','physical']),gameMode:z.enum(['automatic','manual'])}).strict();
export type RoomSettings=z.infer<typeof settingsSchema>;
export const readySchema=z.object({ready:z.boolean(),settingsRevision:z.number().int().min(0)}).strict();
export const identitySchema=z.object({role:roleSchema}).strict();
export const emptySchema=z.object({}).strict();
export interface PreparationState {settingsRevision:number;phase:'lobby'|'identity_collection'|'started';settings:RoomSettings;submittedCount:number;confirmedCount:number;validation:'waiting'|'valid'|'mismatch'}
export interface PrivateIdentity {role:Role|null;confirmed:boolean;locked:boolean}
Object.assign(messages,{
 TEST_PLAYERS_DISABLED:'测试功能未启用',NOT_TEST_PLAYER:'只能操作测试玩家',TEST_ROOM_NOT_EMPTY:'请创建只有你一人的新房间再添加测试玩家',TEST_ONLINE_ONLY:'测试玩家目前仅支持线上随机发牌',SETTINGS_CHANGED:'房主已更新设置，请查看后重新准备',HOST_ONLY:'只有房主可以执行此操作',HOST_NOT_SEATED:'房主必须入座参赛',ROOM_NOT_FULL:'请按本局人数全部入座',NOT_ALL_READY:'请等待所有玩家准备',
 PHASE_LOCKED:'当前阶段不允许此操作',NOT_SEATED:'请先选择座位',IDENTITY_UNAVAILABLE:'身份尚未分配',IDENTITY_INCOMPLETE:'请等待所有玩家确认身份',
 ROLE_MISMATCH:'角色数量不匹配，请各自检查身份'
});

Object.assign(messages,{NIGHT_UNAVAILABLE:'当前不能进入自动夜晚',NOT_YOUR_TURN:'当前不是你的行动阶段',STALE_TURN:'阶段已切换，请查看最新操作',ALREADY_COMMITTED:'此操作已确认，不能重复修改',CANNOT_SELF_SAVE:'女巫不能自救',POTION_UNAVAILABLE:'该药剂已经使用或无可救目标',CONFIRMER_ONLY:'只有本夜指定的狼人可以确认',NIGHT_RULE_UNRESOLVED:'该提示规则待确认，当前不能操作',DAY_UNAVAILABLE:'当前不能进入白天',DAY_RULE_UNRESOLVED:'首夜与警上结算顺序尚待确认，白天暂不能开始'});

Object.assign(messages,{ADMIN_ONLY:'仅管理员可以访问',ADMIN_EXISTS:'超级管理员已存在',ADMIN_PROTECTED:'不能禁用超级管理员',USERNAME_TAKEN:'用户名已被使用',LOGIN_FAILED:'用户名或密码错误',ACCOUNT_DISABLED:'账号已禁用',ALREADY_LOGGED_IN:'请先退出当前账号',ACCOUNT_ROOM_CONFLICT:'此账号已在同一房间占座，无法关联当前游客。请先取消其中一个座位。',NOT_FOUND:'未找到该记录'});

Object.assign(messages,{RESULT_NOT_READY:'请先完成查验并查看结果'});

Object.assign(messages,{GAME_PAUSED:'对局暂停或恢复准备中，请稍候',STALE_CONTROL:'管理状态已更新，请重新确认',INVALID_DELEGATE:'请选择其他存活参赛玩家'});

Object.assign(messages,{GRACE_ACTIVE:'连接宽限期间不能提前跳过阶段'});

Object.assign(messages,{RECORDER_ONLY:"只有参赛房主或有效 VIP 可记录",VIP_ONLY:"需要有效 VIP",STALE_RECORD:"记录已更新，请重新读取后修改",MANUAL_MODE:"本局已切换为纯手动记录",MANUAL_MODE_REQUIRED:"当前不是纯手动模式",RECORD_WITHDRAWN:"作者已撤回，重新发布后恢复访问",RECORD_ACCOUNT_CONFLICT:"当前游客和账号各有独立草稿，无法自动合并"});

Object.assign(messages,{OFFICIAL_UNCOMMITTED:'死讯修改尚未提交，请先修正官方记录后发布'});
Object.assign(messages,{LOGIN_REQUIRED:'请先登录账号',SHARE_AUTHOR_ONLY:'只能管理自己发布的复盘链接',SHARE_UNPUBLISHED:'请先结束对局并发布复盘',SHARE_REVOKED:'此链接已主动撤销，请重新生成',STALE_SHARE:'链接状态已更新，请重新读取',SHARE_UNAVAILABLE:'分享链接暂不可用'});
Object.assign(messages,{AVATAR_TOO_LARGE:'头像超过当前账号允许的文件大小',INVALID_AVATAR:'请选择有效的 JPEG、PNG 或 WebP 图片'});
Object.assign(messages,{RULE_DECISION_REQUIRED:'该技能组合的规则尚未确认，请选择已确认的操作',GUARD_CONSECUTIVE_TARGET:'不能连续两夜守护同一玩家',SKILL_NOT_ACTIVE:'该技能从下一夜开始可用',SKILL_EXHAUSTED:'该技能已用完',ALREADY_LEARNED:'已经完成学习，不能重新选择',KNIFE_NOT_INHERITED:'继承普通狼刀后才可使用额外刀'});
