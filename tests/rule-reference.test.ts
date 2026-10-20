import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardRuleVersion,type RoomBoardSnapshot} from '../packages/contracts/board.js';
import {boardPreset,createBoardConfiguration} from '../packages/domain/boardConfig.js';
import {buildRuleReference,copiedRoleNotes} from '../packages/domain/ruleReference.js';
function board(id:'standard-12'|'mechanical-12'|'mechanical-armor-12'):RoomBoardSnapshot{
 const c=boardPreset(id);return {id,name:id,ruleVersion:boardRuleVersion,composition:{seatCount:c.seatCount,roleCounts:c.roles,ruleset:c.ruleset,playable:c.playable}};
}
function custom(roles:Record<string,number>,idiotPolicy?:'dual-category-14'):RoomBoardSnapshot{
 const c=createBoardConfiguration({seatCount:Object.values(roles).reduce((sum,n)=>sum+n,0),roles,...(idiotPolicy?{idiotPolicy}:{})});return {id:'synthetic-custom',name:'自定义',ruleVersion:boardRuleVersion,composition:{seatCount:c.seatCount,roleCounts:c.roles,ruleset:c.ruleset,playable:c.playable,...(idiotPolicy?{idiotPolicy}:{})}};
}
test('rule reference uses public composition, keeps all standard roles, and never projects injected live secrets',()=>{
 const input=board('standard-12'),reference=buildRuleReference(input);assert.equal(reference.supported,true);assert.equal(reference.roles.reduce((sum,r)=>sum+r.count,0),12);assert.equal(reference.roles.length,6);
 const witch=reference.roles.find(r=>r.role==='witch')!;assert.match(witch.notes.join(' '),/不能自救/);assert.match(witch.notes.join(' '),/各全局一次/);assert.match(witch.notes.join(' '),/之后最多30秒/);
 const poisoned={...input,seats:[{seat:7,role:'witch'}],target:9,learnedRole:'seer',remaining:0,privateNotes:'SYNTHETIC_SECRET',alive:[2]};assert.deepEqual(buildRuleReference(poisoned),reference);
 assert.equal(JSON.stringify(reference).includes('SYNTHETIC_SECRET'),false);assert.deepEqual(input,board('standard-12'));
});
test('mechanical and armor guides distinguish reflection from invincibility and preserve copy timing and knife restrictions',()=>{
 const mechanical=buildRuleReference(board('mechanical-12')),armor=buildRuleReference(board('mechanical-armor-12'));
 const m=mechanical.roles.find(r=>r.role==='mechanicalWolf')!.notes.join(' '),a=armor.roles.find(r=>r.role==='mechanicalWolf')!.notes.join(' ');
 assert.match(m,/弹毒/);assert.doesNotMatch(m,/无敌盾/);assert.match(m,/女巫之后/);assert.match(m,/下一夜/);
 assert.match(a,/无敌盾/);assert.match(a,/不弹毒/);assert.match(a,/奶穿/);assert.match(a,/继承普通狼刀后才解锁/);
 assert.match(armor.roles.find(r=>r.role==='armoredWolf')!.notes.join(' '),/独立完整次数/);
 assert.match(buildRuleReference(custom({...boardPreset('mechanical-12').roles,idiot:1})).mechanics.join(' '),/最后一狼被放逐翻牌.*追加一夜/);
 assert.match(copiedRoleNotes('witch','mechanical-seer').join(' '),/没有解药/);assert.match(copiedRoleNotes('hunter','mechanical-armor').join(' '),/当夜生效/);
 assert.match(copiedRoleNotes('armoredWolf','mechanical-armor').join(' '),/已拟态.*冻结.*独立完整次数/);
});
test('fourteen players alone do not imply dual idiot, and custom pending interactions remain explicit',()=>{
 const roles={wolf:4,villager:6,seer:1,witch:1,hunter:1,idiot:1},ordinary=buildRuleReference(custom(roles)),dual=buildRuleReference(custom(roles,'dual-category-14'));
 assert.match(ordinary.roles.find(r=>r.role==='idiot')!.notes.join(' '),/15秒插嘴/);assert.match(dual.roles.find(r=>r.role==='idiot')!.notes.join(' '),/神边算死、民边仍活/);assert.match(dual.roles.find(r=>r.role==='idiot')!.notes.join(' '),/禁发言、插嘴、投票/);assert.match(dual.cautions.join(' '),/需要裁决/);
});
test('mixed blood civilian thresholds distinguish the standard variant from expanded boards and wolf-free manual recording',()=>{
 const standard=buildRuleReference(custom({wolf:4,villager:3,mixer:1,seer:1,witch:1,hunter:1,idiot:1})),expanded=buildRuleReference(custom({...boardPreset('mechanical-12').roles,mixer:1}));
 assert.match(standard.mechanics.join(' '),/四个民职必须全部出局/);assert.doesNotMatch(standard.mechanics.join(' '),/仅剩一人/);assert.match(expanded.mechanics.join(' '),/普通村民仅剩一人/);
 assert.match(buildRuleReference(custom({villager:2,mixer:1})).mechanics.join(' '),/不判胜负/);assert.match(buildRuleReference(custom({wolf:2})).mechanics.join(' '),/不能正常发牌/);
});
test('unsupported versions, unknown roles, count mismatch and inconsistent rulesets refuse to invent rules',()=>{
 const b=board('standard-12');for(const input of [{...b,ruleVersion:'future-version'}, {...b,composition:{...b.composition,ruleset:'mechanical-armor'}},{...b,composition:{...b.composition,roleCounts:{nineTail:12}}},{...b,composition:{...b.composition,seatCount:13}}]){
  const r=buildRuleReference(input as RoomBoardSnapshot);assert.equal(r.supported,false);assert.deepEqual(r.roles,[]);assert.deepEqual(r.mechanics,[]);assert.match(r.cautions.join(' '),/尚未支持/);
 }
});
