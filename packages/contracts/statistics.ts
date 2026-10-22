import type {BoardRole} from './board.js';
export interface StatisticsCount {played:number;resolved:number;wins:number;losses:number;winRate:number|null}
export interface PlayerStatistics extends StatisticsCount {
 unresolved:number;
 roles:(StatisticsCount&{role:BoardRole})[];
 boards:{name:string;played:number}[];
}
