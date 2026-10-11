import {z} from 'zod';
import {LobbyError} from '../contracts/index.js';

const actorSchema=z.object({seat:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),alive:z.boolean(),
 knifeGroup:z.enum(['shared','mechanical','armor','none'])}).strict();
export type KnifeActor=z.infer<typeof actorSchema>;

// The ruleset supplies action-group membership, including special wolves that share the knife.
// Call once with night-entry eligibility; same-night deaths do not modify this snapshot.
export function knifeAuthorityAtNightStart(input:readonly KnifeActor[]):{sharedKnifeSeats:number[];inheritedKnifeSeat:number|null}{
 const parsed=z.array(actorSchema).min(1).safeParse(input);
 if(!parsed.success||new Set(parsed.data.map(p=>p.seat)).size!==parsed.data.length||
  ['mechanical','armor'].some(group=>parsed.data.filter(p=>p.knifeGroup===group).length>1))throw new LobbyError('INVALID_KNIFE_STATE');
 const alive=parsed.data.filter(p=>p.alive);
 const sharedKnifeSeats=alive.filter(p=>p.knifeGroup==='shared').map(p=>p.seat);
 const inherited=sharedKnifeSeats.length?undefined:alive.find(p=>p.knifeGroup==='mechanical')??alive.find(p=>p.knifeGroup==='armor');
 return {sharedKnifeSeats,inheritedKnifeSeat:inherited?.seat??null};
}
