import type {SharedRecord} from '../../../packages/contracts/sharing';
import {roleLabels} from '../../../packages/contracts/labels';
import {RecordContent,outcomeLabel} from './RecordPostDialog';
export function SharedRecordContent({post}:{post:SharedRecord}){
 return <><p className="helper">{post.author} · 房间 {post.code} · 版本 {post.version}</p><p className="replay-winner">{outcomeLabel(post.outcome,post.outcomeSource)}{post.outcomeSource==='host-adjudicated'&&<span> · 房主人工裁定</span>}</p>{!post.official&&<p className="helper">个人版本，官方结果以房主为准。</p>}<section className="replay-identities"><h2>本局身份</h2><div className="replay-roles">{post.roles.map(p=><span key={p.seat}>{p.seat} 号 · {roleLabels[p.role]}</span>)}</div></section><RecordContent document={post.document}/><p className="helper shared-foot">只读分享 · 展示最新已发布版本</p></>;
}
