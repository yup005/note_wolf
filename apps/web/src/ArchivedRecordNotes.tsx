import {useEffect,useState} from 'react';
import type {RecordList} from '../../../packages/contracts/records';
import {api,errorText} from './api';
import {RecordPostDialog} from './RecordPostDialog';
/** Old archives can retain facts and notes without retaining a complete board. */
export function ArchivedRecordNotes({gameId,onClose}:{gameId:string;onClose:()=>void}){
 const [data,setData]=useState<RecordList>(),[notes,setNotes]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[post,setPost]=useState<string>();
 const base=`/api/games/${gameId}`;
 useEffect(()=>{let active=true;void api<RecordList>(base+'/records').then(result=>{if(active){setData(result);setNotes(result.own?.document.notes??'');}}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[base]);
 async function save(publish=false){
  if(busy||!data?.own)return;setBusy(true);setError('');setNotice('');
  try{
   const d=await api<NonNullable<RecordList['own']>>(base+'/record',{revision:data.own.revision,document:{...data.own.document,notes}});
   if(publish)await api(base+'/record/publish',{revision:d.revision});
   const result=await api<RecordList>(base+'/records');setData(result);setNotes(result.own?.document.notes??'');setNotice(publish?'已发布当前版本':'笔记已保存，仅你可见');
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 return <div className="modal-backdrop"><section className="card modal record-editor" role="dialog" aria-modal="true" aria-labelledby="legacy-record-title"><div className="section-head"><h2 id="legacy-record-title">独立对局记录</h2><button className="text-button" disabled={busy} onClick={onClose}>关闭</button></div><div className="record-editor-body"><p className="helper">旧归档未保留完整板子配置。可编辑本人笔记、查看和发布版本；原官方事实保留。</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{!data?<p role="status">正在读取…</p>:<>{data.own&&<><label>个人推理与补充<textarea aria-label="个人推理与补充" maxLength={2000} rows={6} value={notes} disabled={busy||!data.canRecord} onChange={e=>setNotes(e.target.value)}/></label>{data.canRecord&&<><button className="secondary full" disabled={busy} onClick={()=>void save()}>保存笔记</button><button className="primary full" disabled={busy} onClick={()=>void save(true)}>发布当前版本</button></>}</>}{data.posts.map(item=><button className="secondary full" key={item.id} onClick={()=>setPost(item.id)}>{item.official?'官方':'个人'} · {item.author} · 版本 {item.version}</button>)}</>}</div>{post&&<RecordPostDialog id={post} onClose={()=>setPost(undefined)}/>}</section></div>;
}
