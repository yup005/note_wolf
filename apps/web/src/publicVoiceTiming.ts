import type {VoiceResponse} from '../../../packages/contracts/voice';
export function voiceReplyState(response:Pick<VoiceResponse,'leaseUntil'|'serverNow'|'revision'|'scope'>,started:number,now:number,scope:string,revision:number):'expired'|'stale'|'current'{
 if(now>=started+response.leaseUntil-response.serverNow)return 'expired';
 // Ballot/signup/member changes can advance revision while the spoken stage remains unchanged.
 if(response.scope!==scope&&response.revision<=revision)return 'stale';
 return 'current';
}
