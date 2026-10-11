import {mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {LobbyStore} from '../../packages/storage/lobby.js';
import {registerSchema} from '../../packages/contracts/auth.js';
const path=process.env.WOLF_DB_PATH??resolve('.data/lobby.db');mkdirSync(dirname(path),{recursive:true});
const password=process.env.WOLF_ADMIN_PASSWORD??randomBytes(18).toString('base64url');
const input=registerSchema.parse({username:process.env.WOLF_ADMIN_USERNAME??'admin',password,nickname:'管理员'});
const store=new LobbyStore(path);
let written=false;const file=resolve('.data/admin-credentials.txt');mkdirSync(dirname(file),{recursive:true});
try{if(store.auth.adminExists())throw new Error('超级管理员已存在，不会覆盖账号或密码。');writeFileSync(file,`用户名：${input.username}\n密码：${password}\n登录后进入管理员后台。此文件仅供本地保管。\n`,{mode:0o600,flag:'wx'});written=true;await store.auth.createAccount(input.username,input.password,input.nickname,'admin');console.log('管理员已创建。凭据保存在 .data/admin-credentials.txt');}catch(error){if(written)unlinkSync(file);throw error;}finally{store.close();}
