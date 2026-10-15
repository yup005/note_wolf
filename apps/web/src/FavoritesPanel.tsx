import {SharedFavoriteDialog} from './SharedFavoriteDialog';
import {useEffect,useRef,useState} from 'react';
import type {FavoriteLibrary,FavoriteItem,FavoriteQuery} from '../../../packages/contracts/favorites';
import {RecordPostDialog} from './RecordPostDialog';
import {api,errorText} from './api';
import {ReplayDialog} from './ReplayDialog';
export function FavoritesPanel(){
 const [shared,setShared]=useState<string>();
 const [library,setLibrary]=useState<FavoriteLibrary>();const [post,setPost]=useState<string>();const [open,setOpen]=useState<string>();
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [search,setSearch]=useState(''),[board,setBoard]=useState(''),[author,setAuthor]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[sort,setSort]=useState<'saved-desc'|'saved-asc'>('saved-desc');
 const [editing,setEditing]=useState<FavoriteItem>(),[name,setName]=useState(''),[nameError,setNameError]=useState('');
 const generation=useRef(0),mounted=useRef(true),applied=useRef<Partial<FavoriteQuery>>({});
 const locked=useRef(false);
 async function load(query:Partial<FavoriteQuery>=applied.current){
  const turn=++generation.current;setLoading(true);setError('');const params=new URLSearchParams();for(const [key,value] of Object.entries(query))if(value!==undefined&&value!=='')params.set(key,String(value));
  try{const data=await api<FavoriteLibrary>('/api/favorite-library'+(params.size?'?'+params.toString():''));if(mounted.current&&turn===generation.current){setLibrary(data);applied.current=query;}}
  catch(e){if(mounted.current&&turn===generation.current){setError(errorText(e));if(params.size){try{const basic=await api<FavoriteLibrary>('/api/favorite-library');if(mounted.current&&turn===generation.current&&!basic.advanced){setLibrary(basic);applied.current={};}}catch{}}}}
  finally{if(mounted.current&&turn===generation.current)setLoading(false);}
 }
 useEffect(()=>{mounted.current=true;void load();const refresh=()=>{if(document.visibilityState==='visible'&&!locked.current)void load();};document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);window.addEventListener('wolf:favorite-read',refresh);return()=>{mounted.current=false;generation.current++;document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('wolf:favorite-read',refresh);};},[]);
 function query(){
  const midnight=(day:string)=>new Date(day+'T00:00:00').getTime();let end:number|undefined;
  if(to){const date=new Date(to+'T00:00:00');date.setDate(date.getDate()+1);end=date.getTime()-1;}
  return {q:search,board,author,sort,from:from?midnight(from):undefined,to:end};
 }
 function clear(){setSearch('');setBoard('');setAuthor('');setFrom('');setTo('');setSort('saved-desc');void load({});}
 async function remove(item:FavoriteItem){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{await api(`/api/${item.kind==='game'?'favorites':item.kind==='share'?'shared-favorites':'record-favorites'}/${item.id}/remove`,{});await load();}catch(e){if(mounted.current)setError(errorText(e));}finally{locked.current=false;if(mounted.current)setBusy(false);}}
 async function rename(){if(!editing||locked.current)return;locked.current=true;setBusy(true);setNameError('');try{await api(`/api/favorite-library/${editing.kind}/${editing.id}/name`,{name,revision:editing.nameRevision});if(mounted.current)setEditing(undefined);await load();}catch(e){if(mounted.current)setNameError(errorText(e));}finally{locked.current=false;if(mounted.current)setBusy(false);}}
 async function refreshName(){if(!editing||locked.current)return;locked.current=true;setBusy(true);try{const latest=await api<FavoriteLibrary>('/api/favorite-library');if(!mounted.current)return;setLibrary(latest);const item=latest.items.find(item=>item.kind===editing.kind&&item.id===editing.id);if(!item){setNameError('此收藏已取消，请关闭后重新查看。');return;}setEditing(item);setNameError(`当前名称：${item.title}。已保留你的输入，请核对后保存。`);}catch(e){if(mounted.current)setNameError(errorText(e));}finally{locked.current=false;if(mounted.current)setBusy(false);}}
 const filtered=Object.values(applied.current).some(value=>value!==undefined&&value!==''&&value!=='saved-desc');
 return <section className="card favorites-panel" aria-label="我的收藏"><h2>我的收藏</h2>
  {library?.advanced&&<form className="favorite-filters" onSubmit={e=>{e.preventDefault();void load(query());}}>
   <label className="favorite-search">搜索收藏<input className="name-input" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)} placeholder="名称、房间号或已发布内容"/></label>
   <label>收藏板子<select value={board} onChange={e=>setBoard(e.target.value)}><option value="">全部板子</option>{library.boards.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}<option value="unknown">未记录板子</option></select></label>
   <label>收藏作者<select value={author} onChange={e=>setAuthor(e.target.value)}><option value="">全部作者</option>{library.authors.map(a=><option key={a} value={a}>{a}</option>)}</select></label>
   <label>收藏日期从<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>收藏日期至<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
   <label>收藏排序<select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="saved-desc">收藏日期 · 最新在前</option><option value="saved-asc">收藏日期 · 最早在前</option></select></label>
   <div className="favorite-filter-actions"><button className="secondary" disabled={busy||loading}>应用筛选</button><button className="text-button" type="button" disabled={busy||loading} onClick={clear}>清除筛选</button></div>
  </form>}
  {error&&<p role="alert">{error}<button className="text-button" disabled={busy||loading} onClick={()=>void load()}>重试</button></p>}
  {loading?<p className="helper" role="status">正在读取…</p>:!library?.items.length?<p className="helper">{filtered?'没有符合条件的收藏':'暂无收藏'}</p>:<div className="favorite-games">{library.items.map(item=><div className="favorite-game" key={`${item.kind}:${item.id}`}>
   <button className="favorite-open" onClick={()=>item.kind==='game'?setOpen(item.id):item.kind==='share'?setShared(item.id):setPost(item.id)}><strong>{item.title}</strong>{item.hasUpdate&&<span className="favorite-update">有更新</span>}<span>{item.detail} · {new Date(item.savedAt).toLocaleDateString('zh-CN')}</span><span>{item.board?.name??'板子未记录'}</span></button>
   <div className="favorite-item-actions">{library.advanced&&<button className="text-button" disabled={busy} onClick={()=>{setEditing(item);setName(item.customName??'');setNameError('');}}>重命名</button>}
    <button className="text-button" aria-label={item.kind==='game'?`取消收藏房间 ${item.code}`:undefined} disabled={busy} onClick={()=>void remove(item)}>{item.kind==='game'?'取消收藏':item.kind==='share'?'取消收藏分享':'取消收藏版本'}</button></div>
  </div>)}</div>}
  {editing&&<div className="modal-backdrop"><form className="card modal" role="dialog" aria-modal="true" aria-label="收藏名称" onSubmit={e=>{e.preventDefault();void rename();}}><h2>收藏名称</h2><label className="input-label">自定义名称<input autoFocus className="name-input" value={name} maxLength={80} disabled={busy} onChange={e=>setName(e.target.value)}/></label><p className="helper">最多80个字符，留空恢复默认名称。</p>{nameError&&<><p role="alert">{nameError}</p><button className="text-button full" type="button" disabled={busy} onClick={()=>void refreshName()}>读取最新名称</button></>}<button className="primary full" disabled={busy||library?.advanced===false}>保存名称</button><button className="text-button full" type="button" disabled={busy} onClick={()=>setEditing(undefined)}>取消</button></form></div>}
  {shared&&<SharedFavoriteDialog key={shared} id={shared} onClose={()=>{setShared(undefined);void load();}}/>}
  {post&&<RecordPostDialog id={post} onClose={()=>{setPost(undefined);void load();}}/>} {open&&<ReplayDialog roomId={open} favorite onClose={()=>setOpen(undefined)}/>}</section>;
}
