export type RuleDecision<T>={status:'confirmed';source:string;value:T}|{status:'unresolved';questionId:string};
export interface BoardDefinition {
 id:string;seatCount:number;roles:Record<string,number>;
 victoryPolicy:RuleDecision<string>;
 nightOrder:RuleDecision<readonly string[]>;
 policies:Record<string,RuleDecision<unknown>>;
}
export const mvpBoard:BoardDefinition={
 id:'seer-witch-hunter-idiot-12',seatCount:12,
 roles:{wolf:4,seer:1,witch:1,hunter:1,idiot:1,villager:4},
 victoryPolicy:{status:'confirmed',source:'B-001',value:'eliminate-all-wolves-or-all-gods-or-all-villagers'},
 nightOrder:{status:'confirmed',source:'N-001',value:['wolf','witch','seer','hunter-status']},
 policies:{reseating:{status:'confirmed',source:'2026-10-09 approved preparation design',value:'self-only-before-dealing'},activity:{status:'unresolved',questionId:'L-04'},
 firstDaySettlement:{status:'unresolved',questionId:'R-01/X-02/X-03'},speechTransitions:{status:'unresolved',questionId:'D-02'},
 manualDeathFields:{status:'unresolved',questionId:'H-02'},hunterNightStatus:{status:'unresolved',questionId:'N-03'}}
};
