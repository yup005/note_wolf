import type {ApiFailure} from '../../../packages/contracts/index';
export class ApiError extends Error {constructor(public code:string,message:string,public status:number){super(message);this.name='ApiError';}}
export async function api<T>(path:string,body?:unknown,options?:{gameId?:string}):Promise<T>{
 const headers:Record<string,string>={...(body?{'Content-Type':'application/json'}:{}),...(options?.gameId?{'X-Wolf-Game-Id':options.gameId}:{})};
 const res=await fetch(path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
 const data=await res.json();if(!res.ok){if(path.startsWith('/api/admin/')&&[401,403].includes(res.status))window.dispatchEvent(new Event('wolf:admin-authority-lost'));throw new ApiError((data as ApiFailure).error,(data as ApiFailure).message??'连接失败，请稍后再试',res.status);}return data as T;
}
export function requestId(){
 if(crypto.randomUUID)return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export const errorText=(e:unknown)=>e instanceof Error?e.message:'连接失败，请稍后再试';
