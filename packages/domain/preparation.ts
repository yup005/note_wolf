import {randomInt} from 'node:crypto';
import {LobbyError,type PublicSeat,type Role} from '../contracts/index.js';
import type {BoardConfiguration} from '../contracts/board.js';
import {assertPlayableBoard,boardPreset} from './boardConfig.js';
export function createDeck(board:BoardConfiguration=boardPreset('standard-12')):Role[]{
 const config=assertPlayableBoard(board);
 const deck=Object.entries(config.roles).flatMap(([role,count])=>Array<Role>(count).fill(role as Role));
 for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 return deck;
}
export function rolesMatchBoard(roles:readonly Role[],board:BoardConfiguration=boardPreset('standard-12')):boolean{
 const config=assertPlayableBoard(board);
 return roles.length===config.seatCount&&Object.entries(config.roles).every(([role,count])=>roles.filter(r=>r===role).length===count);
}
export function assertCanDeal(seats:readonly PublicSeat[],board:BoardConfiguration=boardPreset('standard-12')):void{
 const config=assertPlayableBoard(board);
 if(!seats.some(s=>s.memberId&&s.isHost))throw new LobbyError('HOST_NOT_SEATED',409);
 if(seats.length!==config.seatCount||seats.some(s=>!s.memberId))throw new LobbyError('ROOM_NOT_FULL',409);
 if(seats.some(s=>!s.ready))throw new LobbyError('NOT_ALL_READY',409);
}
