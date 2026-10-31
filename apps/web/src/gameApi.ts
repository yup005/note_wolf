import {api} from './api';
/** Captured by the caller; old requests cannot pick up a later game's authority. */
export function gameApi(roomId:string,gameId:string){
 return function request<T>(path:string,body?:unknown){
  return api<T>(path.startsWith('/api/')?path:`/api/rooms/${roomId}/${path.replace(/^\//,'')}`,body,{gameId});
 };
}
