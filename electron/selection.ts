import {HoldGesture} from './hold';
export interface Selection {file:string;x:number;y:number}
export class SelectionSession {
  private readonly hold=new HoldGesture();
  current:Selection|null=null;
  press(id:number){this.hold.press(id);}
  release(){this.hold.release();}
  get active(){return this.hold.active;}
  accepts(id:number){return this.hold.accepts(id);}
  async capture(id:number,selection:Selection,inspect:(file:string)=>Promise<void>){
    if(!this.hold.accepts(id))return false;
    await inspect(selection.file);
    if(!this.hold.accepts(id))return false;
    this.current=selection;return true;
  }
}
