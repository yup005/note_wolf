import {useEffect,useState} from 'react';
import type {Account} from '../../../packages/contracts/auth';
import type {AccountSession} from './AccountDialog';
import {api,errorText} from './api';

/** Rendering this avatar grants no access to account or game-private data. */
export function ProfileAvatar({url,nickname,className='avatar',alt=''}:{url?:string|null;nickname:string;className?:string;alt?:string}){
 const [failedUrl,setFailedUrl]=useState<string>();
 return <span className={className} aria-hidden={alt?undefined:true}>{url&&failedUrl!==url?<img className="avatar-image" src={url} alt={alt} onError={()=>setFailedUrl(url)}/>:nickname.slice(0,1)}</span>;
}
export function avatarUploadLimit(account:Account,now=Date.now()){
 return account.vip?.active&&(account.vip.expiresAt===null||account.vip.expiresAt>now)?2*1024*1024:1024*1024;
}
export function avatarFileError(file:Pick<File,'type'|'size'>,account:Account){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return '请选择 JPEG、PNG 或 WebP 图片';
 const limit=avatarUploadLimit(account);if(file.size===0)return '图片文件为空，请重新选择';
 return file.size>limit?`头像不能超过 ${limit/(1024*1024)} MB`:'';
}
async function avatarRequest(method:'POST'|'DELETE',file?:File):Promise<AccountSession>{
 const response=await fetch('/api/auth/avatar',{method,headers:file?{'Content-Type':file.type}:undefined,body:file,credentials:'same-origin'});
 const result=await response.json();if(!response.ok)throw new Error(result.message??'头像更新失败，请稍后重试');return result;
}
export function ProfileEditor({account,onBack,onSession}:{account:Account;onBack:()=>void;onSession:(session:AccountSession)=>void}){
 const [nickname,setNickname]=useState(account.nickname);const [file,setFile]=useState<File>();const [preview,setPreview]=useState<string>();
 const limit=avatarUploadLimit(account);
 const [busy,setBusy]=useState<'nickname'|'upload'|'delete'|null>(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 useEffect(()=>{if(!file){setPreview(undefined);return;}const url=URL.createObjectURL(file);setPreview(url);return ()=>URL.revokeObjectURL(url);},[file]);
 function selectFile(next?:File){setError('');setNotice('');if(!next){setFile(undefined);return;}const invalid=avatarFileError(next,account);if(invalid){setError(invalid);setFile(undefined);return;}setFile(next);}
 async function saveNickname(){
  if(busy)return;const name=nickname.trim();if(!name||name.length>24){setError('请输入 1–24 个字符的昵称');setNotice('');return;}
  setBusy('nickname');setError('');setNotice('');
  try{const session=await api<AccountSession>('/api/auth/profile',{nickname:name});onSession(session);setNickname(session.account?.nickname??name);setNotice('昵称已保存');}catch(e){setError(errorText(e));}finally{setBusy(null);}
 }
 async function changeAvatar(method:'POST'|'DELETE'){
  if(busy||method==='POST'&&!file)return;
  if(method==='POST'&&file){const invalid=avatarFileError(file,account);if(invalid){setError(invalid);setNotice('');return;}}
  setBusy(method==='POST'?'upload':'delete');setError('');setNotice('');
  try{const session=await avatarRequest(method,method==='POST'?file:undefined);onSession(session);setFile(undefined);setNotice(method==='POST'?'头像已更新':'头像已删除');}catch(e){setError(errorText(e));}finally{setBusy(null);}
 }
 return <div className="modal-backdrop"><section className="card modal account-dialog profile-editor" role="dialog" aria-modal="true" aria-labelledby="profile-title">
  <div className="section-head"><h2 id="profile-title">编辑资料</h2><button className="text-button" disabled={!!busy} onClick={onBack}>返回账号</button></div>
  {error&&<p className="night-error" role="alert">{error}</p>}{notice&&<p className="profile-status" role="status">{notice}</p>}
  <form className="profile-section" onSubmit={e=>{e.preventDefault();void saveNickname();}}><label htmlFor="profile-nickname">昵称</label><input id="profile-nickname" className="name-input" value={nickname} maxLength={24} autoComplete="nickname" disabled={!!busy} onChange={e=>{setNickname(e.target.value);setNotice('');}}/><p className="helper">1–24 个字符，保存后更新房间中的昵称。</p><button className="primary full" disabled={!!busy} type="submit">{busy==='nickname'?'保存中…':'保存昵称'}</button></form>
  <section className="profile-section" aria-label="头像设置"><h3>头像</h3><div className="profile-avatar-previews"><div><ProfileAvatar url={account.avatarUrl} nickname={account.nickname} className="profile-avatar-preview" alt="当前头像"/><p className="helper">当前头像</p></div>{preview&&<div><span className="profile-avatar-preview"><img className="avatar-image" src={preview} alt="待上传头像"/></span><p className="helper">待上传头像</p></div>}</div>
   <label className="profile-file-label" htmlFor="profile-avatar">选择头像</label><input id="profile-avatar" className="profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={e=>{selectFile(e.target.files?.[0]);e.target.value='';}}/>
   {file&&<p className="helper profile-selected-file">已选择：{file.name}</p>}
   <p className="helper">JPEG、PNG 或 WebP · 最大 {limit/(1024*1024)} MB{limit>1024*1024?'（VIP）':''}</p>
   <div className="profile-avatar-actions"><button className="secondary full" disabled={!!busy||!file} onClick={()=>void changeAvatar('POST')}>{busy==='upload'?'上传中…':'上传头像'}</button><button className="text-button full" disabled={!!busy||!account.avatarUrl} onClick={()=>void changeAvatar('DELETE')}>{busy==='delete'?'删除中…':'删除头像'}</button></div>
  </section>
 </section></div>;
}
