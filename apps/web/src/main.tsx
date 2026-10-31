import {createRoot} from 'react-dom/client';
import {useEffect} from 'react';
import {SessionBoundary} from './SessionBoundary';
import {registerPwa} from './pwaClient';
import './style.css';
function Root(){
 useEffect(()=>{if(!import.meta.env.PROD)return;let active=true,dispose:undefined|(()=>void);void registerPwa().then(cleanup=>{if(active)dispose=cleanup;else cleanup();});return()=>{active=false;dispose?.();};},[]);
 return <SessionBoundary/>;
}
createRoot(document.getElementById('root')!).render(<Root/>);
