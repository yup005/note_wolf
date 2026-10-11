import {randomInt} from 'node:crypto';
import {LobbyError,type PublicSeat,type Role} from '../contracts/index.js';
const counts:Record<Role,number>={wolf:4,villager:4,seer:1,witch:1,hunter:1,idiot:1};
export function createDeck():Role[]{
 const deck=Object.entries(counts).flatMap(([role,count])=>Array<Role>(count).fill(role as Role));
 for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 return deck;
}
export function rolesMatchBoard(roles:readonly Role[]):boolean{
 return roles.length===12&&Object.entries(counts).every(([role,count])=>roles.filter(r=>r===role).length===count);
}
export function assertCanDeal(seats:readonly PublicSeat[]):void{
 if(!seats.some(s=>s.memberId&&s.isHost))throw new LobbyError('HOST_NOT_SEATED',409);
 if(seats.length!==12||seats.some(s=>!s.memberId))throw new LobbyError('ROOM_NOT_FULL',409);
 if(seats.some(s=>!s.ready))throw new LobbyError('NOT_ALL_READY',409);
}
