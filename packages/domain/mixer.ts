import {LobbyError} from '../contracts/index.js';
import {playerCamp,type VictoryPlayer} from './victory.js';

// Private domain state only. The future server caller must authorize the actor/phase.
export function selectMixerModel(players:readonly VictoryPlayer[],mixerSeat:number,modelSeat:number,night:number):VictoryPlayer[]{
 if(night!==1)throw new LobbyError('NOT_YOUR_TURN',409);
 const mixer=players.find(p=>p.seat===mixerSeat&&p.role==='mixer');const model=players.find(p=>p.seat===modelSeat);
 if(!mixer?.alive||!model?.alive||mixerSeat===modelSeat||players.filter(p=>p.role==='mixer').length!==1||
  new Set(players.map(p=>p.seat)).size!==players.length)throw new LobbyError('INVALID_MODEL');
 if(mixer.modelCamp!==undefined||mixer.modelSeat!==undefined)throw new LobbyError('ALREADY_COMMITTED',409);
 const camp=playerCamp(model.role);if(!camp)throw new LobbyError('INVALID_MODEL');
 return players.map(p=>({...p,...(p.seat===mixerSeat?{modelSeat,modelCamp:camp}:{})}));
}
