import express from 'express';
import {createServer as createHttpServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {Server} from 'socket.io';
import {LobbyStore} from '../../packages/storage/lobby.js';
import {LobbyError,createSchema,joinSchema,selectSchema,messages} from '../../packages/contracts/index.js';
import type {IncomingMessage} from 'node:http';
import type {ZodType} from 'zod';

export interface ServerOptions {dbPath:string;codeStart?:()=>number;secureCookie?:boolean}
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
 const store=new LobbyStore(options.dbPath,options.codeStart);
 const web=express();web.disable('x-powered-by');
 const http=createHttpServer(web);
 const io=new Server(http,{maxHttpBufferSize:8192,allowRequest:(req,done)=>done(null,validOrigin(req))});
 const hits=new Map<string,{count:number;until:number}>();
 const limiter=setInterval(()=>{for(const [key,v] of hits)if(v.until<Date.now())hits.delete(key);},60000);limiter.unref();
 function authenticated(req:IncomingMessage){const token=cookieToken(req);if(!token||!store.hasSession(token))throw new LobbyError('UNAUTHORIZED',401);return token;}
 web.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  if(!validOrigin(req))return next(new LobbyError('FORBIDDEN',403));
  if(req.path.startsWith('/api/')){
   res.setHeader('Cache-Control','no-store');
   const key=req.socket.remoteAddress??'unknown';const now=Date.now();let entry=hits.get(key);
   if(!entry||entry.until<now){entry={count:0,until:now+60000};hits.set(key,entry);}
   if(++entry.count>300){res.setHeader('Retry-After','60');return next(new LobbyError('RATE_LIMITED',429));}
  }
  next();
 });
 web.use(express.json({limit:'8kb'}));
 web.get('/api/health',(_req,res)=>res.json({status:'ok'}));
 web.get('/api/session',(req,res)=>{
  let token=cookieToken(req);
  if(!token||!store.hasSession(token)){
   token=randomBytes(32).toString('hex');store.issueSession(token);
   res.cookie(cookieName,token,{httpOnly:true,sameSite:'strict',secure:options.secureCookie??false,path:'/',maxAge:365*24*60*60*1000});
  }
  res.json({rooms:store.roomsFor(token)});
 });
 web.post('/api/rooms',(req,res)=>{
  const token=authenticated(req);const body=parse(createSchema,req.body);
  res.json(store.create(token,body.nickname,body.requestId));
 });
 web.post('/api/rooms/join',(req,res)=>{
  const token=authenticated(req);const body=parse(joinSchema,req.body);
  const result=store.join(token,body.code,body.nickname);
  io.to(result.room.id).emit('room:snapshot',result.room);res.json(result);
 });
 web.get('/api/rooms/:id',(req,res)=>res.json(store.view(authenticated(req),req.params.id)));
 web.post('/api/rooms/:id/seat',(req,res)=>{
  const token=authenticated(req);const body=parse(selectSchema,req.body);
  const result=store.select(token,req.params.id,body.seat);
  io.to(result.room.id).emit('room:snapshot',result.room);res.json(result);
 });
 web.use('/api',(_req,res)=>res.status(404).json({error:'NOT_FOUND',message:'接口不存在'}));
 web.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  const isBodyError=error instanceof SyntaxError|| (typeof error==='object'&&error!==null&&'type' in error&&error.type==='entity.too.large');
  const e=error instanceof LobbyError?error:new LobbyError(isBodyError?'INVALID_INPUT':'INTERNAL_ERROR',isBodyError?400:500);
  if(e.status===500)console.error('API error',error instanceof Error?error.message:'unknown');
  res.status(e.status).json({error:e.code,message:messages[e.code]??'请求无法处理'});
 });
 io.use((socket,next)=>{try{authenticated(socket.request);next();}catch{next(new Error('UNAUTHORIZED'));}});
 io.on('connection',socket=>{
  let count=0;let window=Date.now();
  socket.on('room:subscribe',(body:unknown,ack:unknown)=>{
   if(typeof ack!=='function')return;
   if(Date.now()-window>60000){window=Date.now();count=0;}
   if(++count>60){ack({error:'RATE_LIMITED'});return;}
   try{
    if(typeof body!=='object'||body===null||!('roomId' in body)||typeof body.roomId!=='string'||body.roomId.length>64)throw new LobbyError('INVALID_INPUT');
    const room=store.view(authenticated(socket.request),body.roomId).room;
    for(const joined of socket.rooms)if(joined!==socket.id)socket.leave(joined);
    socket.join(room.id);ack({room});
   }catch(e){ack({error:e instanceof LobbyError?e.code:'INTERNAL_ERROR'});}
  });
 });
 return {web,http,io,store,async close(){clearInterval(limiter);await new Promise<void>(resolve=>io.close(()=>resolve()));store.close();}};
}
