import {voiceReplyState} from './publicVoiceTiming';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {LobbyView} from '../../../packages/contracts/index';
import type {VoiceCommand,VoiceResponse} from '../../../packages/contracts/voice';
import {voiceFrame} from '../../../packages/domain/voice';
import {canManageGame} from './gameAccess';
import {errorText,requestId} from './api';
interface VoiceUi {available:boolean;active:boolean;nativeSupported:boolean;recorded:boolean;recordingsSupported:boolean;useRecordings:()=>void;useNative:()=>void;enabled:boolean;pending:boolean;supported:boolean;status:string;error:string;lastText:string;enable:()=>void;disable:()=>void;replay:()=>void}
const VoiceContext=createContext<VoiceUi|null>(null);
export function PublicVoiceProvider({view,connected,children}:{view:LobbyView;connected:boolean;children:ReactNode}){
 const nativeSupported=typeof speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance!=='undefined';
 const Context=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;const recordingsSupported=typeof Context!=='undefined',supported=nativeSupported||recordingsSupported;
 const preferred=()=>{try{return recordingsSupported&&(!nativeSupported||localStorage.getItem('wolf.voice.mode')!=='native');}catch{return recordingsSupported;}};
 const [recorded,setRecorded]=useState(preferred);const mode=useRef(recorded);const context=useRef<AudioContext|null>(null),recordings=useRef<import('./recordedPublicVoice').RecordedPublicVoice|null>(null);
 function unlockRecordings(){if(!Context)throw Error('此浏览器不支持音频播放。');context.current??=new Context();const current=context.current;void current.resume().then(()=>{if(alive.current&&current.state==='running')setUnlocked(true);}).catch(()=>{});if(current.state==='running')setUnlocked(true);}
 function selectMode(next:boolean){if(!next&&!nativeSupported)return;stop();mode.current=next;setRecorded(next);try{localStorage.setItem('wolf.voice.mode',next?'recorded':'native');}catch{}setError('');void enable();}

 const defaultOn=()=>{try{return localStorage.getItem('wolf.voice.enabled')!=='off';}catch{return true;}};
 const autoWanted=useRef(defaultOn()),autoAttempted=useRef(false);const [unlocked,setUnlocked]=useState(false);
 const [enabled,setEnabled]=useState(false),[pending,setPending]=useState(false),[status,setStatus]=useState(()=>autoWanted.current?'默认开启，点击页面启用声音':'未开启'),[error,setError]=useState(''),[lastText,setLastText]=useState('');
 const clientId=useRef(requestId());const alive=useRef(true),on=useRef(false),generation=useRef(0),busy=useRef(false),audio=useRef(0),audioScope=useRef(''),expiry=useRef(0),watchdog=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),controller=useRef<AbortController|null>(null);
 const latest=useRef({view,connected});latest.current={view,connected};
 const automatic=view.room.preparation.settings.gameMode==='automatic'&&!view.room.manual;
 const publicFrame=voiceFrame(view.room,Date.now()),active=!!publicFrame.stage;
 const allowed=connected&&canManageGame(view)&&automatic&&active;
 const publicScope=publicFrame.scope;
 function cancel(){audio.current++;if(watchdog.current)clearTimeout(watchdog.current);if(nativeSupported){try{speechSynthesis.cancel();}catch{}}recordings.current?.cancel();audioScope.current='';}
 function release(id=clientId.current){void fetch(`/api/rooms/${view.room.id}/voice`,{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'release',clientId:id})}).catch(()=>{});}
 function stop(note='已关闭'){
  autoAttempted.current=true;generation.current++;on.current=false;busy.current=false;controller.current?.abort();cancel();release();if(alive.current){setEnabled(false);setPending(false);setStatus(note);}
 }
 async function request(action:VoiceCommand['action'],id=clientId.current){
  const started=Date.now(),abort=new AbortController();controller.current=abort;const timeout=setTimeout(()=>abort.abort(),5000);
  try{
   const res=await fetch(`/api/rooms/${view.room.id}/voice`,{method:'POST',signal:abort.signal,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,clientId:id})});
   const data=await res.json();if(!res.ok)throw Error(data.message??'播报连接失败');return {data:data as VoiceResponse,started};
  }catch(e){if(abort.signal.aborted)throw Error('播报连接超时，请重新开启。');throw e;}finally{clearTimeout(timeout);if(controller.current===abort)controller.current=null;}
 }
 function eligible(){const l=latest.current;return alive.current&&l.connected&&canManageGame(l.view)&&l.view.room.preparation.settings.gameMode==='automatic'&&!l.view.room.manual&&!!voiceFrame(l.view.room,Date.now()).stage&&document.visibilityState==='visible';}
 function play(text:string,scope:string){
  cancel();if(!eligible())return;const seq=audio.current;audioScope.current=scope;setLastText(text);
  if(mode.current){
   const current=()=>seq===audio.current&&eligible()&&audioScope.current===scope;
   void import('./recordedPublicVoice').then(async module=>{if(!current()||!context.current)return;recordings.current??=new module.RecordedPublicVoice(context.current);await recordings.current.play(text,current,()=>{if(current())setStatus('正在播报');},()=>{if(current())setStatus(on.current?'已开启':'未开启');});}).catch(()=>{if(current()){stop('播放失败');setError('内置语音未能播放，请重新开启。');}});return;
  }
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utterance.rate=1;
  const voice=speechSynthesis.getVoices().find(v=>/^zh[-_]CN$/i.test(v.lang))??speechSynthesis.getVoices().find(v=>/^zh/i.test(v.lang));if(voice)utterance.voice=voice;
  const fail=()=>{if(seq!==audio.current||!alive.current)return;stop('播放失败');setError('浏览器未能播放语音，请使用内置语音。');};
  utterance.onstart=()=>{if(seq===audio.current&&alive.current){if(watchdog.current)clearTimeout(watchdog.current);setStatus('正在播报');}};
  utterance.onend=()=>{if(seq===audio.current&&alive.current){if(watchdog.current)clearTimeout(watchdog.current);setStatus(on.current?'已开启':'未开启');}};
  utterance.onerror=e=>{if(e.error!=='interrupted'&&e.error!=='canceled')fail();};
  watchdog.current=setTimeout(fail,5000);try{speechSynthesis.speak(utterance);}catch{fail();}
 }
 function accept(data:VoiceResponse,started:number){
  expiry.current=started+data.leaseUntil-data.serverNow;
  const current=latest.current.view.room;const validity=voiceReplyState(data,started,Date.now(),voiceFrame(current,Date.now()).scope,current.revision);
  if(validity==='expired'){stop('播报连接已过期');return;}
  if(validity==='stale')return;
  if(audioScope.current&&audioScope.current!==data.scope)cancel();
  if(data.cues.length)play(data.cues.map(c=>c.text).join(' '),data.scope);
 }
 async function enable(automaticAttempt=false){
  if(automaticAttempt&&!autoWanted.current)return;
  if(!supported||!eligible()||busy.current||on.current)return;
  autoAttempted.current=true;if(!automaticAttempt){autoWanted.current=true;try{localStorage.setItem('wolf.voice.enabled','on');}catch{}}
  const seq=++generation.current,id=requestId();clientId.current=id;setPending(true);setError('');
  // The synchronous gesture starts the device speech service; it contains no game facts.
  busy.current=true;
  if(mode.current){try{unlockRecordings();}catch{busy.current=false;setPending(false);setError('此浏览器不支持音频播放。');return;}}
  play('公共播报。',publicScope);
  if(seq!==generation.current)return;
  try{const {data,started}=await request('claim',id);if(seq!==generation.current||!eligible()){release(id);return;}on.current=true;setEnabled(true);setStatus('已开启');accept(data,started);}
  catch(e){release(id);if(seq===generation.current&&alive.current){cancel();setError(errorText(e));setStatus('未开启');}}
  finally{if(seq===generation.current){busy.current=false;if(alive.current)setPending(false);}}
 }
 async function poll(action:'poll'|'replay'='poll'){
  if(!on.current||!eligible()||busy.current)return;busy.current=true;const seq=generation.current;
  try{const {data,started}=await request(action);if(seq===generation.current&&on.current&&eligible()){setError('');accept(data,started);}}
  catch(e){if(seq===generation.current&&alive.current){stop('连接已停止');setError(errorText(e));}}
  finally{if(seq===generation.current)busy.current=false;}
 }
 useEffect(()=>{
  alive.current=true;
  const hide=()=>{if(document.visibilityState!=='visible')stop('已停止，请保持播报页面在前台');};const pageHide=()=>stop('已停止');
  document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',pageHide);
  return()=>{alive.current=false;document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',pageHide);stop();void context.current?.close();context.current=null;recordings.current=null;};
 },[]);
 useEffect(()=>{if(!allowed){if(on.current||busy.current)stop(!active?'白天不播报':automatic?'连接或管理权限已变化':'已切换纯手动');autoAttempted.current=false;}},[allowed,automatic,active]);
 // Prime the reusable device audio context during existing room interactions.
 // No game audio or lease is started until the current manager enters an eligible night.
 useEffect(()=>{
  const prime=()=>{const l=latest.current;if(!autoWanted.current||!canManageGame(l.view)||l.view.room.preparation.settings.gameMode!=='automatic'||l.view.room.manual||document.visibilityState!=='visible')return;try{if(mode.current)unlockRecordings();else setUnlocked(true);}catch{};};
  const gesture=(event:Event)=>{if(!event.isTrusted||(event instanceof KeyboardEvent&&(event.repeat||event.key!=='Enter'&&event.key!==' '))||(event.target instanceof Element&&event.target.closest('.voice-controls,.voice-shortcut')))return;prime();if(autoWanted.current&&eligible()&&!autoAttempted.current&&(!mode.current||context.current?.state==='running'))void enable(true);};
  if(mode.current)prime();document.addEventListener('pointerdown',gesture,true);document.addEventListener('click',gesture,true);document.addEventListener('keydown',gesture,true);
  return()=>{document.removeEventListener('pointerdown',gesture,true);document.removeEventListener('click',gesture,true);document.removeEventListener('keydown',gesture,true);};
 },[]);
 useEffect(()=>{if(allowed&&unlocked&&autoWanted.current&&!autoAttempted.current&&eligible())void enable(true);},[allowed,unlocked,enabled]);
 function disable(){autoWanted.current=false;try{localStorage.setItem('wolf.voice.enabled','off');}catch{}stop();}
 useEffect(()=>{if(audioScope.current&&audioScope.current!==publicScope)cancel();if(enabled)void poll();},[publicScope,enabled]);
 useEffect(()=>{
  if(!enabled)return;const pollTimer=setInterval(()=>void poll(),2000);
  const expiryTimer=setInterval(()=>{if(on.current&&Date.now()>=expiry.current)stop('播报连接已过期');},250);
  return()=>{clearInterval(pollTimer);clearInterval(expiryTimer);};
 },[enabled]);
 const value:VoiceUi={available:allowed,active,nativeSupported,recorded,recordingsSupported,useRecordings:()=>selectMode(true),useNative:()=>selectMode(false),enabled,pending,supported,status,error,lastText,enable:()=>void enable(),disable,replay:()=>void poll('replay')};
 return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
export function PublicVoiceControls(){
 const voice=useContext(VoiceContext);if(!voice||!voice.active)return null;
 return <section className="control-settings voice-controls" aria-label="公共语音播报"><h3>公共语音</h3><p role="status">{voice.supported?voice.status:'此浏览器不支持语音，请按页面提示主持。'}</p>{voice.error&&<p role="alert" className="night-error">{voice.error}</p>}<button className="secondary full" disabled={!voice.available||!voice.supported||voice.pending} onClick={voice.enabled?voice.disable:voice.enable}>{voice.pending?'正在开启…':voice.enabled?'关闭公共播报':'开启公共播报'}</button>{voice.enabled&&<button className="text-button full" disabled={!voice.available||voice.pending} onClick={voice.replay}>重播当前提示</button>}{voice.recordingsSupported&&<button className="text-button full" disabled={!voice.available||voice.pending||voice.recorded&&!voice.nativeSupported} onClick={voice.recorded?voice.useNative:voice.useRecordings}>{voice.recorded?'使用浏览器语音':'使用内置语音'}</button>}{voice.lastText&&<p className="voice-caption">{voice.lastText}</p>}<p className="helper">由本设备播报，请保持页面在前台。</p></section>;
}

// The same device lease and gesture-based enable flow are used in both places.
export function PublicVoiceShortcut(){
 const voice=useContext(VoiceContext);if(!voice||!voice.active)return null;
 return <button className="text-button voice-shortcut" title={voice.error||voice.status} disabled={!voice.available||!voice.supported||voice.pending} onClick={voice.enabled?voice.disable:voice.error&&!voice.recorded&&voice.recordingsSupported?voice.useRecordings:voice.enable}>{!voice.supported?'语音不支持':voice.pending?'开启中…':voice.enabled?'关闭播报':voice.error&&!voice.recorded&&voice.recordingsSupported?'内置播报':'开启播报'}</button>;
}
