import type {SharedRecord} from '../../../packages/contracts/sharing';
import {shareTokenSchema} from '../../../packages/contracts/sharing';
import {api,ApiError} from './api';
import type {AccountSession,RecoveryPayload} from './sessionTypes';
import {displayTokenSchema,type DisplaySnapshot} from '../../../packages/contracts/display';
export class DisplayReadError extends ApiError {constructor(code:string,message:string,status:number,public retryAfterMs:number){super(code,message,status);}}
let displayLimit:{token:string;until:number}|undefined;
export async function readDisplay(token:string,signal:AbortSignal):Promise<DisplaySnapshot>{
 if(!displayTokenSchema.safeParse(token).success)throw Error('大屏链接暂不可用');
 if(displayLimit?.token===token&&displayLimit.until>Date.now())throw new DisplayReadError('RATE_LIMITED','请求较多，请稍后重新连接',429,displayLimit.until-Date.now());
 const response=await fetch(`/api/displays/${token}`,{signal,cache:'no-store',credentials:'omit'}),data=await response.json();
 if(!response.ok){const header=response.headers.get('Retry-After'),seconds=header===null?NaN:Number(header),date=header?Date.parse(header):NaN;
  const retry=Number.isFinite(seconds)?Math.max(0,seconds*1000):Number.isFinite(date)?Math.max(0,date-Date.now()):3000;
  if(response.status===429)displayLimit={token,until:Date.now()+retry};
  throw new DisplayReadError(data.error??'UNAVAILABLE',data.message??'大屏链接暂不可用',response.status,retry);
 }return data as DisplaySnapshot;
}
export async function readSharedRecord(path:string,authenticated:boolean,signal:AbortSignal):Promise<SharedRecord>{
 const response=await fetch(path,{signal,cache:'no-store',credentials:authenticated?'same-origin':'omit'}),data=await response.json();
 if(!response.ok)throw new ApiError(data.error??'UNAVAILABLE',data.message??'分享链接暂不可用',response.status);return data as SharedRecord;
}
export async function loadRecovery(pathname:string,signal:AbortSignal):Promise<RecoveryPayload>{
 if(pathname.startsWith('/display/')){const token=pathname.slice(9);return {kind:'display',token,snapshot:await readDisplay(token,signal)};}
 if(pathname.startsWith('/share/')){const token=pathname.slice(7);if(!shareTokenSchema.safeParse(token).success)throw Error('分享链接暂不可用');return {kind:'share',token,post:await readSharedRecord(`/api/shared-records/${token}`,false,signal)};}
 const session=await api<AccountSession>('/api/session',undefined,{signal});if(!session||!Array.isArray(session.rooms)||!('account' in session))throw Error('连接失败');return {kind:'lobby',session};
}
