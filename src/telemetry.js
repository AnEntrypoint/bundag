let enabled = false;

export function captureEvent(name, props = {}) {
  if (!enabled) return;
  // no-op, parity shim
}

export function enableTelemetry(v = true) { enabled = v; }
