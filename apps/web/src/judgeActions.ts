import type {JudgePrivate,JudgeSupplement} from '../../../packages/contracts/judge';
type Operation=JudgeSupplement['operation'];
export interface JudgeAction {key:string;label:string;target?:'required'|'optional';counts?:boolean;voteSettings?:boolean;speechSettings?:boolean}
export const judgePhaseNames:Record<string,string>={dancer:'舞者共舞',mask:'假面行动',confession:'狼女孩表白',confession_notice:'被表白者查看信息',poisoner:'毒师行动',awaiting_host:'等待开始',mechanical_authority:'狼刀权限确认',guard:'守卫行动',wolves:'狼人行动',eyes_closed:'闭眼间隔',witch:'女巫行动',mechanical:'机械狼行动',armor:'装甲狼行动',spiritSeer:'通灵师行动',mixer:'混血儿选择榜样',seer:'预言家行动',hunter:'猎人状态',first_night_complete:'夜晚完成',rules_pending:'规则待确认',sheriff_signup:'警长报名',sheriff_speech:'警上发言',sheriff_withdraw:'退水',vote_setup:'投票设置',voting:'投票中',vote_result:'投票结果',night_announcement:'死亡公告',death_skill:'死亡技能询问',hunter_target:'开枪目标',white_wolf_target:'白狼王目标',last_words:'遗言',badge_transfer:'警徽移交',day_direction:'发言设置',day_speech:'白天发言',free_speech:'自由发言',day_complete:'白天结束',ended:'对局结束'};
export function judgeActions(data:JudgePrivate,seat:number):JudgeAction[]{
 const draft=data.draft;if(!draft)return [];const card=data.cards.find(c=>c.seat===seat),actions:JudgeAction[]=[];
 const add=(key:string,label:string,extra:Omit<JudgeAction,'key'|'label'>={})=>actions.push({key,label,...extra});
 if(draft.kind==='night'){
  const c=card?.night;if(!c||c.kind==='waiting'||c.kind==='dancer'||c.kind==='mask')return [];
  if(c.kind==='wolves'){if(!c.recognitionOnly)add('vote','狼刀选择',{target:'optional'});if(c.confirmer===seat)add('confirm_wolves','确认狼队选择');if(c.priorityWolf===seat)add('priority_knife','确认优先指刀',{target:'optional'});}
  else if(c.kind==='confession')add('confess','表白目标',{target:'required'});
  else if(c.kind==='confession_notice')add('confession_seen','已查看表白信息');
  else if(c.kind==='poisoner'){if(c.poison)add('poisoner','毒杀目标',{target:'required'});add('poisoner:skip','不用毒药');}
  else if(c.kind==='witch'){if(c.antidote&&c.knife!=null)add('witch:save','使用解药');if(c.poison)add('witch:poison','使用毒药',{target:'required'});add('witch:skip','不用药');}
  else if(c.kind==='seer'){add('seer','查验目标',{target:'required'});add('seer_finish','已查看查验结果');}
  else if(c.kind==='hunter')add('hunter_seen','已查看技能状态');
  else if(c.kind==='mixer')add('mixer','选择榜样',{target:'required'});
  else if(c.kind==='guard')add('ability:guard','守护目标',{target:'optional'});
  else if(c.kind==='mechanical_authority')add('authority_seen','已查看狼刀状态');
  else{
   if(c.canLearn)add('ability:learn','学习目标身份',{target:'required'});
   if(c.kind==='spiritSeer')add('ability:inspect','查验目标',{target:'optional'});
   for(const skill of c.skills??[])if(skill.available)add('ability:'+skill.kind,({'guard':'守护目标',poison:'使用毒药',inspect:'查验目标','extra-knife':'额外狼刀'} as const)[skill.kind],{target:skill.kind==='poison'?'required':'optional'});
   add('ability:skip','本次不用技能');add('ability_finish','已查看操作结果');
  }
 }else if(data.day){
  const d=data.day,c=card?.day;
  switch(d.phase){
   case 'awaiting_host':add('start','开始白天');break;
   case 'sheriff_signup':if(c?.canSignup){add('signup:yes','参与警长竞选');add('signup:no','不参与警长竞选');}add('close_signup','结束警长报名');break;
   case 'sheriff_speech':add('end_speech','结束当前发言');if(c?.canWithdraw)add('withdraw','退水');break;
   case 'sheriff_withdraw':if(c?.canWithdraw)add('withdraw','退水');add('close_withdraw','结束退水');break;
   case 'vote_setup':add('start_vote','开启投票',{voteSettings:true});break;
   case 'voting':if(d.vote?.method==='phone'){if(c?.canVote)add('vote','投票',{target:'optional'});}else{add('offline_vote','录入本座位票型',{target:'optional'});add('offline_results','录入汇总票数',{counts:true});}add('close_vote','结束投票');break;
   case 'vote_result':case 'night_announcement':add('continue','确认并继续');break;
   case 'death_skill':if(c?.canShoot)add('shoot','发动开枪技能');break;
   case 'hunter_target':add('record_shot','录入开枪目标',{target:'required'});break;
   case 'white_wolf_target':add('record_take','录入白狼王目标',{target:'required'});break;
   case 'last_words':case 'day_speech':case 'free_speech':add('end_speech','结束当前发言');break;
   case 'badge_transfer':add('transfer_badge','移交或撕掉警徽',{target:'optional'});break;
   case 'day_direction':add('speech_mode','设置发言方式',{speechSettings:true});if(d.sheriff===seat){add('direction:ascending','按座位正序发言',{target:'optional'});add('direction:descending','按座位倒序发言',{target:'optional'});}break;
  }
  if(c?.canExplode)add('explode','确认现场自爆');
 }
 return actions.filter((action,index,list)=>list.findIndex(a=>a.key===action.key)===index);
}
export function judgeOperation(data:JudgePrivate,seat:number,key:string,fields:{target:number|null;method:'phone'|'offline';seconds:number;speech:'phone'|'free';counts:Record<number,string>}):Operation{
 const draft=data.draft;if(!draft)throw Error('请先开始补录');const turnId=draft.turnId,target=fields.target;
 if(draft.kind==='night'){
  const [action,choice]=key.split(':');
  if(action==='ability')return {kind:'night',actorSeat:seat,command:{action,turnId,choice:choice as 'learn'|'guard'|'poison'|'inspect'|'extra-knife'|'skip',target}};
  if(action==='witch')return {kind:'night',actorSeat:seat,command:{action,turnId,choice:choice as 'save'|'poison'|'skip',target:choice==='poison'?target:null}};
  if(action==='poisoner')return {kind:'night',actorSeat:seat,command:{action,turnId,target:choice==='skip'?null:target}};
  if(action==='confession_seen')return {kind:'night',actorSeat:seat,command:{action,turnId}};
  if(action==='confess'||action==='mixer'||action==='seer'){if(target===null)throw Error('请选择目标');return {kind:'night',actorSeat:seat,command:{action,turnId,target}};}
  if(action==='vote'||action==='priority_knife')return {kind:'night',actorSeat:seat,command:{action,turnId,target}};
  if(['confirm_wolves','ability_finish','authority_seen','seer_finish','hunter_seen'].includes(action))return {kind:'night',actorSeat:seat,command:{action:action as 'confirm_wolves'|'ability_finish'|'authority_seen'|'seer_finish'|'hunter_seen',turnId}};
 }else{
  if(key.startsWith('signup:'))return {kind:'day',actorSeat:seat,command:{action:'signup',turnId,join:key==='signup:yes'}};
  if(key==='vote'||key==='offline_vote'||key==='transfer_badge')return {kind:'day',actorSeat:seat,command:key==='vote'?{action:key,turnId,target}:key==='offline_vote'?{action:key,turnId,voter:seat,target}:{action:key,turnId,target,takeover:true}};
  if(key==='record_shot'||key==='record_take'){if(target===null)throw Error('请选择目标');return {kind:'day',actorSeat:seat,command:{action:key,turnId,target}};}
  if(key==='start_vote')return {kind:'day',actorSeat:seat,command:{action:key,turnId,method:fields.method,seconds:fields.seconds,visibility:'individual'}};
  if(key==='offline_results')return {kind:'day',actorSeat:seat,command:{action:key,turnId,counts:(data.day?.vote?.candidates??[]).map(seat=>({seat,votes:Number(fields.counts[seat]??0)}))}};
  if(key==='speech_mode')return {kind:'day',actorSeat:seat,command:{action:key,turnId,mode:fields.speech}};
  if(key.startsWith('direction:'))return {kind:'day',actorSeat:seat,command:{action:'direction',turnId,direction:key==='direction:ascending'?'ascending':'descending',...(target===null?{}:{start:target})}};
  if(key==='explode')return {kind:'day',actorSeat:seat,command:{action:key,turnId,confirmed:true}};
  if(['start','close_signup','withdraw','end_speech','close_withdraw','close_vote','continue','shoot'].includes(key))return {kind:'day',actorSeat:seat,command:{action:key as 'start'|'close_signup'|'withdraw'|'end_speech'|'close_withdraw'|'close_vote'|'continue'|'shoot',turnId}};
 }
 throw Error('当前阶段没有此操作');
}
