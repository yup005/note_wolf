import {backupDatabase,inspectBackup,restoreDatabase,DatabaseBackupError} from '../../packages/storage/databaseBackup.js';

const messages:Record<string,string>={
 INVALID_INPUT:'参数无效。请明确指定源文件、新目标文件及适用的校验摘要。',
 SOURCE_INVALID:'源文件不存在或不是普通数据库文件。',
 OUTPUT_EXISTS:'目标文件或其日志文件已存在，未覆盖任何已有文件。',
 INSECURE_DIRECTORY:'目标目录必须仅当前系统用户可访问。请使用权限为700的私有目录。',
 INVALID_DATABASE:'数据库内容、应用结构、完整性或外键检查未通过。',
 NOT_STANDALONE:'这不是独立备份文件。请先从运行数据库生成一致性备份。',
 CHECKSUM_MISMATCH:'备份文件与所提供的SHA-256摘要不一致。',
 BACKUP_TIMEOUT:'备份未在指定时间内完成，已清理本次临时文件。',
 UNSUPPORTED_PLATFORM:'当前工具仅支持具有POSIX文件权限的macOS或Linux环境。',
 PUBLISH_UNCERTAIN:'文件已生成，但目录持久写入尚未确认。请先校验文件，不要重复覆盖。',
 OPERATION_FAILED:'文件操作未完成。请检查私有目录权限、磁盘空间和数据库占用情况。'
};
function parse(args:string[]){
 const [mode,...rest]=args;if(!['backup','inspect','restore'].includes(mode)||rest.length%2!==0)throw new DatabaseBackupError('INVALID_INPUT');
 const allowed=new Set(['--source',...(mode==='inspect'?[]:['--output']),...(mode==='backup'?['--timeout-ms']:['--sha256'])]),values=new Map<string,string>();
 for(let i=0;i<rest.length;i+=2){const key=rest[i],value=rest[i+1];if(!allowed.has(key)||values.has(key)||!value||value.startsWith('--'))throw new DatabaseBackupError('INVALID_INPUT');values.set(key,value);}
 const source=values.get('--source'),output=values.get('--output'),sha256=values.get('--sha256'),duration=values.get('--timeout-ms');
 if(!source||(mode!=='inspect'&&!output)||(mode==='restore'&&!sha256)||(duration!==undefined&&!/^[1-9][0-9]*$/.test(duration)))throw new DatabaseBackupError('INVALID_INPUT');
 return {mode,source,output,sha256,timeoutMs:duration===undefined?undefined:Number(duration)};
}
try{
 const input=parse(process.argv.slice(2));
 const info=input.mode==='backup'?await backupDatabase({source:input.source,output:input.output!,timeoutMs:input.timeoutMs}):input.mode==='restore'?await restoreDatabase({source:input.source,output:input.output!,sha256:input.sha256!}):await inspectBackup({source:input.source,sha256:input.sha256});
 process.stdout.write(JSON.stringify({operation:input.mode,...info})+'\n');
}catch(e){
 const code=e instanceof DatabaseBackupError&&messages[e.code]?e.code:'OPERATION_FAILED';
 process.stderr.write(JSON.stringify({error:code,message:messages[code]})+'\n');process.exitCode=1;
}
