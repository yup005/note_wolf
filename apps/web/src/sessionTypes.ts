import type {Account} from '../../../packages/contracts/auth';
import type {LobbyView} from '../../../packages/contracts/index';
import type {SharedRecord} from '../../../packages/contracts/sharing';
export interface AccountSession {account:Account|null;rooms:LobbyView[]}
export type RecoveryPayload={kind:'lobby';session:AccountSession}|{kind:'share';token:string;post:SharedRecord};
