import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const origin='https://synthetic.example';
async function worker(bad?:'status'|'html'|'redirect'|'no-store'|'write'){
 assert.ok(existsSync('apps/web/pwaWorker.ts'),'Generated static Worker policy is required');
 const {renderWorker}=await import('../apps/web/pwaWorker.js');
 const events=new Map<string,(event:any)=>void>(),stores=new Map<string,Map<string,Response>>([['note-wolf-static-old',new Map()],['other-application',new Map()]]),calls:{url:string;init?:RequestInit}[]=[];
 const caches={async open(name:string){let data=stores.get(name);if(!data){data=new Map();stores.set(name,data);}return {async put(url:string,response:Response){if(bad==='write')throw Error('quota');data!.set(new URL(url,origin).href,response);},async match(url:string|Request){return data!.get(new URL(typeof url==='string'?url:url.url,origin).href)?.clone();}};},async keys(){return [...stores.keys()];},async delete(name:string){return stores.delete(name);}};
 let offline=false;
 const fetcher=async(input:string|Request,init?:RequestInit)=>{const url=new URL(typeof input==='string'?input:input.url,origin).href;calls.push({url,init});if(offline)throw TypeError('offline');const js=url.endsWith('.js'),res=new Response(js?'/* public bundle */':'offline public page',{status:bad==='status'&&js?500:200,headers:{'Content-Type':js?(bad==='html'?'text/html':'application/javascript'):'text/html',...(bad==='no-store'&&js?{'Cache-Control':'no-store'}:{})}});if(bad==='redirect'&&js)Object.defineProperty(res,'redirected',{value:true});return res;};
 runInNewContext(renderWorker({version:'new',cacheName:'note-wolf-static-new',assets:[{url:'/offline.html',mime:'html',sha256:'a'},{url:'/assets/app-12345678.js',mime:'javascript',sha256:'b'}]}),{self:{location:{origin},addEventListener:(name:string,fn:(event:any)=>void)=>events.set(name,fn)},caches,fetch:fetcher,URL,Request,Response,Promise,Set,Error});
 async function life(name:string){let result:Promise<unknown>|undefined;events.get(name)!({waitUntil:(p:Promise<unknown>)=>result=p});await result;}
 async function request(path:string,options:{method?:string;mode?:string}={}){let result:Promise<Response>|undefined;const request=new Request(new URL(path,origin),{method:options.method??'GET'});if(options.mode)Object.defineProperty(request,'mode',{value:options.mode});events.get('fetch')!({request,respondWith:(p:Promise<Response>)=>result=p});return result?await result:undefined;}
 return {stores,calls,life,request,offline:()=>{offline=true;}};
}
test('worker_never_caches_dynamic_requests',async()=>{
 const w=await worker();await w.life('install');const initial=[...w.stores.get('note-wolf-static-new')!.keys()].sort();assert.deepEqual(initial,[origin+'/assets/app-12345678.js',origin+'/offline.html']);assert.ok(w.calls.every(c=>c.init?.credentials==='omit'));
 for(const path of ['/api/session','/api/rooms/x/identity','/api/avatars/x','/socket.io/?transport=polling','/assets/app-12345678.js?account=1','https://other.example/a.js','/voice/private.mp3'])assert.equal(await w.request(path),undefined);
 assert.equal(await w.request('/api/record',{method:'POST'}),undefined);assert.equal(await (await w.request('/assets/app-12345678.js'))!.text(),'/* public bundle */');
 await w.request('/share/synthetic-token',{mode:'navigate'});assert.equal(w.calls.at(-1)?.init?.cache,'no-store');assert.deepEqual([...w.stores.get('note-wolf-static-new')!.keys()].sort(),initial);
 w.offline();assert.equal(await (await w.request('/share/another-token',{mode:'navigate'}))!.text(),'offline public page');assert.equal(await w.request('/api/session'),undefined);
 w.stores.get('note-wolf-static-new')!.delete(origin+'/assets/app-12345678.js');await assert.rejects(w.request('/assets/app-12345678.js'));
 w.stores.get('note-wolf-static-new')!.delete(origin+'/offline.html');await assert.rejects(w.request('/',{mode:'navigate'}));
});
test('failed_install_keeps_current_version',async()=>{
 for(const failure of ['status','html','redirect','no-store','write'] as const){const w=await worker(failure);await assert.rejects(w.life('install'));assert.ok(w.stores.has('note-wolf-static-old'));assert.ok(w.stores.has('other-application'));assert.ok(!w.stores.has('note-wolf-static-new'));}
});
test('activate_deletes_only_owned_old_caches',async()=>{const w=await worker();await w.life('install');assert.ok(w.stores.has('note-wolf-static-old'));await w.life('activate');assert.deepEqual([...w.stores.keys()].sort(),['note-wolf-static-new','other-application']);});
