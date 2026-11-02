import {boardRoleLabels,boardRoleSchema,boardRuleVersion,isWolfRole,standardRoleCounts,type BoardRole,type IdiotPolicy,type RoomBoardSnapshot,type Ruleset} from '../contracts/board.js';
import {createBoardConfiguration,boardStartError} from './boardConfig.js';

// Static, confirmed descriptions only. Never accept a player, room state or skill inventory.
export const ruleReferenceVersion='2026-10-20-v1';
export interface RoleReference {role:BoardRole;label:string;count:number;notes:string[];source:string}
export interface RuleReference {version:string;supported:boolean;roles:RoleReference[];mechanics:string[];cautions:string[]}
const sources:Record<BoardRole,string>={dancer:'MASQ-003–005/010–012/019/026/029/033',mask:'MASQ-001/002/006/009/013–018/020/025/027/034–044',wolfGirl:'WG-002–009',poisoner:'WG-005',wolf:'N-002 / N-003 / X-001',villager:'B-001 / D-003',seer:'N-005',witch:'N-004',hunter:'N-006 / R-003',idiot:'B-002 v3',spiritSeer:'机械狼通灵师：查验与拟态',guard:'N-007',mechanicalWolf:'COPY-001 / 机械狼通灵师',armoredWolf:'COPY-001 / 机械装甲',mixer:'WIN-001 / 混血儿确认',blackWolf:'CFG-05 / 黑白狼王确认',whiteWolf:'CFG-05 / 黑白狼王确认'};

export function copiedRoleNotes(role:BoardRole,ruleset:Ruleset):string[]{
 switch(role){
  case 'dancer':case 'mask':return ['首版不支持机械/装甲复制舞者或假面。'];
  case 'wolfGirl':case 'poisoner':return ['首版不支持机械/装甲复制狼女孩或毒师。'];
  case 'wolf':return [ruleset==='mechanical-armor'?'额外普通刀全局一次，继承普通狼刀后才解锁；可与普通刀同夜选择相同或不同目标。两刀同目标可破普通盾，不能击破无敌盾。':'学习狼人后获得一次额外破盾刀，继承普通狼刀后才解锁；额外刀与普通刀分别结算。'];
  case 'armoredWolf':return ['学习装甲狼：未拟态时获得一次额外普通刀，仍须先继承普通狼刀；已拟态时冻结其当前复制能力并获得独立完整次数，沿用对应技能限制。'];
  case 'witch':return ['复制女巫仅得一瓶毒药，没有解药；学习后的下一夜起可用，全局一次，可保留。'];
  case 'guard':return [ruleset==='mechanical-armor'?'复制守卫得到无敌盾，阻挡所有狼刀与毒药，不弹毒；下一夜起可守，不能连续两夜守同一人。':'复制守卫下一夜起可守，毒药命中守护目标时弹毒；复杂反弹链仍需裁决。可自守、空守，不可连续两夜守同一人。',`${ruleset==='mechanical-armor'?'无敌盾':'反弹守护'}与解药同守同救，对普通狼刀仍算奶穿。`];
  case 'seer':return ['复制预言家从下一夜起查验好人/狼人，不显示具体身份。'];
  case 'spiritSeer':return ['复制通灵师从下一夜起查验其他存活玩家的具体身份；机械狼按当前拟态身份反馈。'];
  case 'hunter':return ['复制猎人当夜生效，独立一次开枪；狼刀或放逐死亡且未终局才可发动，有效毒杀不能开枪。'];
  case 'blackWolf':return ['复制黑狼王当夜生效，独立一次开枪；沿用黑狼王死亡来源限制，先判胜，毒杀和自爆不能开枪。'];
  case 'whiteWolf':return ['复制白狼王从学习结束后的首个白天起可自爆带人，独立一次；吞毒自爆不能带人，先判胜，正式投票及放逐PK台上不能发动。'];
  case 'idiot':return ['复制白痴不改变真实狼阵营。仅最后一狼被放逐翻牌时可追加一夜，其他存活角色正常行动；已经屠边则直接狼胜，额外夜仍未屠边则好人胜。'];
  case 'mechanicalWolf':return ['装甲狼复制已拟态机械狼时冻结当前复制能力，并获得独立完整次数；未拟态时取得一次额外普通刀，仍须先继承普通狼刀。'];
  case 'villager':case 'mixer':return ['学习村民或混血儿没有额外主动技能，不改变真实狼阵营。'];
 }
}

export function roleRuleNotes(role:BoardRole,ruleset:Ruleset,idiotPolicy:IdiotPolicy='standard'):string[]{
 switch(role){
  case 'dancer':return ['第二夜起60秒选择三人，可包含自己。整局每人最多有效入池一次，重复确认或保留重复草稿到截止会点杀舞者并取消整池，不消耗其他人名额。','合法三人舞池按当晚计算阵营杀少数方，全同则无人死亡；舞者自己在池内时三人免狼刀，舞者本人免毒但仍耗毒药。','合法部分草稿超时补满三人并私下告知完整名单；合法候选不足三人提示今晚不能舞。'];
  case 'mask':return ['真实狼阵营，与普通狼互不相认，不能自爆，免毒但仍耗毒药；三普狼全部出局后下一夜独立继承狼刀，可自刀/空刀，180秒未确认空刀。','第二夜起查验与面具共用60秒，先查是否入池，立即私下看结果，再给任意存活目标戴面具，仅翻转当晚舞池计数，真实身份/验人不变。','查验与面具各自整局不能重复目标；未入池的面具仍耗资格。重复确认或违规草稿保留到期点杀自己，停止后续技能及继承刀。','超时先采用合法已保存草稿，否则随机合法未用目标，耗尽则跳过；49A违规草稿优先处罚。结果可在本夜内私下查看，白天不开放历史查询。'];
  case 'wolfGirl':return ['首夜单独向非狼人表白一次，超时随机选择；不知道接受/拒绝或目标具体身份，狼队不知道表白目标。','平民接受成为无狼刀的狼混，身份仍为平民且查验好人；神职拒绝且不知道女孩号码。','合法发言可自爆，放逐票已统计但结果未生效也可自爆废票；女孩与尚在场的表白目标一同死亡，拒绝的神也被报复。双方无遗言，报复猎人无枪。','目标已死仍可自爆，普通死亡不连带；沿用符合条件的紧接下一夜优先指刀。整事件后判胜。'];
  case 'poisoner':return ['全局仅一瓶毒药，无解药且不知道刀口；首夜及以后都可自毒。守卫挡不住毒，毒杀猎人不能开枪。'];
  case 'villager':return ['没有夜间主动技能，白天参与发言与合法投票；按本局民边条件结算。'];
  case 'wolf':return [...(ruleset==='wolf-girl'?['首夜仅认识队友，禁止刀人；以后正常刀人。']:[]),'共享狼刀，每夜投票可修改，最高票并列随机、无人投票空刀；指定确认者可提前结束，总上限180秒，断线不改选。','合法白天可自爆；非吞毒自爆且仍有符合条件的红狼同伴时，仅紧接下一夜可优先指刀。'];
  case 'seer':return ['每夜查验一名合法存活目标，只显示好人/狼人；超时空过。白天不能重新调取历史查验结果。'];
  case 'witch':return ['解药、毒药各全局一次，同一晚不能并用，任何夜晚不能自救。解药用过后不再显示狼刀目标。','被刀当夜仍可用毒；普通守卫不挡毒。同守同救奶穿，解药仍消耗。首夜最多60秒，之后最多30秒，超时不用药。'];
  case 'hunter':return [...(ruleset==='wolf-girl'?['被狼女孩自爆报复不能开枪。']:[]),'夜间只查看开枪状态，不在夜间操作区开枪。全局一次，狼刀或放逐死亡且未终局时可选择发动；有效毒杀（含刀毒同时命中）不能开枪。','真正发动后线下指定目标，由房主录入；先判胜，最后一神死亡已使狼胜时不能开枪。'];
  case 'idiot':return idiotPolicy==='dual-category-14'?['本局显式启用双边白痴：放逐翻牌后神边算死、民边仍活；禁发言、插嘴、投票及再次放逐，仍可被刀或毒杀。']:['放逐时公开翻牌，神边算出局，不再投票或正常发言；其他玩家每个发言回合仍有独立累计15秒插嘴，不占原发言时间。','被刀、被毒等死亡不因白痴身份额外公开翻牌；不能仅凭人数启用双边政策。'];
  case 'guard':return ['每夜最多守护一名存活玩家，可自守或空守，不能连续两晚守同一人；空守隔开后可重新守原目标。','普通守护挡狼刀、不挡毒；同守同救奶穿。'];
  case 'spiritSeer':return ['每夜查验其他存活玩家的具体身份，可空验、可重复查同一人；机械狼未学习显示机械狼，学习后显示拟态角色。结果仅本人可见。'];
  case 'mechanicalWolf':return ['真实阵营始终为狼，与共享狼刀组互不认识。可推迟学习，成功学习一次后锁定，只能选择其他存活玩家。','从第一夜起固定在女巫之后行动，不因学习、死亡或技能耗尽改变公开顺序；继承普通狼刀后在狼人阶段单独出刀。',...copiedRoleNotes('guard',ruleset),...copiedRoleNotes('wolf',ruleset),...(ruleset==='mechanical-armor'?copiedRoleNotes('armoredWolf',ruleset):[]),'复制女巫只有一毒无解药；查验/毒药/守护下一夜起，复制猎人或黑狼王当夜起，白狼王首个白天起。次数与实际使用资格分别校验。'];
  case 'armoredWolf':return ['采用机械装甲规则，在机械狼之后固定行动；与普通狼互不认识，不能普通自爆。学习可空过，成功一次后锁定，只能选其他存活玩家。','共享狼刀组和机械狼全部出局后才继承普通狼刀；继承后可自刀或空刀。',...copiedRoleNotes('mechanicalWolf',ruleset),...copiedRoleNotes('guard',ruleset),'复制其他角色沿用对应的已确认时点和限制，复制不会改变真实阵营。'];
  case 'mixer':return ['第一夜私下选择其他玩家作榜样，超时随机指定合法榜样；榜样确定后不再更换，即使榜样出局仍跟随其原阵营获胜。','白天只向本人显示榜样座位，不公开榜样或阵营；没有额外主动技能。民边结算须区分标准3民1混变体与扩展板。'];
  case 'blackWolf':return ['真实狼阵营，加入共享狼刀组；每人独立一次开枪。狼刀、放逐、枪杀或白狼王带走可按资格发动；毒杀、自爆不可。先判胜，终局不发动。'];
  case 'whiteWolf':return ['真实狼阵营，加入共享狼刀组；每人独立一次自爆带人，先判胜、未终局才带走其他身体存活目标。正式投票及放逐PK台上禁止发动。','已中毒未公告时警上可吞毒自爆，但不能带人；目标由房主依线下指定录入。'];
 }
}

export function buildRuleReference(board:RoomBoardSnapshot):RuleReference{
 const unsupported:RuleReference={version:ruleReferenceVersion,supported:false,roles:[],mechanics:[],cautions:['此规则版本或配置尚未支持速查，请核对已确认规则并由现场裁决；不能据此推断玩法。']};
 if(board.ruleVersion!==boardRuleVersion)return unsupported;
 let config;try{config=createBoardConfiguration({seatCount:board.composition.seatCount,roles:board.composition.roleCounts,...(board.composition.idiotPolicy?{idiotPolicy:board.composition.idiotPolicy}:{})});}catch{return unsupported;}
 if(config.ruleset!==board.composition.ruleset||['wolf-girl','masquerade'].includes(config.ruleset)&&boardStartError(config)!==null)return unsupported;
 const roles=boardRoleSchema.options.filter(role=>(config.roles[role]??0)>0).map(role=>({role,label:boardRoleLabels[role],count:config.roles[role]!,notes:roleRuleNotes(role,config.ruleset,config.idiotPolicy),source:sources[role]}));
 const wolves=roles.reduce((sum,r)=>sum+(isWolfRole(r.role)?r.count:0),0);
 const mechanics=['规则说明不表示任何座位的身份、存活状态、行动目标或技能余量。','各角色保留固定夜间阶段；角色间闭眼5秒，不从阶段是否出现推断角色存活。','普通投票每轮开始前选择方式、时长和公开程度；已开始阶段设置锁定，未结算前不展示票型。'];
 if(wolves===0)mechanics.push('没有任何狼角色：只允许纯手动记录，房主确认结束，不判胜负。');
 else if(wolves===config.seatCount)mechanics.push('只有狼角色的配置不能正常发牌或开局。');
 else if(config.ruleset==='masquerade')mechanics.push('首夜狼人180秒→女巫60秒→预言家30秒；以后舞者60秒→假面共60秒→狼人/继承刀180秒→预言家30秒→女巫30秒，角色间闭眼5秒。','狼刀、毒药、共舞和点杀在夜末统一结算，死亡去重再判胜；双方同时满足胜利条件时狼人优先。任何夜夜末终局都跳过警长竞选，先公开死者座位，再公布胜负，不公布死因。');
 else if(config.ruleset==='wolf-girl')mechanics.push('首夜守卫→狼女孩表白→狼队相认（禁刀）→毒师→预言家→猎人→被表白者私密通知；以后不重复表白。','真狼全灭优先好人胜，即使狼混仍活或同批屠边；狼混个人胜负随狼，真实平民仍计入屠民。','女孩自爆先连带结算、必要时废放逐票，再统一判胜。');
 else mechanics.push('本局按已确认屠边条件结算；真实狼全部出局则好人胜，非空神边或民边全出局则狼人胜；已确认同夜同时达成时狼人优先。胜负确定即停止后续技能、遗言与警徽流程。');
 if(config.roles.mechanicalWolf||config.roles.armoredWolf)mechanics.push('狼刀继承按共享狼刀组 → 机械狼 → 装甲狼顺序判断；首夜无共享狼刀组时机械狼可继承。复制身份不改变真实阵营。');
 if(config.roles.idiot&&(config.roles.mechanicalWolf||config.roles.armoredWolf))mechanics.push(...copiedRoleNotes('idiot',config.ruleset));
 if(config.roles.mixer){const variant={...standardRoleCounts,villager:3,mixer:1};const standardMixer=config.seatCount===12&&Object.entries(variant).every(([r,n])=>config.roles[r as BoardRole]===n);mechanics.push(standardMixer?'本局是12人3民1混血儿变体：四个民职必须全部出局，不套用扩展板的留一民条件。':'扩展混血儿民边：混血儿出局且普通村民仅剩一人，或混血儿成为最后民职时，满足已确认屠民条件；个人胜负仍跟随榜样原阵营。');}
 const cautions=['wolf-girl','masquerade'].includes(config.ruleset)?['首版仅支持官方12人阵容及同阵容副本，不支持与机械或其他角色混搭。']:config.ruleset!=='standard'||!['standard-12','seer-witch-hunter-idiot-12'].includes(board.id)?['自定义与机械组合仅展示已确认单项规则；未定义复制、反弹链或伤害交互需要裁决，配置可保存不代表所有组合已支持。']:[];
 return {version:ruleReferenceVersion,supported:true,roles,mechanics,cautions};
}
