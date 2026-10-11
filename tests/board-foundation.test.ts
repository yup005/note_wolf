import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardPreset,createBoardConfiguration,assertPlayableBoard} from '../packages/domain/boardConfig.js';
import {copySkills,useSkill,type SkillSnapshot} from '../packages/domain/skills.js';
import {evaluateVictory} from '../packages/domain/victory.js';
import {createDeck,rolesMatchBoard,assertCanDeal} from '../packages/domain/preparation.js';
import {manualOutcome} from '../packages/domain/manual.js';

test('presets support 12, 13 and 15 players without enabling incomplete boards',()=>{
 for(const [id,size] of [['standard-12',12],['mechanical-12',12],['mechanical-mixer-13',13],['mechanical-expanded-15',15]] as const){
  const config=boardPreset(id);assert.equal(config.seatCount,size);
  assert.equal(Object.values(config.roles).reduce((a,b)=>a+b,0),size);
  assert.equal(config.playable,id==='standard-12');
  if(id!=='standard-12')assert.throws(()=>assertPlayableBoard(config),/BOARD_NOT_IMPLEMENTED/);
 }
 const expanded=boardPreset('mechanical-expanded-15');
 assert.equal(expanded.roles.wolf,4);assert.equal(expanded.roles.villager,5);assert.equal(expanded.roles.idiot,1);
});

test('custom composition derives armor rules from positive armor count',()=>{
 const base=boardPreset('mechanical-12');
 const armor=createBoardConfiguration({seatCount:13,roles:{...base.roles,armoredWolf:1}});
 assert.equal(armor.ruleset,'mechanical-armor');assert.equal(armor.playable,false);
 const noArmor=createBoardConfiguration({seatCount:12,roles:{...base.roles,armoredWolf:0}});
 assert.equal(noArmor.ruleset,'mechanical-seer');assert.equal(Object.hasOwn(noArmor.roles,'armoredWolf'),false);
 const larger=createBoardConfiguration({seatCount:24,roles:{wolf:8,villager:8,spiritSeer:2,witch:2,hunter:2,guard:1,mechanicalWolf:1}});
 assert.equal(larger.seatCount,24);assert.equal(larger.ruleset,'mechanical-seer');
});

test('composition refuses count mismatch, fractions, unknown roles and injected rulesets',()=>{
 for(const input of [
  {seatCount:13,roles:{wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1}},
  {seatCount:12,roles:{wolf:-1,villager:13}},
  {seatCount:12,roles:{wolf:3.5,villager:8.5}},
  {seatCount:0,roles:{}}, {seatCount:12,roles:{nineTail:12}},
  {seatCount:12,roles:{wolf:12},ruleset:'standard'},
  {seatCount:12,roles:{wolf:NaN,villager:12}},
  {seatCount:Number.MAX_SAFE_INTEGER+1,roles:{wolf:Number.MAX_SAFE_INTEGER+1}}
 ])assert.throws(()=>createBoardConfiguration(input),/INVALID_BOARD_CONFIGURATION/);
});

test('changing a returned preset cannot contaminate subsequent presets or bypass playable gate',()=>{
 const config=boardPreset('standard-12');config.roles.wolf=3;
 assert.equal(boardPreset('standard-12').roles.wolf,4);
 assert.throws(()=>assertPlayableBoard(config),/INVALID_BOARD_CONFIGURATION/);
 const armor=boardPreset('mechanical-12');armor.playable=true;
 assert.throws(()=>assertPlayableBoard(armor),/BOARD_NOT_IMPLEMENTED/);
});

test('standard preparation consumes the canonical preset and rejects new-board dealing',()=>{
 const deck=createDeck();assert.equal(deck.length,12);assert.equal(rolesMatchBoard(deck),true);
 assert.equal(rolesMatchBoard([...deck.slice(0,11),'wolf']),deck[11]==='wolf');
 const seats=Array.from({length:12},(_,i)=>({number:i+1,memberId:String(i),nickname:'simulated',isHost:i===0,isTestPlayer:false,ready:true}));
 assert.doesNotThrow(()=>assertCanDeal(seats));
 assert.throws(()=>assertCanDeal(seats,boardPreset('mechanical-12')),/BOARD_NOT_IMPLEMENTED/);
 assert.throws(()=>createDeck(boardPreset('mechanical-12')),/BOARD_NOT_IMPLEMENTED/);
});

function source():SkillSnapshot{return {ownerSeat:1,originalRole:'mechanicalWolf',mimickedRole:'witch',skills:[
 {id:'poison-source',kind:'poison',capacity:1,remaining:0,availableFromNight:2,parameters:{damage:'witch-poison'},copiedFrom:null,uses:[{requestId:'spent',night:2,target:5}]},
 {id:'guard-source',kind:'guard',capacity:null,remaining:null,availableFromNight:2,parameters:{protection:'invincible'},copiedFrom:null,uses:[]}
]};}

test('copying a mimicked role freezes independent full-charge skills and leaves true identity intact',()=>{
 const original=source();const copy=copySkills(original,{copyId:'armor-copy',ownerSeat:2,originalRole:'armoredWolf',night:3,availableFromNight:4});
 assert.equal(copy.originalRole,'armoredWolf');assert.equal(copy.mimickedRole,'witch');
 assert.equal(copy.skills[0].remaining,1);assert.deepEqual(copy.skills[0].uses,[]);
 assert.deepEqual(copy.skills[0].copiedFrom,{seat:1,skillId:'poison-source',night:3});
 original.skills[0].parameters.damage='changed';original.mimickedRole='villager';
 assert.equal(copy.skills[0].parameters.damage,'witch-poison');assert.equal(copy.mimickedRole,'witch');
 const used=useSkill(copy,'armor-copy:poison-source',{requestId:'new-use',night:4,target:7});
 assert.equal(used.skills[0].remaining,0);assert.equal(copy.skills[0].remaining,1);assert.equal(original.skills[0].remaining,0);
 assert.deepEqual(used.skills[0].uses,[{requestId:'new-use',night:4,target:7}]);
});

test('copied skill consumption blocks premature use, exhaustion and conflicting retries',()=>{
 const copy=copySkills(source(),{copyId:'copy',ownerSeat:2,originalRole:'armoredWolf',night:3,availableFromNight:4});
 assert.throws(()=>useSkill(copy,'copy:poison-source',{requestId:'early',night:3,target:7}),/SKILL_NOT_ACTIVE/);
 const used=useSkill(copy,'copy:poison-source',{requestId:'one',night:4,target:7});
 assert.deepEqual(useSkill(used,'copy:poison-source',{requestId:'one',night:4,target:7}),used);
 assert.throws(()=>useSkill(used,'copy:poison-source',{requestId:'one',night:4,target:8}),/ALREADY_COMMITTED/);
 assert.throws(()=>useSkill(used,'copy:poison-source',{requestId:'two',night:5,target:8}),/SKILL_EXHAUSTED/);
 assert.throws(()=>useSkill(copy,'missing',{requestId:'x',night:4,target:7}),/SKILL_NOT_FOUND/);
});

test('unlimited skill copies retain independent provenance across another copy',()=>{
 const copy=copySkills(source(),{copyId:'first',ownerSeat:2,originalRole:'armoredWolf',night:3,availableFromNight:4});
 const next=copySkills(copy,{copyId:'second',ownerSeat:3,originalRole:'armoredWolf',night:4,availableFromNight:5});
 assert.equal(next.skills[1].remaining,null);
 assert.deepEqual(next.skills[1].copiedFrom,{seat:2,skillId:'first:guard-source',night:4});
 const once=useSkill(next,'second:first:guard-source',{requestId:'a',night:5,target:null});
 const twice=useSkill(once,'second:first:guard-source',{requestId:'b',night:6,target:3});
 assert.equal(twice.skills[1].remaining,null);assert.equal(twice.skills[1].uses.length,2);assert.equal(next.skills[1].uses.length,0);
 assert.equal(copy.skills[1].uses.length,0);
});

test('copy and use reject malformed skill state without partially mutating it',()=>{
 const original=source();original.skills[0].remaining=-1;
 assert.throws(()=>copySkills(original,{copyId:'bad',ownerSeat:2,originalRole:'armoredWolf',night:3,availableFromNight:4}),/INVALID_SKILL_STATE/);
 const copy=copySkills(source(),{copyId:'copy',ownerSeat:2,originalRole:'armoredWolf',night:3,availableFromNight:4});
 assert.throws(()=>useSkill(copy,'copy:poison-source',{requestId:'bad',night:4,target:0}),/INVALID_SKILL_STATE/);
 assert.equal(copy.skills[0].remaining,1);assert.equal(copy.skills[0].uses.length,0);
});

test('one-time extra knife requires inherited ordinary knife authority before consumption',()=>{
 const extra:SkillSnapshot={ownerSeat:2,originalRole:'mechanicalWolf',mimickedRole:'armoredWolf',skills:[
  {id:'bonus',kind:'extra-knife',capacity:1,remaining:1,availableFromNight:2,parameters:{damage:'ordinary-wolf-knife'},copiedFrom:{seat:1,skillId:'armor',night:1},uses:[]}
 ]};
 assert.throws(()=>useSkill(extra,'bonus',{requestId:'no-context',night:2,target:3}),/KNIFE_NOT_INHERITED/);
 assert.throws(()=>useSkill(extra,'bonus',{requestId:'locked',night:2,target:3},{inheritedWolfKnife:false}),/KNIFE_NOT_INHERITED/);
 const used=useSkill(extra,'bonus',{requestId:'unlocked',night:2,target:3},{inheritedWolfKnife:true});
 assert.equal(used.skills[0].remaining,0);assert.equal(extra.skills[0].remaining,1);
 assert.throws(()=>useSkill(used,'bonus',{requestId:'spent',night:3,target:4},{inheritedWolfKnife:true}),/SKILL_EXHAUSTED/);
});

test('victory counts mechanical and armored wolves by real identity regardless of copied role',()=>{
 const players=[{seat:1,role:'mechanicalWolf',learnedRole:'villager',alive:true},{seat:2,role:'armoredWolf',learnedRole:'witch',alive:true},{seat:3,role:'villager',alive:true},{seat:4,role:'spiritSeer',alive:true}] as const;
 assert.deepEqual(evaluateVictory(players,'mechanical-armor'),{status:'playing'});
 assert.deepEqual(evaluateVictory(players.map(p=>({...p,alive:p.seat>2})),'mechanical-armor'),{status:'ended',winner:'good',reason:'all-wolves-dead'});
});

test('mechanical simultaneous terminal death gives wolves priority after the batch',()=>{
 const players=[{seat:1,role:'mechanicalWolf',alive:false},{seat:2,role:'villager',alive:false},{seat:3,role:'guard',alive:true}] as const;
 assert.deepEqual(evaluateVictory(players,'mechanical-seer'),{status:'ended',winner:'wolves',reason:'all-villagers-dead'});
 assert.deepEqual(evaluateVictory([{...players[0]},{...players[1],alive:true},{...players[2],alive:false}],'mechanical-seer'),{status:'ended',winner:'wolves',reason:'all-gods-dead'});
});

test('unresolved mixer and mechanical idiot victory cannot silently apply ordinary ending',()=>{
 assert.deepEqual(evaluateVictory([{seat:1,role:'mixer',alive:false},{seat:2,role:'wolf',alive:true}],'mechanical-seer'),{status:'unresolved',questionId:'MA-VICTORY-MIXER'});
 assert.deepEqual(evaluateVictory([{seat:1,role:'mechanicalWolf',learnedRole:'idiot',alive:false},{seat:2,role:'villager',alive:true},{seat:3,role:'hunter',alive:true}],'mechanical-seer'),{status:'unresolved',questionId:'MA-VICTORY-MECHANICAL-IDIOT'});
});

test('armor simultaneous ending requires its own priority and incompatible role/ruleset input is rejected',()=>{
 const players=[{seat:1,role:'armoredWolf',alive:false},{seat:2,role:'villager',alive:false},{seat:3,role:'guard',alive:true}] as const;
 assert.deepEqual(evaluateVictory(players,'mechanical-armor'),{status:'unresolved',questionId:'MA-VICTORY-SIMULTANEOUS'});
 assert.throws(()=>evaluateVictory(players,'mechanical-seer'),/INVALID_VICTORY_STATE/);
 assert.throws(()=>evaluateVictory([{seat:1,role:'mechanicalWolf',alive:true}],'standard'),/INVALID_VICTORY_STATE/);
});

test('standard auto and manual victory share elimination and simultaneous priority',()=>{
 const roles=[{seat:1,role:'wolf'},{seat:2,role:'villager'},{seat:3,role:'hunter'}] as const;
 for(const [dead,want] of [[[],null],[[1],'good'],[[2],'wolves'],[[3],'wolves'],[[1,3],'wolves']] as const){
  assert.equal(manualOutcome(roles,dead),want);
  const result=evaluateVictory(roles.map(p=>({...p,alive:!dead.some(s=>s===p.seat)})),'standard');
  assert.equal(result.status==='ended'?result.winner:null,want);
 }
});
