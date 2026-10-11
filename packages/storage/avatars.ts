import sharp from 'sharp';
import {LobbyError} from '../contracts/index.js';
import type {Account} from '../contracts/auth.js';

export const avatarMimeTypes=new Set(['image/jpeg','image/png','image/webp']);
export function avatarUploadLimit(account:Account):number{
 const vip=account.vip;
 return 1024*1024*(vip?.active&&(vip.expiresAt===null||vip.expiresAt>Date.now())?2:1);
}
export function avatarUrl(accountId:string,revision:string):string{return `/api/avatars/${encodeURIComponent(accountId)}?v=${encodeURIComponent(revision)}`;}
export async function normalizeAvatar(bytes:Buffer,contentType:string):Promise<Buffer>{
 if(!avatarMimeTypes.has(contentType)||!Buffer.isBuffer(bytes)||bytes.length===0)throw new LobbyError('INVALID_AVATAR',415);
 try{
  // Bound decompressed pixels as well as uploaded bytes; never retain EXIF or source files.
  const image=sharp(bytes,{limitInputPixels:16_000_000,failOn:'warning'});
  const metadata=await image.metadata();
  const format=contentType==='image/jpeg'?'jpeg':contentType.slice(6);
  if(metadata.format!==format||(metadata.pages??1)>1||!metadata.width||!metadata.height)throw new Error('invalid image');
  return await image.rotate().resize(256,256,{fit:'cover'}).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer();
 }catch{throw new LobbyError('INVALID_AVATAR',415);}
}
