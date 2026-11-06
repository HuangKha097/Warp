import {spawn,type ChildProcess} from 'node:child_process';
import {createInterface} from 'node:readline';
import {EventEmitter} from 'node:events';
export type WatchEvent={ready?:boolean;heartbeat?:boolean;held?:boolean;released?:boolean;gesture?:number;file?:string;x?:number;y?:number;error?:string};
/** A crashed helper or stalled UI Automation request must not permanently disable the shortcut. */
export class NativeWatcher extends EventEmitter {
  private child:ChildProcess|null=null;
  private timer:ReturnType<typeof setInterval>|undefined;
  private restartTimer:ReturnType<typeof setTimeout>|undefined;
  private stopped=false;
  private epoch=0;
  private lastSeen=0;
  private captureAt=0;
  private captureGeneration=0;
  constructor(private readonly executable:string,private readonly launch:()=>ChildProcess=()=>spawn(executable,[String(process.pid)],{windowsHide:true,stdio:['ignore','pipe','pipe']})){super();}
  start(){
    if(this.stopped||this.child)return;
    const epoch=++this.epoch;
    const child=this.launch();
    this.child=child;this.lastSeen=Date.now();this.captureAt=0;
    const lines=createInterface({input:child.stdout!});
    lines.on('line',line=>{
      if(this.stopped||epoch!==this.epoch)return;
      try{
        const event=JSON.parse(line) as WatchEvent;this.lastSeen=Date.now();
        if(event.held){this.captureAt=Date.now();this.captureGeneration=event.gesture??0;}
        if(event.released||((event.file||event.error)&&event.gesture===this.captureGeneration))this.captureAt=0;
        if(!event.heartbeat)this.emit('event',event);
      }catch{/* Ignore malformed diagnostic output; the watchdog still supervises the process. */}
    });
    child.stderr?.on('data',()=>{});
    const failed=()=>{if(epoch===this.epoch&&!this.stopped)this.restart();};
    child.once('error',failed);child.once('exit',()=>{lines.close();failed();});
    this.timer=setInterval(()=>{const now=Date.now();if(now-this.lastSeen>6000||(this.captureAt>0&&now-this.captureAt>3500))this.restart();},1000);
  }
  private restart(){
    if(this.stopped)return;
    this.epoch++;this.captureAt=0;clearInterval(this.timer);this.timer=undefined;
    const child=this.child;this.child=null;
    this.emit('reset');
    let launched=false;
    const again=()=>{if(launched)return;launched=true;clearTimeout(this.restartTimer);if(!this.stopped)this.start();};
    if(child&&child.exitCode===null){child.once('exit',()=>{clearTimeout(this.restartTimer);this.restartTimer=setTimeout(again,400);});child.kill();this.restartTimer=setTimeout(again,2000);}
    else this.restartTimer=setTimeout(again,400);
  }
  stop(){this.stopped=true;this.epoch++;clearInterval(this.timer);clearTimeout(this.restartTimer);this.child?.kill();this.child=null;}
}
