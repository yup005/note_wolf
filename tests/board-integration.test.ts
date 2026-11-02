import test from 'node:test';
import assert from 'node:assert/strict';
import {boardPreset,boardStartError,createBoardConfiguration} from '../packages/domain/boardConfig.js';
function composition(id:Parameters<typeof boardPreset>[0]){const {ruleset,playable,...value}=boardPreset(id);return value;}

test('integrated fixed boards retain their rules and reject unvalidated counts in both modes',()=>{
 for(const id of ['masquerade-12','treasure-12','puppet-12'] as const){
  const preset=boardPreset(id),input=composition(id);
  for(const mode of ['automatic','manual'] as const){
   assert.equal(boardStartError(createBoardConfiguration(input),mode),null,id);
   for(const count of [6,11,13,16,17]){
    const roles={...preset.roles,villager:preset.roles.villager!+count-12};
    if(roles.villager<0)continue;
    const variant=createBoardConfiguration({...input,seatCount:count,roles});
    assert.equal(variant.ruleset,preset.ruleset,id);
    assert.equal(boardStartError(variant,mode),'BOARD_NOT_IMPLEMENTED',`${id}/${count}/${mode}`);
   }
  }
 }
 const random=createBoardConfiguration({...composition('treasure-12'),treasureMode:'random'});
 assert.equal(random.ruleset,'treasure');assert.equal(random.treasureMode,'random');assert.equal(boardStartError(random),null);
 assert.equal(boardPreset('puppet-12').variant,'puppet');
 assert.equal(createBoardConfiguration({...composition('puppet-12'),variant:undefined}).ruleset,'mechanical-seer');
});

test('explicit puppet copies cannot switch engines through role inference',()=>{
 for(const id of ['masquerade-12','treasure-12'] as const){
  const edited=createBoardConfiguration({...composition(id),variant:'puppet'});
  assert.equal(edited.ruleset,'puppet');
  for(const mode of ['automatic','manual'] as const)assert.equal(boardStartError(edited,mode),'BOARD_NOT_IMPLEMENTED');
 }
});
