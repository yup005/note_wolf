import {useEffect,useId,useState} from 'react';
import type {RoomSettings} from '../../../packages/contracts/index';

interface Props {settings:RoomSettings;settingsRevision:number;blocked:boolean;testRoom:boolean;onChange:(settings:RoomSettings)=>void}
const dealOptions:{value:RoomSettings['dealMethod'];title:string;description:string}[]=[
 {value:'online',title:'线上随机发牌',description:'系统分配身份，每人私密查看'},
 {value:'physical',title:'实体牌录入',description:'线下抽牌后，各自录入身份'}
];
const modeOptions:{value:RoomSettings['gameMode'];title:string;description:string}[]=[
 {value:'automatic',title:'自动法官',description:'按规则引导夜晚和白天流程'},
 {value:'manual',title:'纯手动记录',description:'线下主持，手机记录对局'}
];

export function RoomSettingsChoices({settings,settingsRevision,blocked,testRoom,onChange}:Props){
 const id=useId();
 const [draft,setDraft]=useState({settings,revision:settingsRevision,testRoom});
 useEffect(()=>{setDraft({settings,revision:settingsRevision,testRoom});},[settingsRevision,settings.dealMethod,settings.gameMode,blocked,testRoom]);
 const valid=draft.revision===settingsRevision&&draft.testRoom===testRoom&&!blocked;
 const current=valid?draft.settings:settings;
 const changed=valid&&(current.dealMethod!==settings.dealMethod||current.gameMode!==settings.gameMode);
 return <div className="room-setting-choices">
  <fieldset className="settings-choice-group"><legend>发牌方式</legend><div className="settings-choice-grid">{dealOptions.map(option=><label className="setting-choice" key={option.value}>
   <span className="setting-choice-copy"><strong>{option.title}</strong><small id={id+'-'+option.value}>{option.description}</small></span>
   <input type="radio" name={id+'-deal'} aria-label={option.title} aria-describedby={id+'-'+option.value} checked={current.dealMethod===option.value} disabled={blocked||testRoom} onChange={()=>setDraft({settings:{...current,dealMethod:option.value},revision:settingsRevision,testRoom})}/>
  </label>)}</div>{testRoom&&<p className="setting-choice-note">测试房仅使用线上随机发牌。</p>}</fieldset>
  <fieldset className="settings-choice-group"><legend>游戏模式</legend><div className="settings-choice-grid">{modeOptions.map(option=><label className="setting-choice" key={option.value}>
   <span className="setting-choice-copy"><strong>{option.title}</strong><small id={id+'-'+option.value}>{option.description}</small></span>
   <input type="radio" name={id+'-mode'} aria-label={option.title} aria-describedby={id+'-'+option.value} checked={current.gameMode===option.value} disabled={blocked} onChange={()=>setDraft({settings:{...current,gameMode:option.value},revision:settingsRevision,testRoom})}/>
  </label>)}</div></fieldset>
  <div className="settings-draft-actions">
   <p role="status">{changed?'有未应用的修改，确认后才会生效。':'点选仅预览，确认后才会生效。'}</p>
   <div><button type="button" className="secondary" disabled={blocked||!changed} onClick={()=>setDraft({settings,revision:settingsRevision,testRoom})}>取消修改</button><button type="button" className="primary" disabled={blocked||!changed} onClick={()=>{if(changed)onChange(current);}}>确认设置</button></div>
  </div>
 </div>;
}
