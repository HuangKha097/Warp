import path from 'node:path';
export type Phase='preparing'|'converting'|'saving';
export interface Job {id:number;input:string;target:string;status:'queued'|'running'|'success'|'error';phase:Phase;startedAt:number;output?:string;error?:string;outputDirectory?:string}
export type Runner=(input:string,target:string,progress:(phase:Phase)=>void,signal:AbortSignal,outputDirectory?:string)=>Promise<string>;
/** Conversion ownership is independent of the current Explorer selection. */
export class JobQueue {
  readonly jobs:Job[]=[];
  private serial=0;
  private active:AbortController|null=null;
  private stopped=false;
  constructor(private readonly run:Runner,private readonly changed:(job:Job)=>void){}
  get pendingCount(){return this.jobs.filter(j=>j.status==='queued').length;}
  get failures(){return this.jobs.filter(j=>j.status==='error'&&!this.jobs.some(newer=>newer.id>j.id&&newer.input===j.input&&newer.target===j.target));}
  hasInput(input:string|null){return !!input&&this.jobs.some(j=>j.input.toLowerCase()===path.resolve(input).toLowerCase()&&(j.status==='queued'||j.status==='running'));}
  enqueue(input:string,target:string,outputDirectory?:string){
    if(this.stopped)throw new Error('Warp đang thoát.');
    input=path.resolve(input);
    const duplicate=this.jobs.find(j=>j.input.toLowerCase()===input.toLowerCase()&&j.target===target&&(j.status==='queued'||j.status==='running'));
    if(duplicate)return duplicate;
    const job:Job={id:++this.serial,input:path.resolve(input),target,status:'queued',phase:'preparing',startedAt:0,outputDirectory};
    this.jobs.push(job);this.changed(job);void this.drain();return job;
  }
  private async drain(){
    if(this.active||this.stopped)return;
    const job=this.jobs.find(j=>j.status==='queued');if(!job)return;
    const abort=new AbortController();this.active=abort;
    job.status='running';job.startedAt=Date.now();this.changed(job);
    try{
      job.output=await this.run(job.input,job.target,phase=>{if(!this.stopped){job.phase=phase;this.changed(job);}},abort.signal,job.outputDirectory);
      job.status='success';
    }catch(error){
      job.status='error';const code=(error as NodeJS.ErrnoException)?.code;
      const reasons:Record<string,string>={EACCES:'Không có quyền đọc tệp hoặc ghi bản chuyển đổi vào thư mục này.',EPERM:'Windows đang chặn truy cập tệp hoặc thư mục đầu ra.',ENOENT:'Không tìm thấy tệp nguồn. Tệp có thể đã bị di chuyển hoặc xóa.',ENOSPC:'Ổ đĩa không đủ dung lượng để tạo bản chuyển đổi.'};
      job.error=(code&&reasons[code])||(error instanceof Error?error.message:String(error));
    }
    finally{
      this.active=null;if(!this.stopped){this.changed(job);while(this.jobs.length>50&&!['queued','running'].includes(this.jobs[0].status))this.jobs.shift();void this.drain();}
    }
  }
  dispose(){this.stopped=true;this.active?.abort();}
}
