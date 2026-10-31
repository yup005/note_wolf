const roles=['wolf','wolf','wolf','wolf','villager','villager','villager','villager','seer','witch','hunter','idiot'] as const;
type SyntheticRole=typeof roles[number];
const validSeat=(seat:number)=>Number.isInteger(seat)&&seat>=1&&seat<=12;
/** Fixed public teaching data. No real room, account or identity is accepted. */
export function tutorialRoster(seat:number):{seat:number;role:SyntheticRole}[]{
 if(!validSeat(seat))throw new RangeError('Invalid synthetic seat');const roster:SyntheticRole[]=[...roles];[roster[seat-1],roster[8]]=[roster[8],roster[seat-1]];return roster.map((role,i)=>({seat:i+1,role}));
}
export interface TutorialState {step:number;seat:number|null;revealed:boolean;identityConfirmed:boolean;nightTarget:number|null;inspection:'wolf'|'good'|null;speechEnded:boolean;voteTarget:number|null|undefined;voteCommitted:boolean}
export type TutorialAction={type:'next'|'previous'|'restart'|'reveal'|'confirm-identity'|'inspect'|'end-speech'|'confirm-vote'}|{type:'seat';seat:number}|{type:'night-target';target:number}|{type:'vote-target';target:number|null};
export function createTutorialState():TutorialState{return {step:0,seat:null,revealed:false,identityConfirmed:false,nightTarget:null,inspection:null,speechEnded:false,voteTarget:undefined,voteCommitted:false};}
export function canAdvanceTutorial(s:TutorialState){return s.step===0||s.step===1&&s.seat!==null||s.step===2&&s.identityConfirmed||s.step===3&&s.inspection!==null||s.step===4&&s.speechEnded||s.step===5&&s.voteCommitted;}
export function transitionTutorial(s:TutorialState,a:TutorialAction):TutorialState{
 if(a.type==='restart')return createTutorialState();
 if(a.type==='previous')return s.step>0?{...s,step:s.step-1}:s;
 if(a.type==='next')return canAdvanceTutorial(s)?{...s,step:s.step+1}:s;
 if(a.type==='seat'&&s.step===1&&validSeat(a.seat))return {...createTutorialState(),step:1,seat:a.seat};
 if(s.step===2&&s.seat!==null){if(a.type==='reveal')return {...s,revealed:true};if(a.type==='confirm-identity'&&s.revealed)return {...s,identityConfirmed:true};}
 if(s.step===3&&s.seat!==null&&s.inspection===null){if(a.type==='night-target'&&validSeat(a.target))return {...s,nightTarget:a.target};if(a.type==='inspect'&&s.nightTarget!==null)return {...s,inspection:tutorialRoster(s.seat).find(p=>p.seat===s.nightTarget)!.role==='wolf'?'wolf':'good'};}
 if(s.step===4&&a.type==='end-speech')return {...s,speechEnded:true};
 if(s.step===5&&!s.voteCommitted){if(a.type==='vote-target'&&(a.target===null||validSeat(a.target)))return {...s,voteTarget:a.target};if(a.type==='confirm-vote'&&s.voteTarget!==undefined)return {...s,voteCommitted:true};}
 return s;
}
