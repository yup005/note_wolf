import type {GameEvent,GameReplay} from '../contracts/game.js';
import type {DayVoteResult} from '../contracts/day.js';
import {boardRoleLabels} from '../contracts/board.js';
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
  if((e.type==='vote_outcome'||e.type==='vote_cancelled')&&active)active.recorded=true;
  const c=e.command;if(e.type!=='command'||!c)continue;
  if(c.action==='start_vote'){active={purpose,individual:c.visibility==='individual',ballots:new Map()};groups.push(active);}
  if(active&&(c.action==='vote'||c.action==='offline_vote')){const voter=c.action==='offline_vote'?Number(c.voter):e.seat!;active.ballots.set(voter,typeof c.target==='number'?c.target:null);}
  if(active&&c.action==='offline_results'&&Array.isArray(c.counts)){active.individual=false;active.result={purpose:active.purpose,counts:c.counts as DayVoteResult['counts'],leaders:[]};}
 }
 if(last&&groups.length){groups.at(-1)!.result=last;groups.at(-1)!.purpose=last.purpose;}
 if(!groups.length)return last&&!events.some(e=>e.type==='vote_outcome')?[describeVote(last)]:[];
 return groups.flatMap(g=>{if(g.recorded)return [];if(g.result)return [describeVote({...g.result,...(g.individual?{ballots:g.result.ballots??[...g.ballots].map(([seat,target])=>({seat,target}))}:{ballots:undefined})})];if(!g.individual||!g.ballots.size)return [];const grouped=new Map<number|null,number[]>();for(const [seat,target] of g.ballots)grouped.set(target,[...(grouped.get(target)??[]),seat]);return [`${voteName[g.purpose]}投票：${[...grouped].map(([target,voters])=>`${seats(voters)}${target===null?'弃票':`投 ${target} 号`}`).join('；')}`];});
}
export function effectiveGameEvents(events:GameEvent[]){const cancelled=new Set<number>();for(let i=0;i<events.length;i++)if(events[i].type==='vote_cancelled'){for(let j=i-1;j>=0;j--)if(events[j].type==='vote_outcome'&&!cancelled.has(j)&&events[j].result?.purpose.startsWith('exile')&&JSON.stringify(events[j].result)===JSON.stringify(events[i].result)){cancelled.add(j);break;}}return events.filter((_,i)=>!cancelled.has(i));}
export function summarizeReplay(record:GameReplay):ReplaySection[]{
 if(record.summary)return record.summary.map(section=>({title:section.title,lines:[...section.lines]}));
 const roles=new Map(record.roles.map(p=>[p.seat,p.role]));const hunterSpent=new Set<number>();let sheriff:number|null=null;const applicants=new Set<number>();
 const sections=record.rounds.map(round=>{
  const lines:string[]=[];const e=effectiveGameEvents(round.events);
  if(round.kind==='night'){
   const m=round.engine?.masquerade;if(m){if(m.pool.length)lines.push(`共舞：${seats(m.pool)}`);for(const h of m.inspected.filter(h=>h.night===round.round))lines.push(`假面查验 ${h.target} 号：${m.pool.includes(h.target)?'入池':'未入池'}（${h.source==='random'?'系统随机':h.source==='draft'?'截止草稿':'本人确认'}）`);for(const h of m.masked.filter(h=>h.night===round.round))lines.push(`假面给 ${h.target} 号戴面具（仅影响当夜舞池计数）`);for(const p of m.penalties)lines.push(`${p.seat} 号违规点杀（${p.reason}）`);}

   if(round.treasure){const t=round.treasure;const actor=record.roles.find(p=>p.role==='treasureMaster');if(round.round===1)lines.push(`盗宝底牌：${t.deal.bottoms.map(r=>boardRoleLabels[r]).join('、')}；${t.deal.camp==='good'?'好人盗宝（计神）':'狼人盗宝'}`);if(t.selected)lines.push(`${actor?.seat} 号盗宝选用${boardRoleLabels[t.selected]}`);for(const d of t.dreams)lines.push(`${d.caster} 号摄梦 ${d.target} 号${d.repeat?'（梦死）':''}`);}
   const knife=e.findLast(x=>x.type==='knife_resolved');const priority=e.find(x=>x.type==='priority_knife');if(knife)lines.push(knife.target==null?'狼人空刀':`狼刀 ${knife.target} 号${priority?`（${priority.seat} 号自爆狼指刀）`:''}`);
   for(const action of e){
    if(action.type==='girl_confession')lines.push(`${action.seat} 号狼女孩表白 ${action.target} 号${roles.get(action.target!)==='villager'?'，平民成为狼混，个人胜负随狼方':'，神职拒绝'}`);
    if(action.type==='wolves_recognized')lines.push('首夜狼队仅相认，无狼刀');
    if(action.type==='poisoner_poison')lines.push(action.target==null?'毒师未用毒':`毒师毒 ${action.target} 号`);
    if(action.type==='treasure_mask_exemption')lines.push(`${action.seat} 号盗宝蒙面免放逐`);
    if(action.type==='masked_death_announced')lines.push(`${action.seat} 号蒙面人发言结束，宣布死亡`);
    if(action.type==='witch_save')lines.push(`女巫救 ${action.target} 号`);
    if(action.type==='witch_poison')lines.push(`女巫毒 ${action.target} 号`);
    if(action.type==='witch_skip')lines.push('女巫未用药');
    if(action.type==='seer_check'){
     const inspection=round.engine?.actions.find(a=>a.casterId===action.seat&&a.targetId===action.target&&a.abilityType==='inspect')?.privateInspection;
     const camp=inspection?.status==='camp'?inspection.camp:roles.get(action.target!)==='wolf'?'wolves':'good';
     lines.push(action.target===null?'预言家空验':`预言家验 ${action.target} 号：${camp==='wolves'?'狼人':'好人'}`);
    }
    if(action.type==='hunter_seen'){
     const seat=action.seat??record.roles.find(p=>p.role==='hunter')?.seat??-1;
     const resolution=round.engine?.resolution;
     const poisoned=resolution?.status==='settled'?resolution.effects.some(effect=>effect.abilityType==='poison'&&effect.outcome==='killed'&&(effect.reflectTarget??effect.targetId)===seat):e.some(x=>x.type==='witch_poison'&&x.target===seat);
     const spent=hunterSpent.has(seat)||round.engine?.players.find(p=>p.seat===seat)?.abilities.skills.find(skill=>skill.kind==='shot')?.remaining===0;
     lines.push(`猎人查看状态：技能${spent||poisoned?'不可':'可'}发动`);
    }
   }
   for(const action of e){
    const actor=roles.get(action.seat!);const actorName=actor?boardRoleLabels[actor]:'玩家';
    if(action.type==='mechanical_learn'||action.type==='armor_learn'){
     const learned=round.engine?.players.find(p=>p.seat===action.seat)?.learning;
     const learnedRole=learned?.sourceSnapshot.mimickedRole??learned?.sourceSnapshot.originalRole;
     lines.push(action.target==null?`${action.seat} 号${actorName}未学习`:`${action.seat} 号${actorName}学习 ${action.target} 号${learned?.night===round.round&&learnedRole?'：'+boardRoleLabels[learnedRole]:''}`);
    }
    if(action.type==='guard_protect'){const name=actor==='guard'?'守卫':`${action.seat} 号${actorName}`;lines.push(action.target==null?`${name}空守`:`${name}守 ${action.target} 号`);}
    if(action.type==='spirit_check'||action.type==='mechanical_check'){
     const inspection=round.engine?.actions.find(a=>a.casterId===action.seat&&a.targetId===action.target&&a.abilityType==='inspect')?.privateInspection;
     const treasureInspection=round.treasure?.inspections[action.seat!];
     const result=treasureInspection?boardRoleLabels[treasureInspection.role]:inspection?.status==='visible'?boardRoleLabels[inspection.role]:inspection?.status==='camp'?inspection.camp==='wolves'?'狼人':'好人':null;
     const name=action.type==='spirit_check'?'通灵师':`${action.seat} 号${actorName}`;
     lines.push(action.target==null?`${name}空验`:`${name}验 ${action.target} 号${result?'：'+result:''}`);
    }
    if(action.type==='mechanical_poison')lines.push(action.target==null?`${action.seat} 号${actorName}未用毒`:`${action.seat} 号${actorName}毒 ${action.target} 号`);
    if(action.type==='mechanical_knife'||action.type==='armor_knife')lines.push(action.target==null?`${action.seat} 号${actorName}未用额外刀`:`${action.seat} 号${actorName}额外刀 ${action.target} 号`);
    if(action.type==='mixer_model')lines.push(action.target==null?'混血儿未选择榜样':`混血儿榜样 ${action.target} 号`);
   }
   for(const effect of round.engine?.resolution?.status==='settled'?round.engine.resolution.effects:[]){
    if(effect.reflectTarget!==null)lines.push(`${effect.casterId} 号毒药反弹至 ${effect.reflectTarget} 号${effect.outcome==='killed'?'（死亡）':''}`);
    else if(effect.outcome==='prevented'&&effect.targetId!==null)lines.push(`${effect.targetId} 号受到保护，${effect.abilityType==='poison'?'毒药':'狼刀'}未生效`);
   }
  }else{
   for(const action of e){if(action.type==='command'&&action.command?.action==='signup'){if(action.command.join===true)applicants.add(action.seat!);else applicants.delete(action.seat!);}if(action.type==='command'&&action.command?.action==='withdraw'||action.type==='death_explosion')applicants.delete(action.seat!);if(action.type==='vote_outcome'&&action.result?.purpose.startsWith('sheriff')){applicants.clear();for(const seat of action.result.leaders)applicants.add(seat);}}
   if(e.some(x=>x.type.startsWith('sheriff_')||x.command?.action==='signup'||x.command?.action==='withdraw')&&applicants.size)lines.push(`留警：${seats([...applicants].sort((a,b)=>a-b))}`);
   lines.push(...legacyVotes(e,round.outcome?.result));
   const shotTargets=new Set(e.filter(x=>x.type==='hunter_shot'||x.type==='white_wolf_take').map(x=>x.target));
   for(const action of e){
    if(action.type==='vote_cancelled')lines.push('狼女孩投票后自爆，本轮放逐投票作废');
    if(action.type==='vote_outcome'&&action.result)lines.push(describeVote(action.result));
    if(action.type==='treasure_mask_exemption')lines.push(`${action.seat} 号盗宝蒙面免放逐`);
    if(action.type==='masked_death_announced')lines.push(`${action.seat} 号蒙面人发言结束，宣布死亡`);
    if(action.type==='sheriff_elected'){sheriff=action.seat!;lines.push(`${sheriff} 号当选警长`);}
    if(action.type==='idiot_flip')lines.push(`${action.seat} 号白痴翻牌，神边出局、民边存活`);
    if(action.type.startsWith('death_')){
     const who=`${action.seat} 号`;const reason=action.type.slice(6);if(['shot','white-wolf'].includes(reason)&&shotTargets.has(action.seat))continue;
     const description:Record<string,string>={dance:'因共舞出局',penalty:'因违规点杀出局',dream:'因摄梦死亡',knife:'被狼刀杀死',poison:'被毒死',shot:'被开枪带走',exile:roles.get(action.seat!)==='idiot'?'被放逐，白痴翻牌死亡':'被放逐',explosion:'狼人自爆','white-wolf':'被白狼王带走','girl-retaliation':'被狼女孩自爆报复带走'};
     if(description[reason])lines.push(`${who}${description[reason]}${roles.get(action.seat!)==='hunter'&&(reason==='poison'||reason==='girl-retaliation'||hunterSpent.has(action.seat!))?'（技能不可发动）':''}`);
    }
    if(action.type==='white_wolf_take')lines.push(`${action.seat} 号白狼王自爆，带走 ${action.target} 号`);
    if(action.type==='hunter_shot'){lines.push(`${action.seat} 号${boardRoleLabels[roles.get(action.seat!)??'hunter']}开枪，带走 ${action.target} 号`);hunterSpent.add(action.seat!);}
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

const finalEventTypes=new Set(['treasure_card','dream_target','death_dream','masked_death_announced','treasure_mask_exemption','girl_confession','wolves_recognized','poisoner_poison','vote_cancelled','death_girl-retaliation','knife_resolved','priority_knife','witch_save','witch_poison','witch_skip','seer_check','hunter_seen','mechanical_learn','armor_learn','guard_protect','spirit_check','mechanical_check','mechanical_poison','mechanical_knife','armor_knife','mixer_model','vote_outcome','sheriff_elected','idiot_flip','hunter_shot','white_wolf_take','death_knife','death_poison','death_shot','death_exile','death_explosion','death_white-wolf']);
function finalVote(result:DayVoteResult):DayVoteResult{return {purpose:result.purpose,counts:result.counts.map(c=>({seat:c.seat,votes:c.votes})),leaders:[...result.leaders],...(result.ballots?{ballots:result.ballots.map(b=>({seat:b.seat,target:b.target}))}:{})};}
/** Public ended-game facts. Raw runtime and legacy sources remain unchanged. */
export function finalReplay(record:GameReplay):GameReplay{
 const summary=summarizeReplay(record);
 const personalResults=record.personalResults??record.rounds.findLast(r=>r.engine?.victory?.status==='ended')?.engine?.victory;
 const results=Array.isArray(personalResults)?personalResults:personalResults?.status==='ended'?personalResults.personalResults:undefined;
 return {...(results?{personalResults:results.map(p=>({seat:p.seat,won:p.won}))}:{}),winner:record.winner,roles:record.roles.map(p=>({seat:p.seat,role:p.role})),
  ...(record.author!==undefined?{author:record.author}:{}),...(record.board?{board:{id:record.board.id,name:record.board.name}}:{}),...(record.saved!==undefined?{saved:record.saved}:{}),
  summary:summary.map(section=>({title:section.title,lines:[...section.lines]})),
  rounds:record.rounds.map(round=>({kind:round.kind,round:round.round,events:effectiveGameEvents(round.events).flatMap((event):GameEvent[]=>{
   const badge=event.type==='command'&&event.command?.action==='transfer_badge';if(!badge&&!finalEventTypes.has(event.type))return [];
   return [{type:event.type,at:event.at,...(event.seat!==undefined?{seat:event.seat}:{}),...(event.target!==undefined?{target:event.target}:{}),
    ...(['vote_outcome','vote_cancelled'].includes(event.type)&&event.result?{result:finalVote(event.result)}:{}),...(badge?{command:{action:'transfer_badge',target:event.command!.target}}:{})}];
  }),...(round.outcome?{outcome:{sheriff:round.outcome.sheriff,badge:round.outcome.badge,result:round.outcome.result?finalVote(round.outcome.result):null}}:{})}))};
}
