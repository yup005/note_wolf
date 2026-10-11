import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voiceReplyState} from '../apps/web/src/publicVoiceTiming.js';
const response={leaseUntil:16000,serverNow:1000,revision:10,scope:'signup'};
test('an expired voice response cannot play even when its revision still matches',()=>{assert.equal(voiceReplyState(response,1000,16000,'signup',10),'expired');assert.equal(voiceReplyState(response,1000,15999,'signup',10),'current');});
test('same-stage membership and ballot revisions do not discard a valid public prompt',()=>{assert.equal(voiceReplyState(response,1000,2000,'signup',11),'current');});
test('a response for a superseded public stage is rejected while a server-ahead phase remains valid',()=>{assert.equal(voiceReplyState(response,1000,2000,'voting',11),'stale');assert.equal(voiceReplyState({...response,revision:12},1000,2000,'voting',11),'current');});
