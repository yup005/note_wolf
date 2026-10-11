import type {GameEvent,GameReplay} from '../contracts/game.js';
import type {DayVoteResult} from '../contracts/day.js';
export interface ReplaySection {title:string;lines:string[]}
const seats=(values:number[])=>values.join('、')+' 号';
const voteName={sheriff:'警长',sheriff_pk:'警长 PK',exile:'放逐',exile_pk:'放逐 PK'};
function describeVote(result:DayVoteResult){
 const groups=new Map<number|null,number[]>();for(const ballot of result.ballots??[])groups.set(ballot.target,[...(groups.get(ballot.target)??[]),ballot.seat]);
 const ballots=[...groups].map(([target,voters])=>`${seats(voters)}${target===null?'弃票':`投 ${target} 号`}`).join('；');
 const totals=result.counts.filter(c=>c.votes>0).map(c=>`${c.seat} 号 ${c.votes} 票`).join('，')||'全员弃票';return `${voteName[result.purpose]}投票：${ballots?ballots+'。':''}${totals}`;
}
function legacyVotes(events:GameEvent[],last:DayVoteResult|null|undefined):string[]{
 type Group={purpose:DayVoteResult['purpose'];individual:boolean;ballots:Map<number,number|null>;result?:DayVoteResult;recorded?:boolean};
 const groups:Group[]=[];let purpose:DayVoteResult['purpose']='sheriff';let active:Group|undefined;
 for(const e of events){
  if(e.type==='sheriff_signup')purpose='sheriff';if(e.type==='sheriff_speech')purpose=groups.some(g=>g.purpose.startsWith('sheriff'))?'sheriff_pk':'sheriff';
  if(['day_direction','free_speech'].includes(e.type))purpose='exile';if(e.type==='day_speech')purpose=groups.some(g=>g.purpose.startsWith('exile'))?'exile_pk':'exile';
  if(e.type==='vote_outcome'&&active)active.recorded=true;
  const c=e.command;if(e.type!=='command'||!c)continue;
  if(c.action==='start_vote'){active={purpose,individual:c.visibility==='individual',ballots:new Map()};groups.push(active);}
  if(active&&(c.action==='vote'||c.action==='offline_vote')){const voter=c.action==='offline_vote'?Number(c.voter):e.seat!;active.ballots.set(voter,typeof c.target==='number'?c.target:null);}
  if(active&&c.action==='offline_results'&&Array.isArray(c.counts)){active.individual=false;active.result={purpose:active.purpose,counts:c.counts as DayVoteResult['counts'],leaders:[]};}
 }
 if(last&&groups.length){groups.at(-1)!.result=last;groups.at(-1)!.purpose=last.purpose;}
 if(!groups.length)return last&&!events.some(e=>e.type==='vote_outcome')?[describeVote(last)]:[];
 return groups.flatMap(g=>{if(g.recorded)return [];if(g.result)return [describeVote({...g.result,...(g.individual?{ballots:g.result.ballots??[...g.ballots].map(([seat,target])=>({seat,target}))}:{ballots:undefined})})];if(!g.individual||!g.ballots.size)return [];const grouped=new Map<number|null,number[]>();for(const [seat,target] of g.ballots)grouped.set(target,[...(grouped.get(target)??[]),seat]);return [`${voteName[g.purpose]}投票：${[...grouped].map(([target,voters])=>`${seats(voters)}${target===null?'弃票':`投 ${target} 号`}`).join('；')}`];});
}
export function summarizeReplay(record:GameReplay):ReplaySection[]{
 const roles=new Map(record.roles.map(p=>[p.seat,p.role]));let hunterSpent=false;let sheriff:number|null=null;const applicants=new Set<number>();
 const sections=record.rounds.map(round=>{
  const lines:string[]=[];const e=round.events;
  if(round.kind==='night'){
   const knife=e.findLast(x=>x.type==='knife_resolved');const priority=e.find(x=>x.type==='priority_knife');if(knife)lines.push(knife.target==null?'狼人空刀':`狼刀 ${knife.target} 号${priority?`（${priority.seat} 号自爆狼指刀）`:''}`);
   for(const action of e){if(action.type==='witch_save')lines.push(`女巫救 ${action.target} 号`);if(action.type==='witch_poison')lines.push(`女巫毒 ${action.target} 号`);if(action.type==='witch_skip')lines.push('女巫未用药');if(action.type==='seer_check')lines.push(`预言家验 ${action.target} 号：${roles.get(action.target!)==='wolf'?'狼人':'好人'}`);if(action.type==='hunter_seen')lines.push(`猎人查看状态：技能${hunterSpent||e.some(x=>x.type==='witch_poison'&&x.target===action.seat)?'不可':'可'}发动`);}
  }else{
   for(const action of e){if(action.type==='command'&&action.command?.action==='signup'){if(action.command.join===true)applicants.add(action.seat!);else applicants.delete(action.seat!);}if(action.type==='command'&&action.command?.action==='withdraw'||action.type==='death_explosion')applicants.delete(action.seat!);if(action.type==='vote_outcome'&&action.result?.purpose.startsWith('sheriff')){applicants.clear();for(const seat of action.result.leaders)applicants.add(seat);}}
   if(e.some(x=>x.type.startsWith('sheriff_')||x.command?.action==='signup'||x.command?.action==='withdraw')&&applicants.size)lines.push(`留警：${seats([...applicants].sort((a,b)=>a-b))}`);
   lines.push(...legacyVotes(e,round.outcome?.result));
   const shotTargets=new Set(e.filter(x=>x.type==='hunter_shot').map(x=>x.target));
   for(const action of e){
    if(action.type==='vote_outcome'&&action.result)lines.push(describeVote(action.result));
    if(action.type==='sheriff_elected'){sheriff=action.seat!;lines.push(`${sheriff} 号当选警长`);}
    if(action.type.startsWith('death_')){
     const who=`${action.seat} 号`;const reason=action.type.slice(6);if(reason==='shot'&&shotTargets.has(action.seat))continue;
     const description:Record<string,string>={knife:'被狼刀杀死',poison:'被毒死',shot:'被猎人开枪带走',exile:roles.get(action.seat!)==='idiot'?'被放逐，白痴翻牌死亡':'被放逐',explosion:'狼人自爆'};
     if(description[reason])lines.push(`${who}${description[reason]}${roles.get(action.seat!)==='hunter'&&(reason==='poison'||hunterSpent)?'（技能不可发动）':''}`);
    }
    if(action.type==='hunter_shot'){lines.push(`${action.seat} 号猎人开枪，带走 ${action.target} 号`);hunterSpent=true;}
    if(action.type==='command'&&action.command?.action==='transfer_badge'){const target=action.command.target;sheriff=typeof target==='number'?target:null;lines.push(sheriff===null?`${action.seat} 号撕掉警徽`:`${action.seat} 号将警徽移交给 ${sheriff} 号`);}
   }
   if(round.outcome?.badge==='elected'&&round.outcome.sheriff!==null&&round.outcome.sheriff!==sheriff){sheriff=round.outcome.sheriff;lines.push(`${sheriff} 号当选警长`);}
   if(round.outcome?.badge==='lost'&&e.some(x=>x.type==='sheriff_signup'||x.type==='sheriff_withdraw'))lines.push('本轮无警长，警徽流失');
   if(round.outcome?.badge==='deferred')lines.push('警长竞选顺延至次日');
   for(const action of e)if(action.type.startsWith('death_'))applicants.delete(action.seat!);
   if(round.outcome?.badge==='elected'||round.outcome?.badge==='lost')applicants.clear();
  }
  return {title:`第 ${round.round} ${round.kind==='night'?'晚':'天'}`,lines:[...new Set(lines)]};
 }).filter(s=>s.lines.length>0);
 // Keep each night and its following day together. Fold announced deaths into
 // the corresponding night operation, while retaining causes absent from old records.
 const combined:ReplaySection[]=[];
 for(const section of sections){
  const day=/^第 (\d+) 天$/.exec(section.title);const previous=combined.at(-1);
  if(day&&previous?.title===`第 ${day[1]} 晚`){
   const daytime=section.lines.filter(line=>{const death=/^(\d+) 号被(狼刀杀死|毒死)(.*)$/.exec(line);if(!death)return true;const prefix=death[2]==='毒死'?`女巫毒 ${death[1]} 号`:`狼刀 ${death[1]} 号`;const index=previous.lines.findIndex(l=>l===prefix||l.startsWith(prefix+'（'));if(index<0)return true;previous.lines[index]+=`（死亡${death[3].includes('技能不可发动')?'，技能不可发动':''}）`;return false;});
   previous.title+=` / 第 ${day[1]} 天`;previous.lines.push(...daytime);
  }else combined.push(section);
 }
 return combined;
}
