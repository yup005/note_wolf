import type {LobbyView} from '../../../packages/contracts/index';
export const canManageGame=(view:LobbyView)=>view.me.isHost||(view.room.control?.tempSeat!=null&&view.room.control.tempSeat===view.me.seat);
export const gameFrozen=(view:LobbyView)=>!!view.room.control&&view.room.control.status!=='running';
