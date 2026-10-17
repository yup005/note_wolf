import {randomUUID} from 'node:crypto';

export type DiagnosticOperation='http'|'health'|'startup'|'socket-auth'|'socket-subscribe'|'socket-disconnect'|'night-tick'|'retention';
export type DiagnosticPhase='preparation'|'night'|'day'|'manual'|'ended';
export interface DiagnosticContext {requestId?:string;gameId?:string;phase?:DiagnosticPhase}
export type DiagnosticWrite=(line:string)=>void;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const sqliteCodes=new Set(['SQLITE_ERROR','SQLITE_BUSY','SQLITE_LOCKED','SQLITE_READONLY','SQLITE_IOERR','SQLITE_CORRUPT','SQLITE_FULL','SQLITE_CANTOPEN','SQLITE_NOTADB','SQLITE_CONSTRAINT','SQLITE_MISUSE']);
function category(error:unknown){
 // Never stringify an exception or read arbitrary getters: SQL errors can include private values.
 const value=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;
 if(typeof value==='string'){const base=value.split('_').slice(0,2).join('_');if(sqliteCodes.has(base))return base;}
 return 'INTERNAL_ERROR';
}
export function createDiagnostics(write:DiagnosticWrite=line=>process.stderr.write(line+'\n'),now:()=>number=Date.now){
 const failures=new Map<DiagnosticOperation,{at:number;id:string;suppressed:number}>();
 function emit(data:Record<string,unknown>){try{write(JSON.stringify({time:new Date(now()).toISOString(),...data}));}catch{/* Diagnostic output must never break request/game handling. */}}
 function fault(operation:DiagnosticOperation,error:unknown,context:DiagnosticContext={},bounded=false){
  const requestId=context.requestId&&uuid.test(context.requestId)?context.requestId:randomUUID(),previous=failures.get(operation);
  if(bounded&&previous&&now()-previous.at<30000){previous.suppressed++;return previous.id;}
  const gameId=context.gameId&&uuid.test(context.gameId)?context.gameId:undefined;
  const phase=gameId&&['preparation','night','day','manual','ended'].includes(context.phase??'')?context.phase:undefined;
  emit({event:'fault',operation,code:category(error),requestId,...(gameId?{gameId}:{}),...(phase?{phase}:{}),...(bounded&&previous?{suppressed:previous.suppressed,faultId:previous.id}:{})});
  if(bounded)failures.set(operation,{at:now(),id:previous?.id??requestId,suppressed:0});
  return requestId;
 }
 function recovered(operation:DiagnosticOperation){const previous=failures.get(operation);if(previous){emit({event:'recovered',operation,requestId:randomUUID(),faultId:previous.id,suppressed:previous.suppressed});failures.delete(operation);}}
 function guard(operation:DiagnosticOperation,run:()=>void){try{run();recovered(operation);}catch(error){fault(operation,error,{},true);}}
 return {fault,recovered,guard};
}
