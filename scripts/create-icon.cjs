// Preserve the supplied artwork when producing Windows icon sizes.
const {execFileSync}=require('node:child_process');
const path=require('node:path');
execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'create-icon.ps1')],{stdio:'inherit',windowsHide:true});
