import {publicVoiceAudioManifest} from './publicVoiceAudioManifest';
const digits='零一二三四五六七八九';
export function chineseVoiceNumber(value:string):string{
 const [whole,fraction]=value.split('.'),n=Number(whole);
 const integer=n<10?digits[n]:n<100?(n<20?'':digits[Math.floor(n/10)])+'十'+(n%10?digits[n%10]:''):n<1000?digits[Math.floor(n/100)]+'百'+(n%100?(n%100<10?'零':'')+(n%100<20&&n%100>=10?'一':'')+chineseVoiceNumber(String(n%100)):''):[...whole].map(d=>digits[Number(d)]).join('');
 return integer+(fraction?'点'+[...fraction].map(d=>digits[Number(d)]).join(''):'');
}
const normalize=(text:string)=>text.replace(/[\s。，、？！；：,.!?;:]/g,'');
const vocabulary=Object.entries(publicVoiceAudioManifest).map(([word,path])=>[normalize(word.replace(/\d+(?:\.\d+)?/g,chineseVoiceNumber)),path] as const).sort(([a],[b])=>b.length-a.length);
export function recordedVoiceParts(text:string):string[]{
 // Convert each number before removing separators; 1、3 must never become13.
 let rest=normalize(text.replace(/、/g,'和').replace(/\d+(?:\.\d+)?/g,chineseVoiceNumber));const result:string[]=[];
 while(rest){const match=vocabulary.find(([word])=>rest.startsWith(word));if(!match)throw Error('UNSUPPORTED_PUBLIC_PROMPT');result.push('/voice/'+match[1]);rest=rest.slice(match[0].length);}
 return result;
}
export class RecordedPublicVoice {
 private buffers=new Map<string,Promise<AudioBuffer>>();private source:AudioBufferSourceNode|null=null;
 constructor(private context:AudioContext,private load:(path:string)=>Promise<Response>=(path)=>fetch(path,{credentials:'omit'})){}
 cancel(){const source=this.source;this.source=null;if(source){source.onended=null;try{source.stop();}catch{}try{source.disconnect();}catch{}}}
 private buffer(path:string){let cached=this.buffers.get(path);if(!cached){cached=this.load(path).then(async response=>{if(!response.ok)throw Error('VOICE_AUDIO_UNAVAILABLE');const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(!buffer.length)throw Error('VOICE_AUDIO_EMPTY');return buffer;});this.buffers.set(path,cached);cached.catch(()=>this.buffers.delete(path));}return cached;}
 async play(text:string,current:()=>boolean,started:()=>void,ended:()=>void){
  const buffers=await Promise.all(recordedVoiceParts(text).map(path=>this.buffer(path)));if(!current())return;
  if(this.context.state!=='running')throw Error('VOICE_AUDIO_SUSPENDED');
  // Trim only near-silent edges; keep all voiced samples and a small boundary pause.
  const samples=buffers.map(buffer=>{const data=buffer.getChannelData(0);let first=0,last=data.length;while(first<last&&Math.abs(data[first])<0.0001)first++;while(last>first&&Math.abs(data[last-1])<0.0001)last--;if(first===last)throw Error('VOICE_AUDIO_EMPTY');return data.subarray(Math.max(0,first-240),Math.min(data.length,last+240));});
  const combined=this.context.createBuffer(1,samples.reduce((n,s)=>n+s.length,0),this.context.sampleRate),data=combined.getChannelData(0);let offset=0;for(const sample of samples){data.set(sample,offset);offset+=sample.length;}
  this.cancel();const source=this.context.createBufferSource();source.buffer=combined;source.connect(this.context.destination);this.source=source;source.onended=()=>{source.disconnect();if(this.source===source)this.source=null;if(current())ended();};source.start();started();
 }
}
