import type {SharedRecord} from '../../../packages/contracts/sharing';
import {roleLabels} from '../../../packages/contracts/labels';
import {PublishedRecordContent,outcomeLabel} from './RecordPostDialog';
export function SharedRecordContent({post}:{post:SharedRecord}){
 return <><p className="helper">{post.author} · 房间 {post.code} · 版本 {post.version}</p><p className="replay-winner">{outcomeLabel(post.officialUpdate?post.officialUpdate.current.outcome:post.outcome,post.officialUpdate?.current.outcomeSource??post.outcomeSource)}{(post.officialUpdate?.current.outcomeSource??post.outcomeSource)==='host-adjudicated'&&<span> · 房主人工裁定</span>}</p>{!post.official&&<p className="helper">个人版本，官方结果以房主为准。</p>}<section className="replay-identities"><h2>本局身份</h2><div className="replay-roles">{post.roles.map(p=><span key={p.seat}>{p.seat} 号 · {roleLabels[p.role]}</span>)}</div></section><PublishedRecordContent post={post}/><p className="helper shared-foot">只读分享 · 个人正文展示最新发布版本{post.official?'，已提交官方事实自动同步':''}</p></>;
}
