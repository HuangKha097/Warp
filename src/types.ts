export type ProgressState={id:number;input:string;name:string;target:string;status:'queued'|'running'|'success'|'error';phase:'preparing'|'converting'|'saving';startedAt:number;output?:string;error?:string;queued:number;completed:number;failures:{name:string;error:string}[]};
export type AppState={file:string|null;path:string|null;targets:string[];busy:boolean;result:string|null;office:boolean;helperReady:boolean;message:string;anchor?:{x:number;y:number};presentation?:number;job?:ProgressState|null};
export type Bridge={state:()=>Promise<AppState>;convert:(format:string)=>Promise<AppState>;retry:()=>Promise<AppState>;reveal:()=>Promise<void>;hide:()=>Promise<void>;quit:()=>Promise<void>;onState:(cb:(state:AppState)=>void)=>()=>void};
declare global{interface Window{orbit?:Bridge}}
export const emptyState:AppState={file:null,path:null,targets:[],busy:false,result:null,office:false,helperReady:false,message:'Chọn một tệp, rồi giữ Alt + Shift.'};
