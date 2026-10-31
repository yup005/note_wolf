import {LobbyError} from '../../packages/contracts/index.js';
import type {IncomingMessage} from 'node:http';
export function gameHeader(req:IncomingMessage):string|undefined{
 const occurrences=req.rawHeaders.filter((_,i)=>i%2===0&&req.rawHeaders[i].toLowerCase()==='x-wolf-game-id').length;
 const value=req.headers['x-wolf-game-id'];
 if(occurrences>1||Array.isArray(value)||value!==undefined&&!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value))throw new LobbyError('INVALID_INPUT');
 return value;
}
/** Every other room subroute belongs to live gameplay, including unknown routes. */
export function fixedArchivePath(path:string){return /^\/(?:records|record(?:\/(?:create|publish|withdraw|import-auto))?|replay|manual\/(?:commit|history))\/?$/.test(path);}
