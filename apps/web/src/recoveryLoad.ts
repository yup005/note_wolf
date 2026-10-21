import type {SharedRecord} from '../../../packages/contracts/sharing';
import {shareTokenSchema} from '../../../packages/contracts/sharing';
import {api,ApiError} from './api';
import type {AccountSession,RecoveryPayload} from './sessionTypes';
export async function readSharedRecord(path:string,authenticated:boolean,signal:AbortSignal):Promise<SharedRecord>{
 const response=await fetch(path,{signal,cache:'no-store',credentials:authenticated?'same-origin':'omit'}),data=await response.json();
 if(!response.ok)throw new ApiError(data.error??'UNAVAILABLE',data.message??'分享链接暂不可用',response.status);return data as SharedRecord;
}
export async function loadRecovery(pathname:string,signal:AbortSignal):Promise<RecoveryPayload>{
 if(pathname.startsWith('/share/')){const token=pathname.slice(7);if(!shareTokenSchema.safeParse(token).success)throw Error('分享链接暂不可用');return {kind:'share',token,post:await readSharedRecord(`/api/shared-records/${token}`,false,signal)};}
 const session=await api<AccountSession>('/api/session',undefined,{signal});if(!session||!Array.isArray(session.rooms)||!('account' in session))throw Error('连接失败');return {kind:'lobby',session};
}
