/** The sole owner-authorized production exception; do not infer it from a flag alone. */
const renderTrialServiceId='srv-db5gd37lot8c73esepqg';
export function testPlayersAllowed(enabled:boolean|undefined,scope:string|undefined,env:NodeJS.ProcessEnv){
 if(enabled!==true)return false;
 if(env.NODE_ENV!=='production')return true;
 return scope==='render-trial'&&env.RENDER==='true'&&env.RENDER_SERVICE_ID===renderTrialServiceId;
}
