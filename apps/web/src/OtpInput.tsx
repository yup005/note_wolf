import {useRef} from 'react';
interface Props {digits:string[];onChange:(digits:string[])=>void;onComplete:(code:string)=>void;disabled:boolean}
export function OtpInput({digits,onChange,onComplete,disabled}:Props){
 const inputs=useRef<(HTMLInputElement|null)[]>([]);
 function put(index:number,text:string){
  const clean=text.replace(/[^0-9]/g,'').slice(0,4-index);const next=[...digits];
  if(clean.length===0)next[index]='';else for(let i=0;i<clean.length;i++)next[index+i]=clean[i];
  onChange(next);inputs.current[Math.min(index+clean.length,3)]?.focus();
  if(next.every(Boolean))onComplete(next.join(''));
 }
 return <div className="otp" role="group" aria-label="四位数字房间号">
  {digits.map((value,i)=><input key={i} ref={el=>{inputs.current[i]=el;}} aria-label={`房间号第 ${i+1} 位`} autoComplete="off" inputMode="numeric" pattern="[0-9]*" value={value} disabled={disabled}
   onFocus={e=>e.currentTarget.select()} onChange={e=>put(i,e.target.value)}
   onPaste={e=>{e.preventDefault();put(i,e.clipboardData.getData('text'));}}
   onKeyDown={e=>{
    if(e.key==='Backspace'){e.preventDefault();const next=[...digits];const index=value?i:Math.max(0,i-1);next[index]='';onChange(next);inputs.current[index]?.focus();}
    if(e.key==='ArrowLeft')inputs.current[Math.max(0,i-1)]?.focus();
    if(e.key==='ArrowRight')inputs.current[Math.min(3,i+1)]?.focus();
   }}/>) }
 </div>;
}
