import type {Role} from './index.js';
import type {DayVoteResult,DayPublic} from './day.js';
export interface GameEvent {type:string;at:number;seat?:number;target?:number|null;command?:{action:string;[key:string]:unknown};result?:DayVoteResult}
export interface GameReplay {winner:'wolves'|'good';roles:{seat:number;role:Role}[];rounds:{kind:'night'|'day';round:number;events:GameEvent[];outcome?:{sheriff:number|null;badge:DayPublic['badge'];result:DayVoteResult|null}}[];saved?:boolean}
export interface FavoriteGame {roomId:string;code:string;winner:'wolves'|'good';savedAt:number}
