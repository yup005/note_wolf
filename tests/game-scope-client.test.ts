import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptRoomActionView} from '../apps/web/src/useRoom.js';
import {api} from '../apps/web/src/api.js';
test('a request transmits its captured game id without a global current-game lookup',async()=>{
 const previous=globalThis.fetch;let actual:HeadersInit|undefined;
 globalThis.fetch=async(_input,init)=>{actual=init?.headers;return new Response('{}',{status:200});};
 try{await api('/api/rooms/synthetic/identity',undefined,{gameId:'captured-first-game'});assert.equal(new Headers(actual).get('X-Wolf-Game-Id'),'captured-first-game');}
 finally{globalThis.fetch=previous;}
});
test('old game action cannot replace current membership even when its response arrives late',()=>{
 const current={room:{id:'same-room',gameId:'new-game',revision:30},me:{id:'current-member'}};
 const old={room:{id:'same-room',gameId:'old-game',revision:20},me:{id:'old-member'}};
 assert.deepEqual(acceptRoomActionView(current,old),current);
});
