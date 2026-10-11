import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardPreset,createBoardConfiguration,assertPlayableBoard} from '../packages/domain/boardConfig.js';
import {copySkills,useSkill,type SkillSnapshot} from '../packages/domain/skills.js';
import {evaluateVictory} from '../packages/domain/victory.js';
import {knifeAuthorityAtNightStart} from '../packages/domain/knifeAuthority.js';
import {selectMixerModel} from '../packages/domain/mixer.js';
import {createDeck,rolesMatchBoard,assertCanDeal} from '../packages/domain/preparation.js';
import {manualOutcome} from '../packages/domain/manual.js';

test('presets support 12, 13 and 15 players without enabling incomplete boards',()=>{
 for(const [id,size] of [['standard-12',12],['mechanical-12',12],['mechanical-armor-12',12],['mechanical-mixer-13',13],['mechanical-expanded-15',15]] as const){
  const config=boardPreset(id);assert.equal(config.seatCount,size);
  assert.equal(Object.values(config.roles).reduce((a,b)=>a+b,0),size);
  assert.equal(config.playable,id==='standard-12');
  if(id!=='standard-12')assert.throws(()=>assertPlayableBoard(config),/BOARD_NOT_IMPLEMENTED/);
 }
 const expanded=boardPreset('mechanical-expanded-15');
 assert.equal(expanded.roles.wolf,4);assert.equal(expanded.roles.villager,5);assert.equal(expanded.roles.idiot,1);
 const armor=boardPreset('mechanical-armor-12');assert.equal(armor.roles.wolf,2);assert.equal(armor.roles.armoredWolf,1);
});

test('custom composition derives armor rules from positive armor count',()=>{
 const base=boardPreset('mechanical-12');
 const armor=createBoardConfiguration({seatCount:13,roles:{...base.roles,armoredWolf:1}});
 assert.equal(armor.ruleset,'mechanical-armor');assert.equal(armor.playable,false);
 const noArmor=createBoardConfiguration({seatCount:12,roles:{...base.roles,armoredWolf:0}});
 assert.equal(noArmor.ruleset,'mechanical-seer');assert.equal(Object.hasOwn(noArmor.roles,'armoredWolf'),false);
 const larger=createBoardConfiguration({seatCount:24,roles:{wolf:11,villager:9,spiritSeer:1,witch:1,hunter:1,guard:1}});
 assert.equal(larger.seatCount,24);assert.equal(larger.ruleset,'mechanical-seer');
});

test('custom compositions permit zero ordinary wolves but forbid repeated special roles',()=>{
 assert.equal(createBoardConfiguration({seatCount:3,roles:{mechanicalWolf:1,armoredWolf:1,villager:1}}).ruleset,'mechanical-armor');
 for(const roles of [{witch:2,villager:1},{mechanicalWolf:2,wolf:1},{armoredWolf:2,wolf:1},{mixer:2,wolf:1}])
  assert.throws(()=>createBoardConfiguration({seatCount:3,roles}),/INVALID_BOARD_CONFIGURATION/);
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

test('armor inherits confirmed simultaneous priority and incompatible role/ruleset input is rejected',()=>{
 const players=[{seat:1,role:'armoredWolf',alive:false},{seat:2,role:'villager',alive:false},{seat:3,role:'guard',alive:true}] as const;
 assert.deepEqual(evaluateVictory(players,'mechanical-armor'),{status:'ended',winner:'wolves',reason:'all-villagers-dead'});
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

test('a faction absent from the initial custom composition cannot trigger elimination',()=>{
 const noGods=[{seat:1,role:'wolf',alive:true},{seat:2,role:'villager',alive:true}] as const;
 assert.deepEqual(evaluateVictory(noGods,'mechanical-seer'),{status:'playing'});
 assert.deepEqual(evaluateVictory(noGods.map(p=>({...p,alive:p.seat!==2})),'mechanical-seer'),{status:'ended',winner:'wolves',reason:'all-villagers-dead'});
 const noVillagers=[{seat:1,role:'mechanicalWolf',alive:true},{seat:2,role:'guard',alive:true}] as const;
 assert.deepEqual(evaluateVictory(noVillagers,'mechanical-seer'),{status:'playing'});
 assert.deepEqual(evaluateVictory(noVillagers.map(p=>({...p,alive:p.seat!==2})),'mechanical-seer'),{status:'ended',winner:'wolves',reason:'all-gods-dead'});
});

test('knife inheritance uses shared action membership, supports night one and freezes a night snapshot',()=>{
 const players=[{seat:1,alive:true,knifeGroup:'shared'},{seat:2,alive:true,knifeGroup:'mechanical'},{seat:3,alive:true,knifeGroup:'armor'}] as const;
 assert.deepEqual(knifeAuthorityAtNightStart(players),{sharedKnifeSeats:[1],inheritedKnifeSeat:null});
 const next=players.map(p=>({...p,alive:p.seat!==1}));
 const night=knifeAuthorityAtNightStart(next);assert.deepEqual(night,{sharedKnifeSeats:[],inheritedKnifeSeat:2});
 next[1].alive=false;assert.equal(night.inheritedKnifeSeat,2);
 assert.deepEqual(knifeAuthorityAtNightStart(next),{sharedKnifeSeats:[],inheritedKnifeSeat:3});
 assert.deepEqual(knifeAuthorityAtNightStart([{seat:2,alive:true,knifeGroup:'mechanical'},{seat:3,alive:true,knifeGroup:'armor'}]),{sharedKnifeSeats:[],inheritedKnifeSeat:2});
});

test('mixer model is private, first-night only, immutable and follows original camp after model death',()=>{
 const players=[{seat:1,role:'mixer',alive:true},{seat:2,role:'mechanicalWolf',learnedRole:'villager',alive:true},{seat:3,role:'villager',alive:true},{seat:4,role:'guard',alive:true}] as const;
 assert.throws(()=>selectMixerModel(players,1,1,1),/INVALID_MODEL/);
 assert.throws(()=>selectMixerModel(players,1,2,2),/NOT_YOUR_TURN/);
 const selected=selectMixerModel(players,1,2,1);assert.equal(selected[0].modelCamp,'wolves');assert.equal(selected[0].role,'mixer');
 assert.equal(Object.hasOwn(players[0],'modelCamp'),false);
 assert.throws(()=>selectMixerModel(selected,1,3,1),/ALREADY_COMMITTED/);
 assert.deepEqual(evaluateVictory(selected.map(p=>({...p,alive:p.seat!==2})),'mechanical-seer'),{status:'ended',winner:'good',reason:'all-wolves-dead',personalResults:[{seat:1,won:false}]});
});

test('mixer death of any cause activates the one-villager threshold without changing true camp',()=>{
 const players=[{seat:1,role:'mixer',alive:true},{seat:2,role:'wolf',alive:true},{seat:3,role:'villager',alive:true},{seat:4,role:'guard',alive:true}] as const;
 const selected=selectMixerModel(players,1,4,1);
 assert.deepEqual(evaluateVictory(selected,'mechanical-seer'),{status:'playing'});
 assert.deepEqual(evaluateVictory(selected.map(p=>({...p,alive:p.seat!==1})),'mechanical-seer'),{status:'ended',winner:'wolves',reason:'mixer-dead-one-villager',personalResults:[{seat:1,won:false}]});
});

test('persisted mixer camp cannot contradict its model true role or follow the model mimicry',()=>{
 assert.throws(()=>evaluateVictory([
  {seat:1,role:'mixer',alive:true,modelSeat:2,modelCamp:'good'},
  {seat:2,role:'mechanicalWolf',learnedRole:'villager',alive:false},
  {seat:3,role:'villager',alive:true},{seat:4,role:'guard',alive:true}
 ],'mechanical-seer'),/INVALID_VICTORY_STATE/);
});

test('a living mixer as the last civilian satisfies wolf elimination while retaining model victory',()=>{
 const selected=selectMixerModel([{seat:1,role:'mixer',alive:true},{seat:2,role:'wolf',alive:true},{seat:3,role:'guard',alive:true}],1,2,1);
 assert.deepEqual(evaluateVictory(selected,'mechanical-seer'),{status:'ended',winner:'wolves',reason:'mixer-last-civilian',personalResults:[{seat:1,won:true}]});
});
