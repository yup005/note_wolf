import {useState} from 'react';

/** Only a display preference; never store a role, target or tutorial progress. */
export function useHelpPreference(topic:'tutorial'|'wolves'){
 const key=`wolf.help.${topic}.v1`;
 const [expanded,setExpanded]=useState(()=>{try{return localStorage.getItem(key)!=='off';}catch{return true;}});
 function change(value:boolean){setExpanded(value);try{localStorage.setItem(key,value?'on':'off');}catch{/* The current page remains usable when storage is blocked. */}}
 return [expanded,change] as const;
}
