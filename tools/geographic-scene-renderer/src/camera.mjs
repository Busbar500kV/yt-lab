export function ease(kind, value) {
  const t = Math.max(0, Math.min(1, value));
  if (kind === 'linear') return t;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function shortestDegrees(from, to) {
  let delta = ((to - from + 540) % 360) - 180;
  if (delta === 180) delta = -180;
  return delta;
}

export function sampleView(from, to, progress, easing = 'cubic-in-out') {
  const t = ease(easing, progress);
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lon: from.lon + shortestDegrees(from.lon, to.lon) * t,
    range_m: Math.exp(Math.log(from.range_m) + (Math.log(to.range_m) - Math.log(from.range_m)) * t),
    heading_deg: from.heading_deg + shortestDegrees(from.heading_deg, to.heading_deg) * t,
    pitch_deg: from.pitch_deg + (to.pitch_deg - from.pitch_deg) * t,
  };
}

export function sampleTimeline(spec, seconds) {
  const { start_hold_sec: a, move_sec: b, hold_sec: c, return_sec: d } = spec.camera.timing;
  const time = Math.max(0, Math.min(spec.output.duration_sec, seconds));
  if (time < a) return { phase: 'opening', view: spec.camera.start, progress: 0 };
  if (time < a + b) {
    const p = (time - a) / b;
    return { phase: 'move', view: sampleView(spec.camera.start, spec.camera.destination, p, spec.camera.easing), progress: p };
  }
  if (time < a + b + c || d === 0) return { phase: 'hold', view: spec.camera.destination, progress: 1 };
  const p = (time - a - b - c) / d;
  return { phase: 'return', view: sampleView(spec.camera.destination, spec.camera.start, p, spec.camera.easing), progress: p };
}
