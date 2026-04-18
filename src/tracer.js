export class NoOpTracer {
  startSpan(name) {
    return {
      name,
      setAttribute() {},
      addEvent() {},
      end() {},
      recordException() {},
    };
  }
  async trace(name, fn) {
    const span = this.startSpan(name);
    try { return await fn(span); } finally { span.end(); }
  }
}

export function createTracer() { return new NoOpTracer(); }
