import type {RecoveryPayload} from './sessionTypes';
export type RecoveryState={phase:'checking'|'hidden'|'offline'|'failed';epoch:number;message?:string}|{phase:'ready';epoch:number;payload:RecoveryPayload};
export interface RecoveryController {getSnapshot:()=>RecoveryState;subscribe:(listener:()=>void)=>()=>void;hide:(reason:'hidden'|'offline')=>void;resume:()=>Promise<void>;retry:()=>Promise<void>;dispose:()=>void}
export function createRecovery(load:(signal:AbortSignal)=>Promise<RecoveryPayload>,conceal:()=>void):RecoveryController{
 let epoch=0,disposed=false,state:RecoveryState={phase:'checking',epoch};
 const listeners=new Set<()=>void>();
 type Pending={epoch:number;abort:AbortController;timer:ReturnType<typeof setTimeout>;done:()=>void;promise:Promise<void>};
 let pending:Pending|undefined;
 function emit(next:RecoveryState){state=next;for(const listener of listeners)listener();}
 function cancel(){const old=pending;pending=undefined;if(old){clearTimeout(old.timer);old.abort.abort();old.done();}}
 function hide(reason:'hidden'|'offline'){if(disposed)return;conceal();epoch++;cancel();emit({phase:reason,epoch});}
 function start(){
  if(disposed)return Promise.resolve();if(pending)return pending.promise;
  conceal();const current=++epoch;emit({phase:'checking',epoch:current});
  let done!:()=>void;const promise=new Promise<void>(resolve=>done=resolve),abort=new AbortController();
  const task:Pending={epoch:current,abort,promise,done,timer:setTimeout(()=>{abort.abort();finish({phase:'failed',epoch:current,message:'读取超时，请重试'});},6000)};
  pending=task;
  function finish(next:RecoveryState){if(disposed||pending!==task||epoch!==current)return;clearTimeout(task.timer);pending=undefined;emit(next);task.done();}
  try{void load(abort.signal).then(payload=>finish({phase:'ready',epoch:current,payload}),()=>finish({phase:'failed',epoch:current,message:'暂时无法连接，请检查网络后重试'}));}
  catch{finish({phase:'failed',epoch:current,message:'暂时无法连接，请检查网络后重试'});}
  return promise;
 }
 return {getSnapshot:()=>state,subscribe(listener){listeners.add(listener);return()=>{listeners.delete(listener);};},hide,resume:start,retry(){if(disposed)return Promise.resolve();conceal();epoch++;cancel();return start();},dispose(){if(disposed)return;conceal();epoch++;cancel();emit({phase:'hidden',epoch});disposed=true;listeners.clear();}};
}
