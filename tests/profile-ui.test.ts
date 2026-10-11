import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AccountDialog} from '../apps/web/src/AccountDialog.js';

test('logged-in account menu exposes profile editor without replacing sign-out action',()=>{
 const html=renderToStaticMarkup(createElement(AccountDialog,{account:{id:'synthetic',username:'profile_test',nickname:'资料玩家',role:'user',status:'active',createdAt:1},onClose:()=>{},onSession:()=>{},onProfileSession:()=>{}}));
 assert.match(html,/编辑资料/);assert.match(html,/退出登录/);
});

test('avatar chooser enforces ordinary, active VIP and expired VIP limits before upload',async()=>{
 const {avatarFileError}=await import('../apps/web/src/ProfileEditor.js');
 const account={id:'synthetic',username:'profile_test',nickname:'资料玩家',role:'user' as const,status:'active' as const,createdAt:1};
 assert.equal(avatarFileError({type:'image/png',size:1024*1024},account),'');
 assert.match(avatarFileError({type:'image/png',size:1024*1024+1},account),/1 MB/);
 assert.equal(avatarFileError({type:'image/webp',size:2*1024*1024},{...account,vip:{active:true,expiresAt:null}}),'');
 assert.match(avatarFileError({type:'image/jpeg',size:2*1024*1024+1},{...account,vip:{active:true,expiresAt:Date.now()+60000}}),/2 MB/);
 assert.match(avatarFileError({type:'image/png',size:1024*1024+1},{...account,vip:{active:true,expiresAt:Date.now()-60000}}),/1 MB/);
 assert.match(avatarFileError({type:'image/svg+xml',size:100},account),/JPEG、PNG 或 WebP/);
 assert.match(avatarFileError({type:'image/png',size:0},account),/为空/);
});
