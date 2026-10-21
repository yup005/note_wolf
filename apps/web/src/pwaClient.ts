let waiting=false;
const listeners=new Set<()=>void>();
export const hasWaitingUpdate=()=>waiting;
export function subscribePwaUpdate(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function found(){if(waiting)return;waiting=true;for(const listener of listeners)listener();}
/** Registration has no access to session or game data and never reloads. */
export async function registerPwa():Promise<()=>void>{
 if(!globalThis.isSecureContext||typeof navigator==='undefined'||!navigator.serviceWorker)return()=>{};
 try{
  const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  const watched=new Set<ServiceWorker>();
  const inspect=()=>{if(registration.waiting&&registration.active)found();};
  const watch=()=>{const worker=registration.installing;if(worker&&!watched.has(worker)){watched.add(worker);worker.addEventListener('statechange',inspect);}inspect();};
  registration.addEventListener('updatefound',watch);watch();
  return()=>{registration.removeEventListener('updatefound',watch);for(const worker of watched)worker.removeEventListener('statechange',inspect);};
 }catch{return()=>{};}
}
