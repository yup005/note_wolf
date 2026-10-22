import type {BoardRole} from '../contracts/board.js';
import type {PlayerStatistics,StatisticsCount} from '../contracts/statistics.js';
/** Server-only admitted facts. Owner/seat admission is checked before building these. */
export interface StatisticsEvidence {
 gameId:string;ended:boolean;ordinary:boolean;role:BoardRole;camp:'wolves'|'good'|null;winner:'wolves'|'good'|null;
 board:{key:string;name:string};
}
const empty=():StatisticsCount=>({played:0,resolved:0,wins:0,losses:0,winRate:null});
function count(out:StatisticsCount,game:StatisticsEvidence){
 out.played++;if(game.camp!==null&&game.winner!==null){out.resolved++;if(game.camp===game.winner)out.wins++;else out.losses++;}
 out.winRate=out.resolved?out.wins/out.resolved:null;
}
/** Recompute per immutable game; publications, favorites and repeated reads are not games. */
export function aggregateStatistics(evidence:readonly StatisticsEvidence[]):PlayerStatistics{
 const total=empty(),seen=new Set<string>(),roles=new Map<BoardRole,StatisticsCount>(),boards=new Map<string,{name:string;played:number}>();
 for(const game of evidence){
  if(!game.ended||!game.ordinary||seen.has(game.gameId))continue;seen.add(game.gameId);count(total,game);
  const role=roles.get(game.role)??empty();count(role,game);roles.set(game.role,role);
  const board=boards.get(game.board.key)??{name:game.board.name,played:0};board.played++;boards.set(game.board.key,board);
 }
 return {...total,unresolved:total.played-total.resolved,roles:[...roles].map(([role,value])=>({role,...value})).sort((a,b)=>b.played-a.played||a.role.localeCompare(b.role)),boards:[...boards.values()].sort((a,b)=>b.played-a.played||a.name.localeCompare(b.name,'zh-CN')).slice(0,5)};
}
