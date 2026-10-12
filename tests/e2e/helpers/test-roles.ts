import {expect,type APIRequestContext} from '@playwright/test';
import type {LobbyView,PrivateIdentity,Role} from '../../../packages/contracts/index';
/** Real host uses their own identity API; the test API returns simulated actors only. */
export async function testRoomRoles(request:APIRequestContext,path:string){
 const [bots,card,view]=await Promise.all([request.get(path+'/test-roles'),request.get(path+'/identity'),request.get(path)]);
 for(const response of [bots,card,view])expect(response.ok()).toBe(true);
 const result=await bots.json() as {roles:{memberId:string;seat:number;role:Role}[]},own=await card.json() as PrivateIdentity,room=await view.json() as LobbyView;
 if(own.role&&room.me.seat!==null)result.roles.push({memberId:room.me.id,seat:room.me.seat,role:own.role});
 result.roles.sort((a,b)=>a.seat-b.seat);return result;
}
