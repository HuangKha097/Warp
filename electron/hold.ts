/** Prevents an asynchronous selection lookup from reopening a released orbit. */
export class HoldGesture {
  private held=false;
  private generation=0;
  get active(){return this.held;}
  press(generation:number){this.generation=generation;this.held=true;}
  release(){this.held=false;}
  accepts(generation:number){return this.held&&this.generation===generation;}
}
