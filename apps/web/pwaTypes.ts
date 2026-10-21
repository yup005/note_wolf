export interface PwaAsset {url:string;mime:'javascript'|'css'|'png'|'html';sha256:string}
export interface PwaBuild {version:string;cacheName:string;assets:PwaAsset[]}
