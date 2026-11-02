import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MasqueradeActions} from '../apps/web/src/MasqueradeActions.js';
test('insufficient unused dancer targets display cannot-dance while historical choices remain actionable',()=>{
 const html=renderToStaticMarkup(createElement(MasqueradeActions,{card:{turnId:'turn',kind:'dancer',masquerade:{danceRevision:0,draft:[],cannotDance:true}},alive:[5,6,7],blocked:false,onCommand:async()=>{}}));assert.match(html,/今晚不能舞/);assert.match(html,/aria-label="共舞目标 5 号"/);assert.doesNotMatch(html,/<button[^>]*disabled=""[^>]*aria-label="共舞目标/);
});
