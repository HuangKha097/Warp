import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

export const routes: Record<string, string[]> = {
  docx:['pdf','txt','odt'], doc:['pdf','txt','docx'], odt:['pdf','docx','txt'], rtf:['pdf','docx','txt'],
  txt:['pdf','docx','odt'], xlsx:['pdf','csv','ods'], xls:['pdf','csv','xlsx'], ods:['pdf','csv','xlsx'],
  csv:['pdf','xlsx','ods'], pptx:['pdf','odp'], ppt:['pdf','pptx','odp'], odp:['pdf','pptx']
};
export function targets(file: string): string[] { return routes[path.extname(file).slice(1).toLowerCase()] ?? []; }
export async function findOffice(bundledRoot?:string): Promise<string | null> {
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean) as string[];
  const candidates = [...(bundledRoot?[path.join(bundledRoot,'program','soffice.com')]:[]),...roots.map(r=>path.join(r,'LibreOffice','program','soffice.com')),
    ...(process.env.PATH??'').split(path.delimiter).filter(Boolean).map(r=>path.join(r,'soffice.com'))];
  for(const file of candidates) { try { await access(file,constants.X_OK); return file; } catch {} }
  return null;
}
export async function copyUnique(source: string, original: string, target: string): Promise<string> {
  const parsed = path.parse(original);
  for(let i=0;i<10000;i++) {
    const dest = path.join(parsed.dir,`${parsed.name}${i ? ` (${i})` : ''}.${target}`);
    if(path.resolve(dest).toLowerCase()===path.resolve(original).toLowerCase()) continue;
    try { await copyFile(source,dest,constants.COPYFILE_EXCL); return dest; }
    catch(error) { if((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  }
  throw new Error('Có quá nhiều file trùng tên.');
}
export async function convert(original: string, target: string, office: string): Promise<string> {
  if(!targets(original).includes(target)) throw new Error('Định dạng chuyển đổi không được hỗ trợ.');
  if(!(await stat(original)).isFile()) throw new Error('Vui lòng chọn một file.');
  const temp = await mkdtemp(path.join(os.tmpdir(),'warp-'));
  try {
    // Work on a snapshot; the converter never receives the original path.
    const inputDir=path.join(temp,'input'), outputDir=path.join(temp,'output');
    await mkdir(inputDir); await mkdir(outputDir);
    const input=path.join(inputDir,path.basename(original)); await copyFile(original,input);
    const filter = target === 'txt' ? 'txt:Text (encoded):UTF8' : target;
    await new Promise<void>((resolve,reject)=>{
      const child=spawn(office,[`-env:UserInstallation=${pathToFileURL(path.join(temp,'profile')).href}`,'--headless','--convert-to',filter,'--outdir',outputDir,input],{windowsHide:true,stdio:['ignore','pipe','pipe']});
      let timedOut=false; let log='';
      child.stdout.on('data',d=>{log=(log+d).slice(-4000);}); child.stderr.on('data',d=>{log=(log+d).slice(-4000);});
      const timer=setTimeout(()=>{timedOut=true; child.kill();},120000);
      child.on('error',e=>{clearTimeout(timer);reject(e);});
      child.on('close',code=>{clearTimeout(timer); if(timedOut) reject(new Error('Chuyển đổi quá 2 phút. Hãy thử file nhỏ hơn.')); else if(code!==0) reject(new Error(`Không thể chuyển đổi tài liệu (${code}). ${log}`)); else resolve();});
    });
    const output=(await readdir(outputDir)).find(f=>path.extname(f).toLowerCase()===`.${target}`);
    if(!output || !(await stat(path.join(outputDir,output))).size) throw new Error('Bộ chuyển đổi không tạo được file. File có thể bị khóa, hỏng hoặc có mật khẩu.');
    return await copyUnique(path.join(outputDir,output),original,target);
  } finally { await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:300}).catch(()=>{}); }
}
