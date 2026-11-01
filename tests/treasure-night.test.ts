import test from 'node:test';
import assert from 'node:assert/strict';
import {createNight,beginNight,advanceNight,nightCommand,privateNight,publicNight,type NightState} from '../packages/domain/night.js';
import {dealTreasure} from '../packages/domain/treasure.js';
import {boardPreset} from '../packages/domain/boardConfig.js';
import {boardRuleVersion,type RoomBoardSnapshot} from '../packages/contracts/board.js';
import {fixture,move,seat} from './treasure-fixture.js';
test('first night wolves meet without knife and only random confirmer can end early',()=>{
 const s=fixture();beginNight(s,0,()=>0);move(s,'wolves');const wolves=s.players.filter(p=>p.role==='wolf'||p.role==='blackWolf').map(p=>p.seat);
 assert.deepEqual(privateNight(s,wolves[0]).wolves,wolves);assert.equal(privateNight(s,seat(s,'treasureMaster')).kind,'waiting');
 assert.throws(()=>nightCommand(s,wolves[0],{action:'vote',turnId:s.turnId,target:1},s.deadline!-1),/FIRST_NIGHT_NO_KNIFE/);
 assert.throws(()=>nightCommand(s,wolves[1],{action:'confirm_wolves',turnId:s.turnId},s.deadline!-1),/CONFIRMER_ONLY/);
 nightCommand(s,s.confirmer!,{action:'confirm_wolves',turnId:s.turnId},s.deadline!-1);assert.equal(s.knife,null);
});
test('treasure chooses bottom privately, cannot repeat next night and exact inspection shows borrowed civilian',()=>{
 const s=fixture();beginNight(s,0,()=>0);move(s,'treasure');const t=seat(s,'treasureMaster');const card=privateNight(s,t);assert.equal(card.treasureCamp,'wolves');assert.equal(card.bottoms?.length,3);
 for(const p of s.players.filter(p=>p.seat!==t))assert.equal(privateNight(s,p.seat).bottoms,undefined);
 assert.equal(JSON.stringify(publicNight(s,0)).includes('bottoms'),false);
 const c={action:'treasure_card',turnId:s.turnId,card:'villager'} as const;nightCommand(s,t,c,s.deadline!-1);nightCommand(s,t,c,s.deadline!-1);
 move(s,'first_night_complete');assert.equal(s.treasure!.selected,'villager');
 const n=createNight(s.players,1000000,{night:2,antidote:false,poison:s.poison,hunterSpent:false,priorityWolf:null,treasure:s.treasure},undefined);beginNight(n,1000000,()=>0);move(n,'treasure');
 assert.throws(()=>nightCommand(n,t,{...c,turnId:n.turnId},n.deadline!-1),/TREASURE_REPEAT_CARD/);
});
test('hunter protected by dream remains able to shoot despite poison selection',()=>{
 const s=fixture();beginNight(s,0,()=>0);move(s,'hunter');const h=seat(s,'hunter');s.treasure!.poisons=[{caster:1,target:h}];s.treasure!.dreams=[{caster:2,target:h,repeat:false}];assert.equal(privateNight(s,h).canShoot,true);
});
test('dream immunity blocks knife and poison, consecutive native dream kills, borrowed dream remembers across switches',()=>{
 const s=fixture();beginNight(s,0,()=>0);move(s,'first_night_complete');const h=seat(s,'hunter'),d=seat(s,'dreamer'),t=seat(s,'treasureMaster');
 s.knife=h;s.treasure!.poisons=[{caster:1,target:h}];s.treasure!.dreams=[{caster:d,target:h,repeat:false}];
 return import('../packages/domain/treasureNight.js').then(({settleTreasure})=>{settleTreasure(s);assert.equal(s.treasure!.deaths.some(p=>p.seat===h),false);s.treasure!.dreams[0].repeat=true;settleTreasure(s);assert.equal(s.treasure!.deaths.find(p=>p.seat===h)!.reason,'dream');
  const z=fixture('fixed-wolf',3),zt=seat(z,'treasureMaster'),zh=seat(z,'hunter');z.treasure!.dreamHistory[zt]=[{night:1,target:zh}];z.night=3;z.treasure!.previous='villager';beginNight(z,0,()=>0);move(z,'treasure');nightCommand(z,zt,{action:'treasure_card',card:'dreamer',turnId:z.turnId},z.deadline!-1);nightCommand(z,zt,{action:'dream',target:zh,turnId:z.turnId},z.deadline!-1);assert.equal(z.treasure!.dreams.find(x=>x.caster===zt)!.repeat,true);
 });
});
test('borrowed poison is independent and cannot refill after switching cards',()=>{
 const s=fixture('fixed-wolf',1);beginNight(s,0,()=>0);move(s,'treasure');const t=seat(s,'treasureMaster'),v=seat(s,'villager');
 nightCommand(s,t,{action:'treasure_card',card:'poisoner',turnId:s.turnId},s.deadline!-1);nightCommand(s,t,{action:'poisoner',target:v,turnId:s.turnId},s.deadline!-1);move(s,'first_night_complete');assert.ok(s.treasure!.poisonSpent.includes(t));
 const n=createNight(s.players,1000000,{night:2,antidote:false,poison:true,hunterSpent:false,priorityWolf:null,treasure:s.treasure});beginNight(n,1000000,()=>0);move(n,'treasure');nightCommand(n,t,{action:'treasure_card',card:'villager',turnId:n.turnId},n.deadline!-1);move(n,'first_night_complete');
 const z=createNight(n.players,2000000,{night:3,antidote:false,poison:true,hunterSpent:false,priorityWolf:null,treasure:n.treasure});beginNight(z,2000000,()=>0);move(z,'treasure');nightCommand(z,t,{action:'treasure_card',card:'poisoner',turnId:z.turnId},z.deadline!-1);assert.equal(privateNight(z,t).poison,false);assert.throws(()=>nightCommand(z,t,{action:'poisoner',target:v,turnId:z.turnId},z.deadline!-1),/SKILL_EXHAUSTED/);
});
