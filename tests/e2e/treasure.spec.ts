import {test,expect} from '@playwright/test';
import {loginTestAdmin} from './helpers/test-admin';

test('treasure mode preview needs confirmation and mobile picker describes the pool without inventing in-play counts',async({page})=>{
 await loginTestAdmin(page);const r=await page.request.post('/api/rooms',{data:{nickname:'Synthetic treasure UI',requestId:crypto.randomUUID()}});const {room}=await r.json();
 await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.reload();
 await page.getByRole('button',{name:'更换板子',exact:true}).click();await page.getByRole('radio',{name:'12 人 · 盗宝大师',exact:true}).check();await page.getByRole('button',{name:'确认板子',exact:true}).click();
 const mode=page.getByLabel('盗宝模式',{exact:true});await expect(mode).toHaveValue('fixed-wolf');await mode.selectOption('random');
 let view=await(await page.request.get('/api/rooms/'+room.id)).json();expect(view.room.board.composition.treasureMode).toBe('fixed-wolf');
 await page.getByRole('button',{name:'确认盗宝模式 · 全员重新准备',exact:true}).click();await expect(mode).toHaveValue('random');
 view=await(await page.request.get('/api/rooms/'+room.id)).json();expect(view.room.board.composition.treasureMode).toBe('random');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:700});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
});

test('only treasure actor sees three bottom buttons, selects civilian and remains hidden from other actors',async({page})=>{
 await loginTestAdmin(page);
 const post=async(url:string,data:unknown={})=>{const r=await page.request.post(url,{data});expect(r.ok(),await r.text()).toBe(true);return r.json();};
 const {room}=await post('/api/rooms',{nickname:'Synthetic treasure night',requestId:crypto.randomUUID()}),path='/api/rooms/'+room.id;
 await post(path+'/board',{settingsRevision:0,selection:{kind:'preset',id:'treasure-12'}});
 for(const [part,data] of [['seat',{seat:1}],['test-players',{}],['ready',{ready:true,settingsRevision:1}],['deal',{}],['identity/confirm',{}],['start',{}],['night/enter',{}]] as const)await post(path+'/'+part,data);
 let view=await(await page.request.get(path)).json();const roles:Record<string,string[]>={};
 for(const s of view.room.seats){const card=await(await page.request.get(path+(s.number===1?'/identity':`/test-players/${s.memberId}/identity`))).json();(roles[card.role]??=[]).push(s.memberId);}
 for(let i=0;i<20&&view.room.night.phase!=='treasure';i++){await post(path+'/night/test-advance');view=await(await page.request.get(path)).json();}
 expect(view.room.night.phase).toBe('treasure');expect(JSON.stringify(view)).not.toContain('bottoms');
 await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.reload();await page.getByLabel('自动跟随',{exact:true}).uncheck();await page.getByLabel('操作的测试玩家').selectOption(roles.treasureMaster[0]);
 const bottoms=page.getByRole('group',{name:'选择盗宝底牌',exact:true});await expect(bottoms).toBeVisible();await expect(bottoms.getByRole('button')).toHaveCount(3);
 await page.getByLabel('操作的测试玩家').selectOption(roles.villager[0]);await expect(bottoms).toHaveCount(0);
 await page.getByLabel('操作的测试玩家').selectOption(roles.treasureMaster[0]);await expect(bottoms).toBeVisible();
 await bottoms.getByRole('button',{name:'村民',exact:true}).click();await expect(page.getByRole('heading',{name:'闭眼间隔',exact:true})).toBeVisible();await expect(bottoms).toHaveCount(0);
});

test('borrowed spirit-seer action switches controls from choosing a card to inspection',async({page})=>{
 await loginTestAdmin(page);const post=async(url:string,data:unknown={})=>{const r=await page.request.post(url,{data});expect(r.ok()).toBe(true);return r.json();};
 const {room}=await post('/api/rooms',{nickname:'Synthetic borrowed UI',requestId:crypto.randomUUID()}),path='/api/rooms/'+room.id;
 await post(path+'/board',{settingsRevision:0,selection:{kind:'preset',id:'treasure-12'}});
 for(const [part,data] of [['seat',{seat:1}],['test-players',{}],['ready',{ready:true,settingsRevision:1}],['deal',{}],['identity/confirm',{}],['start',{}],['night/enter',{}]] as const)await post(path+'/'+part,data);
 let view=await(await page.request.get(path)).json(),thief:{number:number;memberId:string}|undefined;
 for(const s of view.room.seats){const card=await(await page.request.get(path+(s.number===1?'/identity':`/test-players/${s.memberId}/identity`))).json();if(card.role==='treasureMaster')thief=s;}
 for(let i=0;i<20&&view.room.night.phase!=='treasure';i++){await post(path+'/night/test-advance');view=await(await page.request.get(path)).json();}
 const turnId=view.room.night.turnId,privateBase=path+(thief!.number===1?'/night':`/test-players/${thief!.memberId}/night`),targets=view.room.seats.filter((s:{number:number})=>s.number!==thief!.number).map((s:{number:number})=>s.number);
 let selected=false,committed=false,inspectionChoice:string|undefined;
 // Synthetic private-response fixture exercises the UI transition independently of the random bottom draw.
 const card=()=>selected?{turnId,kind:'spiritSeer',selectedCard:'spiritSeer',treasureCamp:'wolves',legalTargets:targets,skills:[{kind:'inspect',remaining:null,available:true}],committed,...(committed?{inspectionRole:'villager',target:targets[0]}:{})}:{turnId,kind:'treasure',treasureCamp:'wolves',bottoms:['villager','wolf','spiritSeer'],previousCard:null};
 await page.route('**'+privateBase+'/private',route=>route.fulfill({json:card()}));
 await page.route('**'+privateBase+'/command',async route=>{const c=route.request().postDataJSON();if(c.action==='treasure_card')selected=true;if(c.action==='ability'){inspectionChoice=c.choice;committed=true;}await route.fulfill({json:card()});});
 await page.evaluate(id=>localStorage.setItem('wolf.room',id),room.id);await page.reload();await page.getByLabel('自动跟随',{exact:true}).uncheck();await page.getByLabel('操作的测试玩家').selectOption(thief!.memberId);
 await page.getByRole('group',{name:'选择盗宝底牌'}).getByRole('button',{name:'通灵师',exact:true}).click();
 await expect(page.getByRole('button',{name:'确认查验 · 空验',exact:true})).toBeVisible();await page.getByRole('button',{name:new RegExp(`^目标 ${targets[0]} 号`)}).click();await page.getByRole('button',{name:`确认查验 · ${targets[0]} 号`,exact:true}).click();expect(inspectionChoice).toBe('inspect');await expect(page.getByRole('status',{name:'私人技能反馈'})).toContainText('村民');
});
