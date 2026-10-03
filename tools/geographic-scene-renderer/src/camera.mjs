export function ease(kind, value) {
  const t = Math.max(0, Math.min(1, value));
  if (kind === 'linear') return t;
  return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
  const time = Math.max(0, Math.min(spec.output.duration_sec, seconds));
  const frames = spec.camera.keyframes;
  if (time >= frames.at(-1).at_sec) return { phase: 'destination-hold', segment: frames.length - 1, progress: 1, view: frames.at(-1).view };
  for (let i = 0; i < frames.length - 1; i++) {
    const from = frames[i]; const to = frames[i + 1];
    if (time <= to.at_sec) {
      const progress = (time - from.at_sec) / (to.at_sec - from.at_sec);
      return { phase: i === 0 && progress === 0 ? 'opening' : 'move', segment: i, progress, view: sampleView(from.view, to.view, progress, spec.camera.easing) };
    }
  }
  return { phase: 'destination-hold', segment: frames.length - 1, progress: 1, view: frames.at(-1).view };
}
