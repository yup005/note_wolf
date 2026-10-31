import type {Account} from '../../../packages/contracts/auth';
import type {LobbyView} from '../../../packages/contracts/index';
import type {SharedRecord} from '../../../packages/contracts/sharing';
import type {DisplaySnapshot} from '../../../packages/contracts/display';
export interface AccountSession {account:Account|null;rooms:LobbyView[]}
export type RecoveryPayload={kind:'lobby';session:AccountSession}|{kind:'share';token:string;post:SharedRecord}|{kind:'display';token:string;snapshot:DisplaySnapshot};
