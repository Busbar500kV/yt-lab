/* global Cesium */
const state = { viewer: null, spec: null, tileSamples: [], record: null, destinationEntity: null, pendingTiles: null };

function hex(value, alpha = 1) { return Cesium.Color.fromCssColorString(value).withAlpha(alpha); }
function radians(value) { return Cesium.Math.toRadians(value); }
function shortest(from, to) { let delta = ((to - from + 540) % 360) - 180; if (delta === 180) delta = -180; return delta; }
function eased(kind, value) { const t = Math.max(0, Math.min(1, value)); return kind === 'linear' ? t : (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); }
function sample(from, to, progress, kind) {
  const t = eased(kind, progress);
  return { lat: from.lat + (to.lat - from.lat) * t, lon: from.lon + shortest(from.lon, to.lon) * t, range_m: Math.exp(Math.log(from.range_m) + (Math.log(to.range_m) - Math.log(from.range_m)) * t), heading_deg: from.heading_deg + shortest(from.heading_deg, to.heading_deg) * t, pitch_deg: from.pitch_deg + (to.pitch_deg - from.pitch_deg) * t };
}
function timeline(seconds) {
  const time = Math.max(0, Math.min(state.spec.output.duration_sec, seconds)); const frames = state.spec.camera.keyframes;
  if (time >= frames.at(-1).at_sec) return frames.at(-1).view;
  for (let i = 0; i < frames.length - 1; i++) { const from = frames[i], to = frames[i + 1]; if (time <= to.at_sec) return sample(from.view, to.view, (time - from.at_sec) / (to.at_sec - from.at_sec), state.spec.camera.easing); }
  return frames.at(-1).view;
}
function setView(view) {
  const target = Cesium.Cartesian3.fromDegrees(view.lon, view.lat, 0);
  state.viewer.camera.lookAt(target, new Cesium.HeadingPitchRange(radians(view.heading_deg), radians(view.pitch_deg), view.range_m));
  state.viewer.scene.requestRender();
}

function labelAlpha(seconds) {
  const label = state.spec.destination_label;
  if (seconds < label.reveal_at_sec) return 0;
  let alpha = label.fade_in_sec ? Math.min(1, (seconds - label.reveal_at_sec) / label.fade_in_sec) : 1;
  if (label.fade_out_sec && seconds > state.spec.output.duration_sec - label.fade_out_sec) alpha = Math.min(alpha, (state.spec.output.duration_sec - seconds) / label.fade_out_sec);
  return Math.max(0, Math.min(1, alpha));
}

function addDestinationLabel() {
  const location = state.spec.geography.locations.find((item) => item.id === state.spec.geography.destination_id);
  const fontPx = Math.max(22, Math.min(30, Math.round(state.spec.output.width / 72)));
  state.destinationEntity = state.viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(location.lon, location.lat, 0),
    point: { pixelSize: 15, color: hex(state.spec.destination_label.color, 0), outlineColor: hex('#000000', 0), outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    label: { text: state.spec.destination_label.text, font: `600 ${fontPx}px system-ui`, fillColor: Cesium.Color.WHITE.withAlpha(0), outlineColor: Cesium.Color.BLACK.withAlpha(0), outlineWidth: 5, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -34), verticalOrigin: Cesium.VerticalOrigin.BOTTOM, disableDepthTestDistance: Number.POSITIVE_INFINITY, showBackground: true, backgroundColor: Cesium.Color.BLACK.withAlpha(0), backgroundPadding: new Cesium.Cartesian2(9, 6) },
  });
  state.destinationEntity.show = false;
}

function addVerifiedOverlays() {
  for (const overlay of state.spec.overlays) {
    const coords = overlay.points.flatMap((point) => point);
    overlay._entity = state.viewer.entities.add({ polyline: { positions: Cesium.Cartesian3.fromDegreesArray(coords), width: overlay.type === 'boundary' ? 4 : 6, material: new Cesium.PolylineGlowMaterialProperty({ color: hex(overlay.color), glowPower: .18 }), clampToGround: true } });
    overlay._entity.show = overlay.reveal_at_sec === 0;
  }
}

function updateOverlays(seconds) {
  const alpha = labelAlpha(seconds); const entity = state.destinationEntity;
  entity.show = alpha > .001;
  entity.point.color = hex(state.spec.destination_label.color, alpha);
  entity.point.outlineColor = Cesium.Color.BLACK.withAlpha(alpha);
  entity.label.fillColor = Cesium.Color.WHITE.withAlpha(alpha);
  entity.label.outlineColor = Cesium.Color.BLACK.withAlpha(alpha);
  entity.label.backgroundColor = Cesium.Color.BLACK.withAlpha(.68 * alpha);
  for (const item of state.spec.overlays) if (item._entity) item._entity.show = seconds >= item.reveal_at_sec;
}

async function waitTiles(timeout = 25000) {
  const start = performance.now(); let stable = 0;
  while (performance.now() - start < timeout) { state.viewer.scene.requestRender(); await new Promise((resolve) => setTimeout(resolve, 100)); const loaded = state.viewer.scene.globe.tilesLoaded; state.tileSamples.push({ t: performance.now(), loaded }); stable = loaded ? stable + 1 : 0; if (stable >= 5) return true; }
  throw new Error(`scene tiles did not become ready before timeout (pending=${state.pendingTiles})`);
}

async function warm() {
  const frames = state.spec.camera.keyframes;
  for (let i = 0; i < frames.length; i++) { setView(frames[i].view); updateOverlays(frames[i].at_sec); try { await waitTiles(); } catch (error) { throw new Error(`camera warm-up failed at keyframe ${i + 1}/${frames.length}: ${error.message}`); } }
  const rehearsalMs = state.spec.output.duration_sec * 2000; const started = performance.now();
  await new Promise((resolve) => { function tick(now) { const elapsed = now - started; const seconds = Math.min(state.spec.output.duration_sec, elapsed / 2000); setView(timeline(seconds)); updateOverlays(seconds); if (elapsed < rehearsalMs) requestAnimationFrame(tick); else resolve(); } requestAnimationFrame(tick); });
  await new Promise((resolve) => setTimeout(resolve, 1000));
  state.viewer.scene.globe.preloadAncestors = false; state.viewer.scene.globe.preloadSiblings = false;
  setView(timeline(0)); updateOverlays(0); await waitTiles(); await new Promise((resolve) => setTimeout(resolve, 2000)); await waitTiles(); state.tileSamples = [];
}

async function setup(spec) {
  state.spec = spec; Cesium.Ion.defaultAccessToken = '';
  let imageryProvider;
  if (spec.providers.imagery.kind === 'test-grid') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512; const context = canvas.getContext('2d');
    context.fillStyle = '#17324a'; context.fillRect(0, 0, 1024, 512); context.strokeStyle = '#5e8eaa'; context.lineWidth = 2;
    for (let x = 0; x <= 1024; x += 64) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 512); context.stroke(); }
    for (let y = 0; y <= 512; y += 64) { context.beginPath(); context.moveTo(0, y); context.lineTo(1024, y); context.stroke(); }
    context.fillStyle = '#d5e7ef'; context.font = 'bold 80px sans-serif'; context.fillText('TEST GRID', 290, 285);
    imageryProvider = await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'));
  } else if (spec.providers.imagery.kind === 'url-template') {
    imageryProvider = new Cesium.UrlTemplateImageryProvider({ url: spec.providers.imagery.url, maximumLevel: spec.providers.imagery.maximum_level, credit: spec.providers.imagery.attribution, enablePickFeatures: false });
  } else {
    imageryProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(spec.providers.imagery.url, { credit: spec.providers.imagery.attribution, enablePickFeatures: false });
  }
  let terrainProvider = new Cesium.EllipsoidTerrainProvider();
  if (spec.providers.terrain.id === 'reearth-terrain') terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(spec.providers.terrain.url, { requestVertexNormals: true, requestWaterMask: false });
  state.viewer = new Cesium.Viewer('cesium', { animation: false, baseLayerPicker: false, fullscreenButton: false, geocoder: false, homeButton: false, infoBox: false, navigationHelpButton: false, sceneModePicker: false, selectionIndicator: false, timeline: false, baseLayer: false, terrainProvider, requestRenderMode: false });
  state.viewer.scene.globe.tileLoadProgressEvent.addEventListener((pending) => { state.pendingTiles = pending; });
  state.viewer.imageryLayers.removeAll(); state.viewer.imageryLayers.addImageryProvider(imageryProvider);
  state.viewer.scene.globe.tileCacheSize = 2000; state.viewer.scene.globe.preloadAncestors = true; state.viewer.scene.globe.preloadSiblings = true;
  state.viewer.scene.globe.enableLighting = true; state.viewer.scene.globe.dynamicAtmosphereLighting = false; state.viewer.scene.globe.showGroundAtmosphere = true; state.viewer.scene.highDynamicRange = true; state.viewer.scene.fog.enabled = true;
  state.viewer.clock.currentTime = Cesium.JulianDate.fromIso8601('2026-06-21T19:00:00Z');
  document.getElementById('attribution').textContent = `${spec.providers.imagery.attribution} · ${spec.providers.terrain.attribution}`;
  document.getElementById('context-note').textContent = spec.editorial.context_note;
  addDestinationLabel(); addVerifiedOverlays(); setView(timeline(0)); updateOverlays(0); await warm();
  return { ready: true, webgl: state.viewer.scene.context.webgl2 ? 'WebGL 2' : 'WebGL 1', renderer: state.viewer.scene.context._gl.getParameter(state.viewer.scene.context._gl.RENDERER) };
}

async function startRecord() {
  const canvas = document.createElement('canvas'); canvas.width = state.spec.output.width; canvas.height = state.spec.output.height; const context = canvas.getContext('2d', { alpha: false });
  const stream = canvas.captureStream(0); const track = stream.getVideoTracks()[0]; const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
  const chunks = []; const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: Math.max(2_000_000, state.spec.output.width * state.spec.output.height * 3) });
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); }; const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = (event) => reject(event.error || new Error('MediaRecorder failed')); }); recorder.start();
  state.record = { recorder, chunks, stopped, stream, type, canvas, context, track, frameTimes: [], captureFrame(sceneSec) {
    context.drawImage(state.viewer.canvas, 0, 0, canvas.width, canvas.height);
    const scale = Math.max(1, Math.min(canvas.width, canvas.height) / 720); const pad = Math.round(9 * scale); const line = Math.round(30 * scale); context.textBaseline = 'bottom';
    const attribution = document.getElementById('attribution').textContent; const contextNote = document.getElementById('context-note').textContent;
    context.font = `${Math.round(16 * scale)}px system-ui`; const attrWidth = Math.min(canvas.width - pad * 2, context.measureText(attribution).width + pad * 2); context.fillStyle = 'rgba(0,0,0,.74)'; context.fillRect(canvas.width - attrWidth - pad, canvas.height - line - pad, attrWidth, line); context.fillStyle = '#f5f7fa'; context.textAlign = 'right'; context.fillText(attribution, canvas.width - pad * 2, canvas.height - pad * 1.45);
    context.font = `${Math.round(14 * scale)}px system-ui`; const noteWidth = context.measureText(contextNote).width + pad * 2; context.fillStyle = 'rgba(0,0,0,.65)'; context.fillRect(pad, canvas.height - line - pad, noteWidth, line); context.fillStyle = '#d6dce4'; context.textAlign = 'left'; context.fillText(contextNote, pad * 2, canvas.height - pad * 1.45);
    track.requestFrame(); state.record.frameTimes.push({ now: performance.now(), sceneSec });
  } };
  return type;
}

async function animate() {
  const slowdown = state.spec.output.capture_slowdown; const duration = state.spec.output.duration_sec * 1000 * slowdown; const interval = 1000 / state.spec.output.fps; const start = performance.now(); let next = start;
  return new Promise((resolve) => { function tick(now) { if (now + .25 < next) { requestAnimationFrame(tick); return; } const seconds = Math.min(state.spec.output.duration_sec, (now - start) / 1000 / slowdown); setView(timeline(seconds)); updateOverlays(seconds); state.record?.captureFrame(seconds); state.tileSamples.push({ t: now, loaded: state.viewer.scene.globe.tilesLoaded }); next += interval; if (now - start < duration) requestAnimationFrame(tick); else { setView(timeline(state.spec.output.duration_sec)); updateOverlays(state.spec.output.duration_sec); resolve(); } } requestAnimationFrame(tick); });
}

async function stopRecord() {
  await new Promise((resolve) => setTimeout(resolve, 100)); state.record.recorder.stop(); await state.record.stopped; for (const track of state.record.stream.getTracks()) track.stop();
  const blob = new Blob(state.record.chunks, { type: state.record.type }); const buffer = await blob.arrayBuffer(); let binary = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const pairs = state.record.frameTimes.slice(1).map((value, i) => ({ gap: value.now - state.record.frameTimes[i].now, priorSec: state.record.frameTimes[i].sceneSec })); const moveEnd = state.spec.camera.keyframes.at(-1).at_sec; const motion = pairs.filter((value) => value.priorSec <= moveEnd + .1);
  return { base64: btoa(binary), bytes: bytes.length, type: state.record.type, tile_samples: state.tileSamples, captured_frames: state.record.frameTimes.length, max_frame_gap_ms: pairs.length ? Math.max(...pairs.map((value) => value.gap)) : null, max_motion_gap_ms: motion.length ? Math.max(...motion.map((value) => value.gap)) : null };
}

function projectDestination() {
  const location = state.spec.geography.locations.find((item) => item.id === state.spec.geography.destination_id); setView(state.spec.camera.keyframes.at(-1).view); state.viewer.scene.render();
  const point = Cesium.SceneTransforms.worldToWindowCoordinates(state.viewer.scene, Cesium.Cartesian3.fromDegrees(location.lon, location.lat, 0)); if (!point) return null;
  const fontPx = Math.max(22, Math.min(30, Math.round(state.spec.output.width / 72))); const labelWidth = Math.min(state.spec.output.width * .45, state.spec.destination_label.text.length * fontPx * .64 + 24);
  return { x: point.x, y: point.y, label: { left: point.x - labelWidth / 2, right: point.x + labelWidth / 2, top: point.y - 34 - fontPx - 18, bottom: point.y - 24 } };
}

window.geoScene = { setup, startRecord, animate, stopRecord, waitTiles, projectDestination, tileSamples: () => state.tileSamples };
