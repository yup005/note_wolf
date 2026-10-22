import {judgeAppointSchema,judgeDraftSchema,judgeSupplementSchema,judgeReturnSchema} from '../../packages/contracts/judge.js';
import {voiceCommandSchema} from '../../packages/contracts/voice.js';
import {boardSaveSchema,boardConfigureSchema} from '../../packages/contracts/board.js';
import {shareCommandSchema} from '../../packages/contracts/sharing.js';
import express from 'express';
import {registerSchema,credentialsSchema,userStatusSchema,vipSchema,profileSchema} from '../../packages/contracts/auth.js';
import {avatarMimeTypes,avatarUploadLimit} from '../../packages/storage/avatars.js';
import {createServer as createHttpServer} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {createDiagnostics,type DiagnosticWrite,type DiagnosticContext} from './diagnostics.js';
import {Server} from 'socket.io';
import {LobbyStore} from '../../packages/storage/lobby.js';
import {LobbyError,createSchema,joinSchema,selectSchema,messages,settingsSchema,readySchema,identitySchema,emptySchema} from '../../packages/contracts/index.js';
import {recordCreateSchema,recordDeleteSchema,recordSaveSchema,recordRevisionSchema,manualSwitchSchema,manualResolveSchema,manualAdjudicateSchema,manualFinishSchema} from '../../packages/contracts/records.js';
import {controlSchema} from '../../packages/contracts/control.js';
import {nightCommandSchema,beginNightSchema} from '../../packages/contracts/night.js';
import {dayCommandSchema,type FirstDayRules} from '../../packages/contracts/day.js';
import type {IncomingMessage} from 'node:http';
import type {ZodType} from 'zod';
import {testPlayersAllowed} from './testPlayerPolicy.js';
import {favoriteQuerySchema,favoriteKindSchema,favoriteNameSchema} from '../../packages/contracts/favorites.js';

export interface ServerOptions {diagnosticWrite?:DiagnosticWrite;dbPath:string;codeStart?:()=>number;secureCookie?:boolean;allowTestPlayers?:boolean;testPlayerScope?:string;now?:()=>number;dayRulesFixture?:FirstDayRules}
const cookieName='wolf_session';
function cookieToken(req:IncomingMessage){
 const value=(req.headers.cookie??'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 return value && /^[a-f0-9]{64}$/.test(value)?value:undefined;
}
function validOrigin(req:IncomingMessage){
 const origin=req.headers.origin;
 if(!origin)return true;
 try{const u=new URL(origin);return ['http:','https:'].includes(u.protocol)&&u.host===req.headers.host;}catch{return false;}
}
function parse<T>(schema:ZodType<T>,body:unknown):T{const result=schema.safeParse(body);if(!result.success)throw new LobbyError('INVALID_INPUT');return result.data;}
export async function createServer(options:ServerOptions){
 const testPlayersEnabled=testPlayersAllowed(options.allowTestPlayers,options.testPlayerScope,process.env);
 const diagnostics=createDiagnostics(options.diagnosticWrite);
 let store:LobbyStore;
 try{store=new LobbyStore(options.dbPath,options.codeStart,testPlayersEnabled,options.now,process.env.NODE_ENV==='production'?undefined:options.dayRulesFixture);}catch(error){diagnostics.fault('startup',error);throw new Error('SERVER_STARTUP_FAILED');}
 const web=express();web.disable('x-powered-by');
 const http=createHttpServer(web);
 const io=new Server(http,{maxHttpBufferSize:8192,allowRequest:(req,done)=>done(null,validOrigin(req))});
 function roomContext(id:unknown):DiagnosticContext{
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))return {};
  try{const room=store.snapshot(id);return {gameId:room.id,phase:room.day?.phase==='ended'||room.manual?.status==='ended'?'ended':room.manual?'manual':room.day&&(!room.night||room.day.day>=room.night.night)?'day':room.night?'night':'preparation'};}catch{return {gameId:id};}
 }
 web.param('id',(req,res,next,id)=>{if(typeof req.route?.path==='string'&&req.route.path.startsWith('/api/rooms/:id'))res.locals.diagnosticRoomId=id;next();});
 const hits=new Map<string,{count:number;until:number}>();
 const limiter=setInterval(()=>{for(const [key,v] of hits)if(v.until<Date.now())hits.delete(key);},60000);limiter.unref();
 function authenticated(req:IncomingMessage){const token=cookieToken(req);if(!token||!store.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return token;}
 web.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  if(req.path.startsWith('/api/')){res.locals.requestId=randomUUID();res.setHeader('X-Request-ID',res.locals.requestId);res.setHeader('Cache-Control','no-store');}
  if(!validOrigin(req))return next(new LobbyError('FORBIDDEN',403));
  // Readiness must remain reachable when ticking or session storage is broken.
  if(req.path==='/api/health')return next();
  if(req.path.startsWith('/api/')){
   for(const id of store.tickNights())publish(id);
   res.setHeader('Cache-Control','no-store');
   const session=cookieToken(req);
   const key=session&&store.hasSession(session)?`session:${session}`:`ip:${req.socket.remoteAddress??'unknown'}`;const now=Date.now();let entry=hits.get(key);
   if(!entry||entry.until<now){entry={count:0,until:now+60000};hits.set(key,entry);}
   const limit=testPlayersEnabled&&session&&store.hasSession(session)&&store.isDevelopmentTestHost(session)?1000:300;
   if(++entry.count>limit){res.setHeader('Retry-After','60');return next(new LobbyError('RATE_LIMITED',429));}
  }
  next();
 });
 // Authenticate and enforce the original-file quota before parsing binary uploads.
 web.post('/api/auth/avatar',(req,res,next)=>{
  try{
   if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');
   const account=store.auth.requireAccount(authenticated(req));
   const uploadToken=authenticated(req);
   const contentType=(req.headers['content-type']??'').split(';')[0].trim().toLowerCase();
   if(!avatarMimeTypes.has(contentType))throw new LobbyError('INVALID_AVATAR',415);
   express.raw({type:()=>true,limit:avatarUploadLimit(account)})(req,res,error=>{
    if(error)return next(typeof error==='object'&&error!==null&&'type' in error&&error.type==='entity.too.large'?new LobbyError('AVATAR_TOO_LARGE',413):error);
    void store.uploadAvatar(uploadToken,Buffer.isBuffer(req.body)?req.body:Buffer.alloc(0),contentType).then(result=>{
     for(const room of result.rooms)publish(room.room.id);res.json(result);
    }).catch(next);
   });
  }catch(error){next(error);}
 });
 web.use(express.json({limit:'64kb'}));
 web.post('/api/auth/profile',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const result=store.updateProfile(authenticated(req),parse(profileSchema,req.body).nickname);for(const room of result.rooms)publish(room.room.id);res.json(result);});
 web.delete('/api/auth/avatar',(req,res)=>{if(Object.keys(req.query).length||req.body===undefined&&(Number(req.headers['content-length']??0)>0||req.headers['transfer-encoding']!==undefined))throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body??{});const result=store.deleteAvatar(authenticated(req));for(const room of result.rooms)publish(room.room.id);res.json(result);});
 web.get('/api/avatars/:accountId',(req,res)=>{if(Object.keys(req.query).some(key=>key!=='v')||req.query.v!==undefined&&typeof req.query.v!=='string')throw new LobbyError('INVALID_INPUT');res.type('image/jpeg').send(store.avatar(req.params.accountId,req.query.v as string|undefined));});
 web.get('/api/health',(_req,res)=>{
  try{store.checkStorage();diagnostics.recovered('health');res.json({status:'ok',storage:'ok'});}
  catch(error){const requestId=diagnostics.fault('health',error,{requestId:res.locals.requestId},true);res.setHeader('X-Request-ID',requestId);res.status(503).json({status:'degraded',storage:'unavailable',requestId});}
 });
 web.get('/api/boards',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.boardLibrary(authenticated(req)));});
 web.post('/api/boards',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.saveBoard(authenticated(req),parse(boardSaveSchema,req.body)));});
 web.post('/api/rooms/:id/board',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const result=store.configureBoard(authenticated(req),req.params.id,parse(boardConfigureSchema,req.body));publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.get('/api/shared-records/:token',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.sharedRecord(req.params.token,cookieToken(req)));});
 web.get('/api/shared-records/:token/favorite',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.sharedFavoriteStatus(cookieToken(req),req.params.token));});
 web.post('/api/shared-records/:token/favorite',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body);res.json(store.saveSharedFavorite(authenticated(req),req.params.token));});
 web.get('/api/shared-favorites/:id',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.sharedFavorite(authenticated(req),req.params.id));});
 web.post('/api/shared-favorites/:id/remove',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body);res.json(store.removeSharedFavorite(authenticated(req),req.params.id));});
 web.get('/api/shares',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json({items:store.ownShares(authenticated(req))});});
 web.get('/api/records/:id/share',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.shareStatus(authenticated(req),req.params.id));});
 web.post('/api/records/:id/share',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');recordWrite(res,req.params.id,store.shareRecord(authenticated(req),req.params.id,parse(shareCommandSchema,req.body)));});
 web.get('/api/notifications',(req,res)=>{parse(emptySchema,req.body??{});res.json(store.notificationsList(authenticated(req),req.query));});
 web.post('/api/notifications/settings',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.notificationSettings(authenticated(req),req.body));});
 web.post('/api/notifications/command',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.notificationCommand(authenticated(req),req.body));});
 web.post('/api/notifications/:id/open',(req,res)=>{if(Object.keys(req.query).length||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body);res.json(store.notificationOpen(authenticated(req),req.params.id));});
 web.post('/api/community/focus',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.communityFocus(cookieToken(req),req.body));});
 web.post('/api/community/read',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.communityRead(cookieToken(req),req.body));});
 for(const [path,method] of [['comment','communityComment'],['like','communityLike'],['game-like','communityGameLike'],['report','communityReport']] as const)web.post('/api/community/'+path,(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store[method](authenticated(req),req.body));});
 web.get('/api/community/me',(req,res)=>{parse(emptySchema,req.body??{});if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.communityMe(authenticated(req)));});
 web.get('/api/admin/community/users/:id',(req,res)=>{parse(emptySchema,req.body??{});if(Object.keys(req.query).length||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))throw new LobbyError('INVALID_INPUT');res.json(store.communityUser(authenticated(req),req.params.id));});
 for(const [path,method] of [['reports','adminReportGroups'],['audit','adminAuditList'],['shares','adminShares']] as const)web.get('/api/admin/oversight/'+path,(req,res)=>{parse(emptySchema,req.body??{});res.json(store[method](authenticated(req),req.query));});
 web.post('/api/admin/oversight/export',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.adminExport(authenticated(req),req.body));});
 web.post('/api/admin/oversight/share-revoke',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.adminRevokeShare(authenticated(req),req.body));});
 web.get('/api/admin/community/reports',(req,res)=>{parse(emptySchema,req.body??{});res.json(store.communityReports(authenticated(req),req.query));});
 web.get('/api/admin/community/audit',(req,res)=>{parse(emptySchema,req.body??{});res.json(store.communityAudit(authenticated(req),req.query));});
 web.post('/api/admin/community/action',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.communityModerate(authenticated(req),req.body));});
 web.get('/api/session',(req,res)=>{
  let token=cookieToken(req);
  if(!token||!store.hasSession(token)){
   token=randomBytes(32).toString('hex');store.issueSession(token);
   res.cookie(cookieName,token,{httpOnly:true,sameSite:'strict',secure:options.secureCookie??false,path:'/',maxAge:365*24*60*60*1000});
  }
  res.json({rooms:store.roomsFor(token),account:store.auth.account(token)});
 });
 const authHits=new Map<string,{count:number;until:number}>();
 function authRate(req:express.Request){const key=req.socket.remoteAddress??'unknown';const now=Date.now();for(const [id,v] of authHits)if(v.until<now)authHits.delete(id);let hit=authHits.get(key);if(!hit||hit.until<now){hit={count:0,until:now+60000};authHits.set(key,hit);}if(++hit.count>20)throw new LobbyError('RATE_LIMITED',429);}
 function cookie(res:express.Response,token:string){res.cookie(cookieName,token,{httpOnly:true,sameSite:'strict',secure:options.secureCookie??false,path:'/',maxAge:365*24*60*60*1000});}
 function disconnectRevoked(){for(const socket of io.sockets.sockets.values()){const token=cookieToken(socket.request);if(!token||!store.hasSession(token))socket.disconnect(true);}}
 for(const action of ['register','login'] as const)web.post(`/api/auth/${action}`,async(req,res)=>{authRate(req);const token=authenticated(req);if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const result=action==='register'?await (async()=>{const b=parse(registerSchema,req.body);return store.auth.register(token,b.username,b.password,b.nickname);})():await (async()=>{const b=parse(credentialsSchema,req.body);return store.auth.login(token,b.username,b.password);})();cookie(res,result.token);disconnectRevoked();for(const room of store.roomsFor(result.token))publish(room.room.id);res.json({account:result.account,rooms:store.roomsFor(result.token)});});
 web.post('/api/auth/logout',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body);cookie(res,store.auth.logout(authenticated(req)));disconnectRevoked();res.json({account:null,rooms:[]});});
 web.get('/api/admin/users',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json({users:store.auth.users(authenticated(req))});});
 web.post('/api/admin/users/:id/status',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const b=parse(userStatusSchema,req.body);res.json(store.auth.setStatus(authenticated(req),req.params.id,b.status));disconnectRevoked();});
 web.post('/api/admin/users/:id/vip',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const b=parse(vipSchema,req.body);res.json(store.auth.setVip(authenticated(req),req.params.id,b.enabled,b.expiresAt));});
 web.get('/api/admin/rooms',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json({rooms:store.adminRooms(authenticated(req))});});
 web.get('/api/admin/rooms/:id/records',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json({posts:store.adminRecordList(authenticated(req),req.params.id)});});
 web.get('/api/admin/rooms/:id/replay',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.adminReplay(authenticated(req),req.params.id));});
 web.post('/api/rooms',(req,res)=>{
  const token=authenticated(req);const body=parse(createSchema,req.body);
  const result=store.create(token,body.nickname,body.requestId);roomWrite(res,result.room.id,result);
 });
 web.post('/api/rooms/join',(req,res)=>{
  const token=authenticated(req);const body=parse(joinSchema,req.body);
  const result=store.join(token,body.code,body.nickname);
  io.to(result.room.id).emit('room:snapshot',result.room);roomWrite(res,result.room.id,result);
 });
 web.get('/api/rooms/:id',(req,res)=>res.json(store.view(authenticated(req),req.params.id)));
 web.post('/api/rooms/:id/seat',(req,res)=>{
  const token=authenticated(req);const body=parse(selectSchema,req.body);
  const result=store.select(token,req.params.id,body.seat);
  io.to(result.room.id).emit('room:snapshot',result.room);roomWrite(res,req.params.id,result);
 });
 // Secrets never enter the public broadcast channel.
 function publish(roomId:string){try{io.to(roomId).emit('room:snapshot',store.snapshot(roomId));}catch(e){if(!(e instanceof LobbyError&&e.code==='ROOM_NOT_FOUND'))throw e;}}
 function roomWrite(res:express.Response,roomId:string,result:unknown){store.touchRooms([roomId]);res.json(result);}
 function recordWrite(res:express.Response,recordId:string,result:unknown){store.touchRecordRoom(recordId);res.json(result);}
 // Lease claims, polls and acknowledgements are background delivery, not room activity.
 web.post('/api/rooms/:id/voice',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const body=parse(voiceCommandSchema,req.body);res.json(store.publicVoice(authenticated(req),req.params.id,body));});
 web.post('/api/rooms/:id/settings',(req,res)=>{const result=store.configure(authenticated(req),req.params.id,parse(settingsSchema,req.body));publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.post('/api/rooms/:id/ready',(req,res)=>{const body=parse(readySchema,req.body);const result=store.setReady(authenticated(req),req.params.id,body.ready,body.settingsRevision);publish(req.params.id);roomWrite(res,req.params.id,result);});
 for(const action of ['unseat','deal','start'] as const){
  web.post(`/api/rooms/:id/${action}`,(req,res)=>{parse(emptySchema,req.body);const result=store[action](authenticated(req),req.params.id);publish(req.params.id);roomWrite(res,req.params.id,result);});
 }
 web.get('/api/rooms/:id/identity',(req,res)=>{
  const token=authenticated(req);if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');
  res.json(store.identity(token,req.params.id));
 });
 web.post('/api/rooms/:id/identity',(req,res)=>{const token=authenticated(req);if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');
  const body=parse(identitySchema,req.body);const result=store.submitIdentity(token,req.params.id,body.role);publish(req.params.id);roomWrite(res,req.params.id,result);
 });
 web.post('/api/rooms/:id/identity/confirm',(req,res)=>{const token=authenticated(req);if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');
  parse(emptySchema,req.body);const result=store.confirmIdentity(token,req.params.id);publish(req.params.id);roomWrite(res,req.params.id,result);
 });
 web.get('/api/rooms/:id/management-history',(req,res)=>{parse(emptySchema,req.body??{});res.json(store.managementHistory(authenticated(req),req.params.id,req.query));});
 web.get('/api/rooms/:id/control/defaults',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body??{});res.json(store.futureVoteSettings(authenticated(req),req.params.id));});
 web.post('/api/rooms/:id/control',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const result=store.gameControl(authenticated(req),req.params.id,parse(controlSchema,req.body));publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.post('/api/rooms/:id/night/enter',(req,res)=>{parse(emptySchema,req.body);const result=store.enterNight(authenticated(req),req.params.id);publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.post('/api/rooms/:id/night/begin',(req,res)=>{const body=parse(beginNightSchema,req.body);const result=store.beginNight(authenticated(req),req.params.id,body.turnId);publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.get('/api/rooms/:id/night/private',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.nightPrivate(authenticated(req),req.params.id));});
 web.post('/api/rooms/:id/night/command',(req,res)=>{const token=authenticated(req);store.view(token,req.params.id);const revision=store.snapshot(req.params.id).revision;const result=store.nightCommand(token,req.params.id,parse(nightCommandSchema,req.body));if(store.snapshot(req.params.id).revision!==revision)publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.get('/api/rooms/:id/replay',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const token=authenticated(req);res.json({...store.gameReplay(token,req.params.id),saved:store.isFavorite(token,req.params.id)});});
 web.post('/api/rooms/:id/favorite',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body);roomWrite(res,req.params.id,store.saveFavorite(authenticated(req),req.params.id));});
 web.get('/api/favorites',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json({items:store.favorites(authenticated(req))});});
 web.get('/api/favorite-library',(req,res)=>{res.json(store.favoriteLibrary(authenticated(req),parse(favoriteQuerySchema,req.query)));});
 web.post('/api/favorite-library/:kind/:id/name',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.renameFavorite(authenticated(req),parse(favoriteKindSchema,req.params.kind),req.params.id,parse(favoriteNameSchema,req.body)));});
 web.get('/api/favorites/:id',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.favoriteReplay(authenticated(req),req.params.id));});
 web.post('/api/favorites/:id/remove',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body);res.json(store.removeFavorite(authenticated(req),req.params.id));});
 // Private drafts never enter room snapshots. Published records use archived participant authorization.
 web.get('/api/my-records',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json({items:store.myRecords(authenticated(req))});});
 web.post('/api/records/:id/delete',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const token=authenticated(req),own=store.myRecords(token).find(r=>r.id===req.params.id);const result=store.deleteRecord(token,req.params.id,parse(recordDeleteSchema,req.body));if(own)publish(own.roomId);recordWrite(res,req.params.id,result);});
 web.post('/api/rooms/:id/record/create',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');roomWrite(res,req.params.id,store.createRecord(authenticated(req),req.params.id,parse(recordCreateSchema,req.body)));});
 web.get('/api/rooms/:id/records',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.recordsList(authenticated(req),req.params.id));});
 web.post('/api/rooms/:id/record',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const b=parse(recordSaveSchema,req.body);roomWrite(res,req.params.id,store.saveRecord(authenticated(req),req.params.id,b.revision,b.document));});
 for(const action of ['publish','withdraw','import-auto'] as const)web.post(`/api/rooms/:id/record/${action}`,(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const b=parse(recordRevisionSchema,req.body);roomWrite(res,req.params.id,action==='import-auto'?store.importAutomaticRecord(authenticated(req),req.params.id,b.revision):action==='publish'?store.publishRecord(authenticated(req),req.params.id,b.revision):store.withdrawRecord(authenticated(req),req.params.id,b.revision));});
 for(const admin of [false,true])web.get(admin?'/api/admin/records/:id':'/api/records/:id',(req,res)=>{if(Object.keys(req.query).some(k=>k!=='version'))throw new LobbyError('INVALID_INPUT');const v=req.query.version;if(v!==undefined&&(typeof v!=='string'||! /^[1-9][0-9]{0,5}$/.test(v)))throw new LobbyError('INVALID_INPUT');res.json(admin?store.adminRecordPost(authenticated(req),req.params.id,v===undefined?undefined:Number(v)):store.recordPost(authenticated(req),req.params.id,v===undefined?undefined:Number(v)));});
 web.post('/api/records/:id/favorite',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body);recordWrite(res,req.params.id,store.saveRecordFavorite(authenticated(req),req.params.id));});
 web.get('/api/record-favorites',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json({items:store.recordFavorites(authenticated(req))});});
 web.get('/api/record-favorites/:id/private',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.privateRecordFavorite(authenticated(req),req.params.id));});
 web.post('/api/record-favorites/:id/remove',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body);res.json(store.removeRecordFavorite(authenticated(req),req.params.id));});
 web.get('/api/rooms/:id/judge/private',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body??{});res.json(store.judgePrivate(authenticated(req),req.params.id));});
 web.post('/api/rooms/:id/judge/appoint',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const result=store.appointJudge(authenticated(req),req.params.id,parse(judgeAppointSchema,req.body));publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.post('/api/rooms/:id/judge/draft',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');roomWrite(res,req.params.id,store.startJudgeDraft(authenticated(req),req.params.id,parse(judgeDraftSchema,req.body)));});
 web.post('/api/rooms/:id/judge/supplement',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');roomWrite(res,req.params.id,store.supplementJudge(authenticated(req),req.params.id,parse(judgeSupplementSchema,req.body)));});
 web.post('/api/rooms/:id/judge/return',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const result=store.returnJudge(authenticated(req),req.params.id,parse(judgeReturnSchema,req.body));publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.post('/api/rooms/:id/manual/switch',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const b=parse(manualSwitchSchema,req.body);const result=store.switchManual(authenticated(req),req.params.id,b.confirmed);publish(req.params.id);roomWrite(res,req.params.id,result);});
 for(const action of ['commit','request'] as const)web.post(`/api/rooms/:id/manual/${action}`,(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const b=parse(recordRevisionSchema,req.body);const result=action==='commit'?store.commitManual(authenticated(req),req.params.id,b.revision):store.requestManualEnd(authenticated(req),req.params.id,b.revision);publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.post('/api/rooms/:id/manual/finish-record',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const b=parse(manualFinishSchema,req.body);const result=store.finishManualRecord(authenticated(req),req.params.id,b);publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.post('/api/rooms/:id/manual/adjudicate',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const b=parse(manualAdjudicateSchema,req.body);const result=store.adjudicateManual(authenticated(req),req.params.id,b);publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.get('/api/rooms/:id/manual/request',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.manualRequest(authenticated(req),req.params.id));});
 web.get('/api/rooms/:id/manual/history',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json({items:store.manualHistory(authenticated(req),req.params.id)});});
 web.post('/api/rooms/:id/manual/resolve',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');const b=parse(manualResolveSchema,req.body);roomWrite(res,req.params.id,store.resolveManual(authenticated(req),req.params.id,b.version,b.hostRevision,b.accept));publish(req.params.id);});
 web.post('/api/rooms/:id/day/enter',(req,res)=>{parse(emptySchema,req.body);const result=store.enterDay(authenticated(req),req.params.id);publish(req.params.id);roomWrite(res,req.params.id,result);});
 web.get('/api/rooms/:id/day/self',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');parse(emptySchema,req.body??{});res.json(store.daySelf(authenticated(req),req.params.id));});
 web.get('/api/rooms/:id/day/private',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.dayPrivate(authenticated(req),req.params.id));});
 web.post('/api/rooms/:id/day/command',(req,res)=>{const result=store.dayCommand(authenticated(req),req.params.id,parse(dayCommandSchema,req.body));publish(req.params.id);roomWrite(res,req.params.id,result);});
 if(testPlayersEnabled){
  web.get('/api/rooms/:id/test-roles',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.testRoles(authenticated(req),req.params.id));});
  web.get('/api/rooms/:id/day/test-actor',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.testDayActor(authenticated(req),req.params.id));});
  web.post('/api/rooms/:id/day/test-advance',(req,res)=>{parse(emptySchema,req.body);const result=store.testDayAdvance(authenticated(req),req.params.id);publish(req.params.id);roomWrite(res,req.params.id,result);});
  web.get('/api/rooms/:id/test-players/:actorId/day/private',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.testDayPrivate(authenticated(req),req.params.id,req.params.actorId));});
  web.post('/api/rooms/:id/test-players/:actorId/day/command',(req,res)=>{const result=store.testDayCommand(authenticated(req),req.params.id,req.params.actorId,parse(dayCommandSchema,req.body));publish(req.params.id);roomWrite(res,req.params.id,result);});
  web.get('/api/rooms/:id/night/test-actor',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.testNightActor(authenticated(req),req.params.id));});
  web.post('/api/rooms/:id/night/test-advance',(req,res)=>{parse(emptySchema,req.body);const result=store.testNightAdvance(authenticated(req),req.params.id);publish(req.params.id);roomWrite(res,req.params.id,result);});
  web.get('/api/rooms/:id/test-players/:actorId/night/private',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.testNightPrivate(authenticated(req),req.params.id,req.params.actorId));});
  web.post('/api/rooms/:id/test-players/:actorId/night/command',(req,res)=>{const token=authenticated(req);store.view(token,req.params.id);const revision=store.snapshot(req.params.id).revision;const result=store.testNightCommand(token,req.params.id,req.params.actorId,parse(nightCommandSchema,req.body));if(store.snapshot(req.params.id).revision!==revision)publish(req.params.id);roomWrite(res,req.params.id,result);});
  web.post('/api/rooms/:id/test-players',(req,res)=>{parse(emptySchema,req.body);const result=store.fillTestPlayers(authenticated(req),req.params.id);publish(req.params.id);roomWrite(res,req.params.id,result);});
  web.get('/api/rooms/:id/test-players/:actorId/identity',(req,res)=>{if(Object.keys(req.query).length)throw new LobbyError('INVALID_INPUT');res.json(store.testPlayerIdentity(authenticated(req),req.params.id,req.params.actorId));});
  web.post('/api/rooms/:id/test-players/:actorId/ready',(req,res)=>{const body=parse(readySchema,req.body);const result=store.testPlayerReady(authenticated(req),req.params.id,req.params.actorId,body.ready,body.settingsRevision);publish(req.params.id);roomWrite(res,req.params.id,result);});
  web.post('/api/rooms/:id/test-players/:actorId/identity/confirm',(req,res)=>{parse(emptySchema,req.body);const result=store.testPlayerConfirm(authenticated(req),req.params.id,req.params.actorId);publish(req.params.id);roomWrite(res,req.params.id,result);});
 }
 web.use('/api',(_req,res)=>res.status(404).json({error:'NOT_FOUND',message:'接口不存在'}));
 web.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  const isBodyError=error instanceof SyntaxError|| (typeof error==='object'&&error!==null&&'type' in error&&error.type==='entity.too.large');
  const e=error instanceof LobbyError?error:new LobbyError(isBodyError?'INVALID_INPUT':'INTERNAL_ERROR',isBodyError?400:500);
  const requestId=e.status>=500?diagnostics.fault('http',error,{...roomContext(res.locals.diagnosticRoomId),requestId:res.locals.requestId}):undefined;
  res.status(e.status).json({error:e.code,message:messages[e.code]??'请求无法处理',...(requestId?{requestId}:{})});
 });
 io.use((socket,next)=>{try{authenticated(socket.request);next();}catch(error){if(!(error instanceof LobbyError&&error.status<500))diagnostics.fault('socket-auth',error,{},true);next(new Error('UNAUTHORIZED'));}});
 io.on('connection',socket=>{
  let count=0;let window=Date.now();
  socket.on('disconnect',()=>diagnostics.guard('socket-disconnect',()=>{for(const id of store.disconnectMember(socket.id))publish(id);}));
  socket.on('room:subscribe',(body:unknown,ack:unknown)=>{
   if(typeof ack!=='function')return;
   if(Date.now()-window>60000){window=Date.now();count=0;}
   if(++count>60){ack({error:'RATE_LIMITED'});return;}
   try{
    if(typeof body!=='object'||body===null||!('roomId' in body)||typeof body.roomId!=='string'||body.roomId.length>64)throw new LobbyError('INVALID_INPUT');
    const view=store.view(authenticated(socket.request),body.roomId);const room=view.room;
    for(const joined of socket.rooms)if(joined!==socket.id)socket.leave(joined);
    for(const id of store.connectMember(room.id,view.me.id,socket.id))publish(id);socket.join(room.id);ack({room:store.snapshot(room.id)});
   }catch(e){const expected=e instanceof LobbyError&&e.status<500;const requestId=expected?undefined:diagnostics.fault('socket-subscribe',e,roomContext(typeof body==='object'&&body!==null&&'roomId' in body?body.roomId:undefined));ack({error:expected?e.code:'INTERNAL_ERROR',...(requestId?{requestId}:{})});}
  });
 });
 function cleanupRooms(){
  store.cleanupNotifications();
  // Forget presence mappings before disconnect callbacks can write deleted rows.
  for(const roomId of store.cleanupExpiredRooms()){
   io.to(roomId).emit('room:expired',{roomId,error:'ROOM_NOT_FOUND',message:'房间已清理，请返回首页'});
   io.in(roomId).disconnectSockets(true);
  }
 }
 diagnostics.guard('retention',cleanupRooms);
 const retentionTimer=setInterval(()=>diagnostics.guard('retention',cleanupRooms),60000);retentionTimer.unref();
 const nightTimer=setInterval(()=>diagnostics.guard('night-tick',()=>{for(const id of store.tickNights())publish(id);}),250);nightTimer.unref();
 return {web,http,io,store,cleanupExpiredRooms:cleanupRooms,async close(){clearInterval(nightTimer);clearInterval(retentionTimer);clearInterval(limiter);await new Promise<void>(resolve=>io.close(()=>resolve()));store.close();}};
}
