import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as abilities from '../packages/domain/mechanicalAbilities.js';
import type {BoardRole,Ruleset} from '../packages/contracts/board.js';
import type {EnginePlayer} from '../packages/contracts/engine.js';

function player(seat:number,role:BoardRole,ruleset:Ruleset='mechanical-seer'):EnginePlayer{
 return {seat,role,knifeGroup:role==='wolf'?'shared':role==='mechanicalWolf'?'mechanical':role==='armoredWolf'?'armor':'none',camp:role==='wolf'||role==='mechanicalWolf'||role==='armoredWolf'?'wolves':role==='mixer'?null:'good',alive:true,abilities:abilities.createNativeAbilityProfile(role,seat,ruleset),learning:null,model:null,publicState:{revealedRole:null,canVote:true,canInterject:false}};
}
const metadata={ruleset:'mechanical-seer' as const,night:2,copyId:'learn',at:10};
function learned(sourceRole:BoardRole,ruleset:Ruleset='mechanical-seer'){
 const result=abilities.learnMechanicalAbility([player(1,'mechanicalWolf',ruleset),player(2,sourceRole,ruleset)],1,2,{...metadata,ruleset});
 if(result.status!=='learned')throw Error('learning blocked');return result;
}
function context(snapshot:ReturnType<typeof abilities.createNativeAbilityProfile>,ruleset:Ruleset='mechanical-seer'){
 const actor=player(snapshot.ownerSeat,snapshot.originalRole,ruleset);actor.abilities=snapshot;
 return {ruleset,players:[actor,player(2,'villager',ruleset),player(3,'guard',ruleset)]};
}

test('native witch inventory is distinct from poison-only copied inventory and source provenance',()=>{
 const witch=player(2,'witch');assert.deepEqual(witch.abilities.skills.map(s=>s.kind),['antidote','poison']);
 const copy=learned('witch');assert.equal(copy.abilities.originalRole,'mechanicalWolf');assert.equal(copy.abilities.mimickedRole,'witch');
 assert.deepEqual(copy.abilities.skills.map(s=>s.kind),['poison']);assert.equal(copy.abilities.skills[0].availableFromNight,3);
 assert.deepEqual(copy.learning.sourceSnapshot.skills.map(s=>s.kind),['antidote','poison']);assert.deepEqual(copy.learning.copyProfileSnapshot.skills.map(s=>s.kind),['poison']);
 assert.deepEqual(copy.abilities.skills[0].copiedFrom,{seat:2,skillId:'native:2:poison',night:2});
});

test('learning passes preserve opportunity, learning once locks and checks living other targets',()=>{
 const players=[player(1,'mechanicalWolf'),player(2,'villager'),player(3,'guard')];
 assert.deepEqual(abilities.learnMechanicalAbility(players,1,null,metadata),{status:'passed'});
 assert.equal(players[0].learning,null);assert.throws(()=>abilities.learnMechanicalAbility(players,2,1,metadata),/LEARNING_NOT_AUTHORIZED/);
 assert.throws(()=>abilities.learnMechanicalAbility(players,1,1,metadata),/INVALID_TARGET/);
 players[2].alive=false;assert.throws(()=>abilities.learnMechanicalAbility(players,1,3,metadata),/INVALID_TARGET/);
 const result=abilities.learnMechanicalAbility(players,1,2,metadata);assert.equal(result.status,'learned');if(result.status!=='learned')throw Error('learn');
 players[0].abilities=result.abilities;players[0].learning=result.learning;
 assert.throws(()=>abilities.learnMechanicalAbility(players,1,3,metadata),/ALREADY_LEARNED/);
 players[0].alive=false;players[1].alive=false;assert.equal(result.abilities.mimickedRole,'villager');assert.equal(result.learning.sourceSnapshot.originalRole,'villager');
 assert.equal(players[0].role,'mechanicalWolf');assert.equal(players[0].camp,'wolves');
 assert.deepEqual(result.feedback,{status:'private',role:'villager',civilianEasterEgg:{text:'你就是个「普通村民」！',emphasis:'普通村民',color:'red'}});
});

test('copied guard modes and one-time extra knives follow exclusive ruleset profiles',()=>{
 for(const [ruleset,protection] of [['mechanical-seer','mechanical-reflect'],['mechanical-armor','invincible']] as const){
  const guard=learned('guard',ruleset);assert.equal(guard.abilities.skills[0].parameters.protection,protection);assert.equal(guard.abilities.skills[0].availableFromNight,3);
  assert.equal(guard.learning.sourceSnapshot.skills[0].parameters.protection,'ordinary');
  const wolf=learned('wolf',ruleset);assert.equal(wolf.abilities.skills[0].kind,'extra-knife');assert.equal(wolf.abilities.skills[0].remaining,1);
  assert.equal(wolf.abilities.skills[0].parameters.damage,'ordinary-wolf-knife');
  assert.equal(wolf.abilities.skills[0].parameters.pierceOrdinaryGuard,ruleset==='mechanical-seer'?true:undefined);
 }
 assert.equal(learned('hunter').abilities.skills[0].availableFromNight,2);
 assert.equal(learned('spiritSeer').abilities.skills[0].availableFromNight,3);
 assert.deepEqual(learned('mixer').abilities.skills,[]);assert.deepEqual(learned('mixer').feedback,{status:'private',role:'mixer'});
 const idiot=abilities.learnMechanicalAbility([player(1,'mechanicalWolf'),player(2,'idiot')],1,2,metadata);assert.equal(idiot.status,'learned');
 if(idiot.status!=='learned')throw Error('confirmed idiot learning');
 assert.equal(idiot.abilities.mimickedRole,'idiot');assert.deepEqual(idiot.abilities.skills,[]);assert.deepEqual(idiot.feedback,{status:'private',role:'idiot'});
 const seer=abilities.learnMechanicalAbility([player(1,'mechanicalWolf'),player(2,'seer')],1,2,metadata);assert.equal(seer.status,'blocked');
});

test('armor learns copied mechanical profile frozen at full independent capacity',()=>{
 const ruleset='mechanical-armor';const source=player(1,'mechanicalWolf',ruleset);const witch=player(2,'witch',ruleset);const armor=player(3,'armoredWolf',ruleset);
 const first=abilities.learnMechanicalAbility([source,witch,armor],1,2,{...metadata,ruleset});if(first.status!=='learned')throw Error('learn');
 source.abilities=first.abilities;source.learning=first.learning;
 source.abilities.skills[0].remaining=0;source.abilities.skills[0].uses=[{requestId:'spent',night:3,target:2}];
 const next=abilities.learnMechanicalAbility([source,witch,armor],3,1,{...metadata,ruleset,night:3,copyId:'armor'});if(next.status!=='learned')throw Error('learn');
 assert.equal(next.abilities.originalRole,'armoredWolf');assert.equal(next.abilities.mimickedRole,'witch');assert.equal(next.abilities.skills[0].remaining,1);assert.equal(next.abilities.skills[0].availableFromNight,4);
 assert.deepEqual(next.abilities.skills[0].copiedFrom,{seat:1,skillId:'learn:native:2:poison',night:3});assert.equal(next.learning.sourceSnapshot.skills[0].remaining,0);
 source.abilities.mimickedRole='villager';source.abilities.skills[0].parameters.damage='changed';assert.equal(next.abilities.skills[0].parameters.damage,'witch-poison');assert.equal(next.abilities.mimickedRole,'witch');
 const unlearned=abilities.learnMechanicalAbility([player(1,'mechanicalWolf',ruleset),player(3,'armoredWolf',ruleset)],3,1,{...metadata,ruleset});if(unlearned.status!=='learned')throw Error('learn');
 assert.equal(unlearned.abilities.skills[0].kind,'extra-knife');assert.equal(unlearned.abilities.skills[0].parameters.pierceOrdinaryGuard,undefined);
 assert.equal(learned('armoredWolf',ruleset).abilities.skills[0].kind,'extra-knife');
});

test('guard self/pass and nonconsecutive targets record independent use without allowing two actions pernight',()=>{
 const initial=learned('guard').abilities;const id=initial.skills[0].id;
 assert.throws(()=>abilities.useConfirmedAbility(initial,id,{requestId:'early',night:2,target:1},context(initial)),/SKILL_NOT_ACTIVE/);
 const one=abilities.useConfirmedAbility(initial,id,{requestId:'one',night:3,target:1},context(initial));if(one.status!=='used')throw Error('used');
 assert.equal(one.abilities.skills[0].lastTarget,1);assert.equal(initial.skills[0].uses.length,0);
 assert.throws(()=>abilities.useConfirmedAbility(one.abilities,id,{requestId:'again',night:3,target:2},context(one.abilities)),/ALREADY_COMMITTED/);
 assert.throws(()=>abilities.useConfirmedAbility(one.abilities,id,{requestId:'repeat',night:4,target:1},context(one.abilities)),/GUARD_CONSECUTIVE_TARGET/);
 const pass=abilities.useConfirmedAbility(one.abilities,id,{requestId:'pass',night:4,target:null},context(one.abilities));if(pass.status!=='used')throw Error('pass');
 const next=abilities.useConfirmedAbility(pass.abilities,id,{requestId:'next',night:5,target:1},context(pass.abilities));assert.equal(next.status,'used');
 assert.equal(abilities.useConfirmedAbility(one.abilities,id,{requestId:'gap',night:5,target:1},context(one.abilities)).status,'used');
 assert.deepEqual(abilities.useConfirmedAbility(one.abilities,id,{requestId:'one',night:3,target:1},context(one.abilities)),one);
 const dead=context(initial);dead.players[1].alive=false;assert.throws(()=>abilities.useConfirmedAbility(initial,id,{requestId:'dead',night:3,target:2},dead),/INVALID_TARGET/);
});

test('exact private inspection resolves immediate mimic and confirmed mixed-blood identity',()=>{
 const initial=learned('spiritSeer').abilities;const id=initial.skills[0].id;
 assert.throws(()=>abilities.useConfirmedAbility(initial,id,{requestId:'self',night:3,target:1},context(initial)),/INVALID_TARGET/);
 const ctx=context(initial);ctx.players[1]=player(2,'mechanicalWolf');ctx.players[1].abilities=learned('witch').abilities;ctx.players[1].abilities.ownerSeat=2;
 const inspected=abilities.useConfirmedAbility(initial,id,{requestId:'inspect',night:3,target:2},ctx);if(inspected.status!=='used')throw Error('inspect');
 assert.deepEqual(inspected.inspection,{status:'visible',role:'witch'});
 assert.equal(abilities.useConfirmedAbility(inspected.abilities,id,{requestId:'again',night:4,target:2},ctx).status,'used');
 const pass=abilities.useConfirmedAbility(initial,id,{requestId:'pass',night:3,target:null},ctx);assert.equal(pass.status,'used');
 const mixer=player(2,'mixer');assert.deepEqual(abilities.visibleInspectionRole(mixer),{status:'visible',role:'mixer'});
 ctx.players[1]=mixer;const mixedBlood=abilities.useConfirmedAbility(initial,id,{requestId:'mixed-blood',night:3,target:2},ctx);if(mixedBlood.status!=='used')throw Error('inspection');assert.deepEqual(mixedBlood.inspection,{status:'visible',role:'mixer'});
 assert.deepEqual(abilities.visibleInspectionRole(player(2,'mechanicalWolf')),{status:'visible',role:'mechanicalWolf'});
});

test('poison and extra knife pass preserve stock, selfuse consumes once and extra requires inherited authority',()=>{
 const poison=learned('witch').abilities;const id=poison.skills[0].id;
 const pass=abilities.useConfirmedAbility(poison,id,{requestId:'pass',night:3,target:null},context(poison));assert.equal(pass.status,'passed');assert.equal(poison.skills[0].remaining,1);
 const used=abilities.useConfirmedAbility(poison,id,{requestId:'self',night:3,target:1},context(poison));if(used.status!=='used')throw Error('poison');assert.equal(used.abilities.skills[0].remaining,0);
 assert.throws(()=>abilities.useConfirmedAbility(used.abilities,id,{requestId:'twice',night:3,target:2},context(used.abilities)),/ALREADY_COMMITTED/);
 assert.throws(()=>abilities.useConfirmedAbility(used.abilities,id,{requestId:'spent',night:4,target:2},context(used.abilities)),/SKILL_EXHAUSTED/);
 const extra=learned('wolf').abilities;const knife=extra.skills[0].id;
 assert.throws(()=>abilities.useConfirmedAbility(extra,knife,{requestId:'locked',night:3,target:1},context(extra)),/KNIFE_NOT_INHERITED/);
 const unlocked=abilities.useConfirmedAbility(extra,knife,{requestId:'self',night:3,target:1},{...context(extra),inheritedWolfKnife:true});assert.equal(unlocked.status,'used');
});

test('hunter copies shoot immediately only after settled playing victory and eligible death without poison',()=>{
 const shot=learned('hunter').abilities;const id=shot.skills[0].id;const ctx=context(shot);ctx.players[0].alive=false;
 const allowed={...ctx,settledVictory:{status:'playing'} as const,deathCauses:['wolf-knife'] as const};
 assert.equal(abilities.useConfirmedAbility(shot,id,{requestId:'shot',night:2,target:2},allowed).status,'used');
 assert.equal(abilities.useConfirmedAbility(shot,id,{requestId:'shot',night:2,target:2},{...allowed,deathCauses:['exile']}).status,'used');
 assert.throws(()=>abilities.useConfirmedAbility(shot,id,{requestId:'poison',night:2,target:2},{...allowed,deathCauses:['wolf-knife','poison']}),/SHOT_NOT_AUTHORIZED/);
 assert.throws(()=>abilities.useConfirmedAbility(shot,id,{requestId:'ended',night:2,target:2},{...allowed,settledVictory:{status:'ended',winner:'wolves',reason:'all-gods-dead'}}),/SHOT_NOT_AUTHORIZED/);
 assert.equal(abilities.useConfirmedAbility(shot,id,{requestId:'unknown',night:2,target:2},{...allowed,settledVictory:{status:'unresolved',questionId:'pending'}}).status,'blocked');
 assert.throws(()=>abilities.useConfirmedAbility(shot,id,{requestId:'unsettled',night:2,target:2},ctx),/SHOT_NOT_AUTHORIZED/);
 assert.throws(()=>abilities.useConfirmedAbility(shot,id,{requestId:'living',night:2,target:2},{...allowed,players:context(shot).players}),/SHOT_NOT_AUTHORIZED/);
});

test('newboard witch never uses both medicines and selfsave decisions are explicit',()=>{
 const witch=player(1,'witch').abilities;const antidote=witch.skills[0].id;const poison=witch.skills[1].id;const ctx={...context(witch),witchKnifeTarget:1};
 assert.throws(()=>abilities.useConfirmedAbility(witch,antidote,{requestId:'first',night:1,target:1},ctx),/WITCH_SELF_SAVE_FORBIDDEN/);
 assert.throws(()=>abilities.useConfirmedAbility(witch,antidote,{requestId:'later',night:2,target:1},ctx),/WITCH_SELF_SAVE_FORBIDDEN/);
 assert.throws(()=>abilities.useConfirmedAbility(witch,antidote,{requestId:'wrong',night:2,target:3},{...ctx,witchKnifeTarget:2}),/INVALID_TARGET/);
 const poisoned=abilities.useConfirmedAbility(witch,poison,{requestId:'poison',night:2,target:2},ctx);if(poisoned.status!=='used')throw Error('poison');
 assert.throws(()=>abilities.useConfirmedAbility(poisoned.abilities,antidote,{requestId:'both',night:2,target:2},{...ctx,witchKnifeTarget:2}),/WITCH_TWO_MEDICINES/);
});

test('copy projection rejects incompatible rulesets and unconfirmed chains without mutating source inventory',()=>{
 const guard=player(2,'guard').abilities;const projected=abilities.projectMechanicalCopyProfile(guard,'mechanicalWolf','mechanical-seer');
 assert.equal('status' in projected,false);assert.equal(guard.skills[0].parameters.protection,'ordinary');
 assert.throws(()=>abilities.projectMechanicalCopyProfile(guard,'villager','mechanical-seer'),/INVALID_SKILL_STATE/);
 assert.throws(()=>abilities.projectMechanicalCopyProfile(guard,'armoredWolf','mechanical-seer'),/INVALID_SKILL_STATE/);
 assert.throws(()=>abilities.projectMechanicalCopyProfile(guard,'mechanicalWolf','standard'),/INVALID_SKILL_STATE/);
 const chain=player(2,'armoredWolf','mechanical-armor').abilities;chain.mimickedRole='witch';assert.equal('status' in abilities.projectMechanicalCopyProfile(chain,'mechanicalWolf','mechanical-armor'),true);
 assert.throws(()=>abilities.createNativeAbilityProfile('guard',0,'mechanical-seer'),/INVALID_SKILL_STATE/);
 const actors=[player(1,'mechanicalWolf'),player(2,'witch')];actors[1].abilities.ownerSeat=3;
 assert.throws(()=>abilities.learnMechanicalAbility(actors,1,2,metadata),/INVALID_SKILL_STATE/);
 assert.throws(()=>abilities.learnMechanicalAbility([player(1,'mechanicalWolf'),player(2,'witch')],1,2,{...metadata,at:-1}),/INVALID_SKILL_STATE/);
});

test('learning actual-source snapshot freezes nested parameters and copy profile independently',()=>{
 const actors=[player(1,'mechanicalWolf'),player(2,'witch')];actors[1].abilities.skills[1].parameters.metadata={tags:['source']};
 const result=abilities.learnMechanicalAbility(actors,1,2,metadata);if(result.status!=='learned')throw Error('learn');
 (actors[1].abilities.skills[1].parameters.metadata as {tags:string[]}).tags.push('changed');
 assert.deepEqual(result.learning.sourceSnapshot.skills[1].parameters.metadata,{tags:['source']});
 assert.deepEqual(result.learning.copyProfileSnapshot.skills[0].parameters.metadata,{tags:['source']});
 (result.learning.copyProfileSnapshot.skills[0].parameters.metadata as {tags:string[]}).tags.push('profile-only');
 assert.deepEqual(result.abilities.skills[0].parameters.metadata,{tags:['source']});
});


test('extra knife learning-night timing returns explicit decision block without choosing delayed activation',()=>{
 const extra=learned('wolf').abilities;const id=extra.skills[0].id;
 assert.equal(extra.skills[0].availableFromNight,2);
 assert.deepEqual(abilities.useConfirmedAbility(extra,id,{requestId:'same-night',night:2,target:1},{...context(extra),inheritedWolfKnife:true}),{status:'blocked',reason:'product-decision',questionIds:['MA-COPY-EXTRA-KNIFE-LEARNING-NIGHT']});
 assert.equal(extra.skills[0].remaining,1);assert.equal(extra.skills[0].uses.length,0);
 assert.equal(abilities.useConfirmedAbility(extra,id,{requestId:'later',night:3,target:1},{...context(extra),inheritedWolfKnife:true}).status,'used');
});


test('seer camp inspection of real mixed-blood returns good while exact copied identity stays mixed-blood',()=>{
 const seer=player(1,'seer').abilities;const ctx=context(seer);ctx.players[1]=player(2,'mixer');
 const result=abilities.useConfirmedAbility(seer,seer.skills[0].id,{requestId:'camp',night:1,target:2},ctx);
 assert.equal(result.status,'used');if(result.status!=='used')throw Error('inspection');
 assert.deepEqual(result.inspection,{status:'camp',camp:'good'});
 const mechanical=player(2,'mechanicalWolf');mechanical.abilities=learned('mixer').abilities;mechanical.abilities.ownerSeat=2;
 assert.deepEqual(abilities.visibleInspectionRole(mechanical),{status:'visible',role:'mixer'});
});

test('exhausted poison permits nextnight pass without restoring charges or enabling another target',()=>{
 const poison=learned('witch').abilities;const id=poison.skills[0].id;
 const result=abilities.useConfirmedAbility(poison,id,{requestId:'use',night:3,target:2},context(poison));if(result.status!=='used')throw Error('poison');
 assert.deepEqual(abilities.useConfirmedAbility(result.abilities,id,{requestId:'pass',night:4,target:null},context(result.abilities)),{status:'passed',abilities:result.abilities});
 assert.throws(()=>abilities.useConfirmedAbility(result.abilities,id,{requestId:'spent',night:4,target:2},context(result.abilities)),/SKILL_EXHAUSTED/);
});

test('extra knife nullpass bypasses inheritedknife and samelearningnight decisions without spending inventory',()=>{
 const extra=learned('wolf').abilities;const id=extra.skills[0].id;
 assert.deepEqual(abilities.useConfirmedAbility(extra,id,{requestId:'learning-pass',night:2,target:null},context(extra)),{status:'passed',abilities:extra});
 const used=abilities.useConfirmedAbility(extra,id,{requestId:'use',night:3,target:2},{...context(extra),inheritedWolfKnife:true});if(used.status!=='used')throw Error('extra');
 assert.deepEqual(abilities.useConfirmedAbility(used.abilities,id,{requestId:'spent-pass',night:4,target:null},context(used.abilities)),{status:'passed',abilities:used.abilities});
 assert.throws(()=>abilities.useConfirmedAbility(used.abilities,id,{requestId:'spent',night:4,target:2},{...context(used.abilities),inheritedWolfKnife:true}),/SKILL_EXHAUSTED/);
});
