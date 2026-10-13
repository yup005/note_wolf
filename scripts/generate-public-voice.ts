// Offline maintenance only: node --import tsx scripts/generate-public-voice.ts
// macOS system Tingting plus ffmpeg; never called at playback/build time.
import ts from 'typescript';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {publicVoiceAudioManifest} from '../apps/web/src/publicVoiceAudioManifest.js';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const source=ts.createSourceFile('voice.ts',readFileSync(root+'/packages/domain/voice.ts','utf8'),ts.ScriptTarget.Latest,true);
const normalize=(s:string)=>s.replace(/[\s。，、？！；：,.!?;:]/g,'');
const vocabulary=new Map<string,string>();
// Retain committed public vocabulary for older clients and historical prompts.
for(const word of Object.keys(publicVoiceAudioManifest))vocabulary.set(word,word);
function visit(node:ts.Node){if(ts.isStringLiteral(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node)||ts.isNoSubstitutionTemplateLiteral(node)){const text=node.text;if(/[\u4e00-\u9fff]/.test(text)){const key=normalize(text);if(key)vocabulary.set(key,text);}}ts.forEachChild(node,visit);}visit(source);visit(ts.createSourceFile('store.ts',readFileSync(root+'/packages/storage/voice.ts','utf8'),ts.ScriptTarget.Latest,true));
for(const text of ['公共播报。','零','一','二','三','四','五','六','七','八','九','十','百','点','和'])vocabulary.set(normalize(text),text);
const temporary=mkdtempSync('/private/tmp/wolf-voice-'),manifest:Record<string,string>={};
try{for(const [key,text] of [...vocabulary].sort(([a],[b])=>a.localeCompare(b))){const id=createHash('sha256').update(key).digest('hex').slice(0,16),wav=temporary+'/'+id+'.aiff';if(existsSync(root+'/apps/web/public/voice/'+id+'.mp3')&&statSync(root+'/apps/web/public/voice/'+id+'.mp3').size>1000){manifest[key]=id+'.mp3';continue;}execFileSync('/usr/bin/say',['-v','Tingting','-r','190','-o',wav,'--',text]);execFileSync('ffmpeg',['-loglevel','error','-y','-i',wav,'-ac','1','-ar','24000','-c:a','libmp3lame','-b:a','48k',root+'/apps/web/public/voice/'+id+'.mp3']);manifest[key]=id+'.mp3';}for(const file of Object.values(manifest)){const decoded=execFileSync('ffmpeg',['-v','error','-i',root+'/apps/web/public/voice/'+file,'-f','f32le','-ac','1','-ar','16000','-']);let audible=false;for(let i=0;i+4<=decoded.length;i+=4)if(Math.abs(decoded.readFloatLE(i))>0.001){audible=true;break;}if(!audible)throw Error('Empty audio clip: '+file);}writeFileSync(root+'/apps/web/src/publicVoiceAudioManifest.ts','// Offline public templates only; generated with macOS Tingting, MP3 mono24kHz48kbps.\nexport const publicVoiceAudioManifest='+JSON.stringify(manifest,null,1)+' as const;\n');console.log('Generated public clips:',vocabulary.size);}finally{rmSync(temporary,{recursive:true});}
