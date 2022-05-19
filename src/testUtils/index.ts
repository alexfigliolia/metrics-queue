export class PerfLibMetric {
  name: string;
  time: number = 0;
  callbacks: Function[] = [];
  constructor(name: string) {
    this.name = name;
  }
  stop() {
    this.time = Date.now();
    this.onStop();
  }
  onStop() {
    this.callbacks.forEach((callback) => {
      callback(this);
    });
  }
  subscribe(func: Function) {
    this.callbacks.push(func);
  }
}
