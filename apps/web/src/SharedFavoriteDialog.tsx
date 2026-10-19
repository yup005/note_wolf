import {CommunityEntry} from './CommunityEntry';
import {SharedRecordContent} from './SharedRecordContent';
import {useSharedRecord} from './useSharedRecord';
export function SharedFavoriteDialog({id,onClose,focusCommentId}:{id:string;onClose:()=>void;focusCommentId?:string}){
 const {post,error,loading,refresh}=useSharedRecord(`/api/shared-favorites/${id}`,true,true);
 return <div className="modal-backdrop record-overlay"><section className="card modal record-post replay-sheet" role="dialog" aria-modal="true" aria-label="分享复盘"><div className="section-head"><h2>分享复盘</h2><button className="text-button" onClick={onClose}>关闭</button></div>{error&&<p role="alert">{error}</p>}{loading&&!post&&<p role="status">正在读取复盘…</p>}{post&&<SharedRecordContent post={post}/>}<button className="secondary full" disabled={loading} onClick={refresh}>刷新复盘</button><CommunityEntry key={id} scope={{kind:'shared-favorite',id}} available={!!post&&!loading} focusCommentId={focusCommentId}/></section></div>;
}
