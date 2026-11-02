import {dealPuppetDeck} from './puppet.js';
import {randomInt} from 'node:crypto';
import {LobbyError,type PublicSeat,type Role} from '../contracts/index.js';
import type {BoardConfiguration} from '../contracts/board.js';
import {assertPlayableBoard,boardPreset,createBoardConfiguration} from './boardConfig.js';
export function createDeck(board:BoardConfiguration=boardPreset('standard-12'),mode:'automatic'|'manual'='automatic',choose:(n:number)=>number=randomInt):Role[]{
 const config=assertPlayableBoard(board,mode);
 if(config.ruleset==='treasure')throw new LobbyError('TREASURE_DEAL_REQUIRED');
 const candidate=()=>{const deck=Object.entries(config.roles).flatMap(([role,count])=>Array<Role>(count).fill(role as Role));
 for(let i=deck.length-1;i>0;i--){const j=choose(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 return deck;};
 return config.ruleset==='puppet'?dealPuppetDeck(candidate):candidate();
}
export function rolesMatchBoard(roles:readonly Role[],board:BoardConfiguration=boardPreset('standard-12')):boolean{
 // Roster reads must preserve existing games; start/deal enforce the current gates.
 const config=createBoardConfiguration({seatCount:board.seatCount,roles:board.roles,...(board.treasureMode?{treasureMode:board.treasureMode}:{}),...(board.variant?{variant:board.variant}:{}),...(board.idiotPolicy?{idiotPolicy:board.idiotPolicy}:{})});
 return roles.length===config.seatCount&&Object.entries(config.roles).every(([role,count])=>roles.filter(r=>r===role).length===count);
}
export function assertCanDeal(seats:readonly PublicSeat[],board:BoardConfiguration=boardPreset('standard-12'),mode:'automatic'|'manual'='automatic'):void{
 const config=assertPlayableBoard(board,mode);
 if(!seats.some(s=>s.memberId&&s.isHost))throw new LobbyError('HOST_NOT_SEATED',409);
 if(seats.length!==config.seatCount||seats.some(s=>!s.memberId))throw new LobbyError('ROOM_NOT_FULL',409);
 if(seats.some(s=>!s.ready))throw new LobbyError('NOT_ALL_READY',409);
}
