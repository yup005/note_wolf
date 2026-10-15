import type {AdminAuditItem,AdminFilter,AdminKind} from '../../../packages/contracts/admin';
import {ApiError} from './api';
export type FilterDraft={q:string;from:string;to:string;action:string;status:string};
export const emptyAdminFilter:FilterDraft={q:'',from:'',to:'',action:'',status:''};
export function adminFilter(draft:FilterDraft,kind:AdminKind):AdminFilter{
 const filter:AdminFilter={};if(draft.q.trim())filter.q=draft.q.trim();
 if(draft.from)filter.from=new Date(draft.from+'T00:00:00').getTime();
 if(draft.to){const end=new Date(draft.to+'T00:00:00');end.setDate(end.getDate()+1);filter.to=end.getTime();}
 if(filter.from!==undefined&&!Number.isSafeInteger(filter.from)||filter.to!==undefined&&!Number.isSafeInteger(filter.to)||filter.from!==undefined&&filter.to!==undefined&&filter.from>=filter.to)throw new Error('请选择有效的起止日期');
 if(kind==='audit'&&draft.action)filter.action=draft.action as AdminFilter['action'];
 if(kind!=='audit'&&draft.status)filter.status=draft.status as AdminFilter['status'];return filter;
}
export function loseAdminAuthority(e:unknown){if(e instanceof ApiError&&[401,403].includes(e.status)){window.dispatchEvent(new Event('wolf:admin-authority-lost'));return true;}return false;}
export const auditActionLabels={vip:'VIP 变更',status:'账号状态', 'share-revoke':'撤销分享',dismiss:'驳回举报',delete:'删除评论',warn:'警告',mute:'禁评',unmute:'解除禁评'};
export const shareStateLabels={active:'有效',paused:'暂停',withdrawn:'已撤回',revoked:'已撤销'};

function vipDescription(value:string):string|undefined{
 try{const state:unknown=JSON.parse(value);if(!state||typeof state!=='object'||!('enabled'in state)||typeof state.enabled!=='boolean'||!('expiresAt'in state))return;
  if(!state.enabled)return '未开通';if(state.expiresAt===null)return '永久开通';if(typeof state.expiresAt==='number'&&Number.isSafeInteger(state.expiresAt)&&state.expiresAt>=0){const date=new Date(state.expiresAt);if(Number.isFinite(date.getTime()))return '已开通，有效期至 '+date.toLocaleString('zh-CN');}
 }catch{/* Unknown historical detail gets a readable action label below. */}
}
export function auditDetail(item:Pick<AdminAuditItem,'action'|'detail'>):string{
 const parts=item.detail?.split(' → ');
 if(item.action==='vip'){
  const before=parts?.length===2?vipDescription(parts[0]):undefined,after=parts?.length===2?vipDescription(parts[1]):undefined;
  return before&&after?before+' → '+after:'VIP 权限已更新';
 }
 if(item.action==='status'){
  const labels:Record<string,string>={active:'正常',disabled:'已禁用'},before=parts?.length===2?labels[parts[0]]:undefined,after=parts?.length===2?labels[parts[1]]:undefined;
  return before&&after?before+' → '+after:'账号状态已更新';
 }
 return {'share-revoke':'当前公开分享链接已撤销',dismiss:'举报已驳回',delete:'评论正文已删除，已有回复保留',warn:'已向作者发送警告',mute:'已限制作者的评论互动',unmute:'已解除作者的评论限制'}[item.action];
}
