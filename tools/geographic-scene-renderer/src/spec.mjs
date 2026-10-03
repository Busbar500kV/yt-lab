import fs from 'node:fs';
import path from 'node:path';

export const TOOL_ID = 'geographic-scene-renderer';
export const TOOL_VERSION = '0.2.3';
export const UPSTREAM_COMMIT = 'aa16b7c3b0166a89d8c7a6089e0aff53a22faaee';

const MODES = new Set(['earth-to-location', 'location-to-location']);
const PLACEMENTS = new Set(['initial-location-introduction', 'meaningful-location-change', 'return-to-location']);

const IMAGERY = Object.freeze({
  'usgs-national-map-imagery': {
    kind: 'arcgis',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
    attribution: 'USGS The National Map imagery',
    rights_url: 'https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map',
    reuse_basis: 'USGS states National Map services and data are free and public domain; acknowledgement requested.',
    coverage: 'contiguous-united-states',
    coverage_bounds: { west: -125, south: 24, east: -66, north: 50 },
    minimum_destination_range_m: 8_000,
    cache_policy: 'bounded-run-cache',
    proxy: true,
  },
  'nasa-gibs-blue-marble': {
    kind: 'url-template',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    maximum_level: 8,
    attribution: 'NASA EOSDIS GIBS / Blue Marble imagery',
    rights_url: 'https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy',
    reuse_basis: 'NASA-led Earth science data are open; factual editorial use with NASA acknowledgement and no endorsement implication.',
    coverage: 'global',
    coverage_bounds: { west: -180, south: -85, east: 180, north: 85 },
    minimum_destination_range_m: 120_000,
    cache_policy: 'browser-memory-only; no retained imagery cache',
    proxy: false,
  },
  'test-grid': {
    kind: 'test-grid', url: null, maximum_level: 1,
    attribution: 'Synthetic test grid · not production evidence', rights_url: null,
    reuse_basis: 'Tool-generated deterministic test fixture.', coverage: 'global',
    coverage_bounds: { west: -180, south: -90, east: 180, north: 90 },
    minimum_destination_range_m: 100, cache_policy: 'in-process-only', proxy: false, testOnly: true,
  },
  'failed-test': {
    kind: 'arcgis', url: 'http://127.0.0.1:9/provider-must-fail',
    attribution: 'Intentional failed-provider fixture', rights_url: null,
    reuse_basis: 'Failure-path fixture.', coverage: 'global',
    coverage_bounds: { west: -180, south: -90, east: 180, north: 90 },
    minimum_destination_range_m: 100, cache_policy: 'none', proxy: true, testOnly: true,
  },
});

const TERRAIN = Object.freeze({
  'reearth-terrain': {
    url: 'https://terrain.reearth.land/cesium-mesh/ellipsoid',
    attribution: 'Re:Earth / Mapterhorn terrain (CC BY 4.0)',
    rights_url: 'https://github.com/reearth/reearth-terrain',
    reuse_basis: 'Mapterhorn terrain is CC BY 4.0; EGM2008 is a U.S. government work; OSM watermask disabled.',
  },
  ellipsoid: {
    url: null, attribution: 'Ellipsoid terrain · test only', rights_url: null,
    reuse_basis: 'Cesium ellipsoid generated in-process.', testOnly: true,
  },
});

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value;
}

function text(value, field, max = 4096) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  if (value.trim().length > max) throw new Error(`${field} is too long`);
  return value.trim();
}

function optionalText(value, field, max = 4096) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field, max);
}

function finite(value, field, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${field} must be between ${min} and ${max}`);
  return Number(value);
}

function extent(value, field) {
  object(value, field);
  const result = {
    west: finite(value.west, `${field}.west`, -180, 180), south: finite(value.south, `${field}.south`, -90, 90),
    east: finite(value.east, `${field}.east`, -180, 180), north: finite(value.north, `${field}.north`, -90, 90),
  };
  if (result.west >= result.east || result.south >= result.north) throw new Error(`${field} must be an ordered non-dateline bounding box`);
  return result;
}

function source(value, field) {
  object(value, field);
  return { title: text(value.title, `${field}.title`, 180), url: text(value.url, `${field}.url`), role: text(value.role, `${field}.role`, 120) };
}

function location(value, field) {
  object(value, field);
  const lat = finite(value.lat, `${field}.lat`, -90, 90); const lon = finite(value.lon, `${field}.lon`, -180, 180);
  const bounds = extent(value.extent, `${field}.extent`);
  if (lon < bounds.west || lon > bounds.east || lat < bounds.south || lat > bounds.north) throw new Error(`${field} coordinate is outside its verified extent`);
  if (!Array.isArray(value.sources) || !value.sources.length) throw new Error(`${field}.sources must contain verification references`);
  const verification = object(value.verification, `${field}.verification`);
  const ambiguityStatus = text(verification.ambiguity_status, `${field}.verification.ambiguity_status`, 32);
  if (!['not-ambiguous', 'resolved'].includes(ambiguityStatus)) throw new Error(`${field} remains ambiguous; resolve it before rendering`);
  const verificationStatus = text(verification.status, `${field}.verification.status`, 32);
  if (verificationStatus !== 'verified') throw new Error(`${field} must be explicitly verified`);
  return {
    id: text(value.id, `${field}.id`, 80), display_label: text(value.display_label, `${field}.display_label`, 42),
    place_name: text(value.place_name, `${field}.place_name`, 120), country: text(value.country, `${field}.country`, 120),
    administrative_region: optionalText(value.administrative_region, `${field}.administrative_region`, 160),
    feature_type: text(value.feature_type, `${field}.feature_type`, 80),
    full_description: text(value.full_description, `${field}.full_description`, 500), lat, lon, extent: bounds,
    sources: value.sources.map((item, i) => source(item, `${field}.sources[${i}]`)),
    verification: {
      status: verificationStatus,
      verified_on: text(verification.verified_on, `${field}.verification.verified_on`, 32),
      method: text(verification.method, `${field}.verification.method`, 500),
      ambiguity_status: ambiguityStatus,
      ambiguity_note: text(verification.ambiguity_note, `${field}.verification.ambiguity_note`, 500),
    },
  };
}

function view(value, field) {
  object(value, field);
  return { lat: finite(value.lat, `${field}.lat`, -90, 90), lon: finite(value.lon, `${field}.lon`, -180, 180), range_m: finite(value.range_m, `${field}.range_m`, 100, 50_000_000), heading_deg: finite(value.heading_deg ?? 0, `${field}.heading_deg`, -360, 360), pitch_deg: finite(value.pitch_deg ?? -90, `${field}.pitch_deg`, -90, -10) };
}

function safeZone(value, field) {
  object(value, field);
  const result = { id: text(value.id, `${field}.id`, 80), x: finite(value.x, `${field}.x`, 0, 1), y: finite(value.y, `${field}.y`, 0, 1), width: finite(value.width, `${field}.width`, 0, 1), height: finite(value.height, `${field}.height`, 0, 1) };
  if (result.x + result.width > 1 || result.y + result.height > 1) throw new Error(`${field} extends outside the output`);
  return result;
}

function distanceKm(a, b) {
  const r = 6371; const p = Math.PI / 180; const dLat = (b.lat - a.lat) * p; const dLon = (b.lon - a.lon) * p;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
function extentToleranceKm(loc) { return Math.max(5, distanceKm({ lat: loc.extent.south, lon: loc.extent.west }, { lat: loc.extent.north, lon: loc.extent.east })); }
function inCoverage(loc, bounds) { return loc.lon >= bounds.west && loc.lon <= bounds.east && loc.lat >= bounds.south && loc.lat <= bounds.north; }

function verifiedOverlay(value, field, duration) {
  object(value, field); const type = text(value.type, `${field}.type`, 32);
  if (!['route', 'boundary'].includes(type)) throw new Error(`${field}.type must be route or boundary`);
  if (value.verified !== true) throw new Error(`${field} must be explicitly verified`);
  if (!Array.isArray(value.points) || value.points.length < (type === 'route' ? 2 : 3)) throw new Error(`${field}.points has too few coordinates`);
  const color = value.color ?? '#72d6ff'; if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`${field}.color must be #RRGGBB`);
  return { type, label: text(value.label, `${field}.label`, 42), source_url: text(value.source_url, `${field}.source_url`), verified: true, reveal_at_sec: finite(value.reveal_at_sec ?? 0, `${field}.reveal_at_sec`, 0, duration), color, points: value.points.map((point, i) => { if (!Array.isArray(point) || point.length !== 2) throw new Error(`${field}.points[${i}] must be [lon, lat]`); return [finite(point[0], `${field}.points[${i}][0]`, -180, 180), finite(point[1], `${field}.points[${i}][1]`, -90, 90)]; }) };
}

export function normalizeSpec(raw) {
  object(raw, 'specification');
  if (raw.schema_version !== 2) throw new Error('schema_version must be 2');
  if (raw.tool_id !== TOOL_ID) throw new Error(`tool_id must be ${TOOL_ID}`);
  const mode = text(raw.mode, 'mode', 40); if (!MODES.has(mode)) throw new Error('mode must be earth-to-location or location-to-location');
  const testing = raw.testing === true;

  const editorial = object(raw.editorial, 'editorial'); const anchor = object(editorial.anchor, 'editorial.anchor');
  const placement = text(anchor.intended_placement, 'editorial.anchor.intended_placement', 64);
  if (!PLACEMENTS.has(placement)) throw new Error('editorial anchor placement is unsupported');
  if (mode === 'earth-to-location' && placement !== 'initial-location-introduction') throw new Error('earth-to-location is only for an initial location introduction');
  if (mode === 'location-to-location' && placement === 'initial-location-introduction') throw new Error('location-to-location requires a location-change or return placement');

  const geography = object(raw.geography, 'geography');
  if (!Array.isArray(geography.locations) || !geography.locations.length) throw new Error('geography.locations must not be empty');
  const locations = geography.locations.map((item, i) => location(item, `geography.locations[${i}]`)); const byId = new Map(locations.map((item) => [item.id, item]));
  if (byId.size !== locations.length) throw new Error('geography location IDs must be unique');
  const destinationId = text(geography.destination_id, 'geography.destination_id', 80); const destination = byId.get(destinationId); if (!destination) throw new Error('geography.destination_id is unknown');
  const startId = optionalText(geography.start_location_id, 'geography.start_location_id', 80);
  if (mode === 'earth-to-location' && startId) throw new Error('earth-to-location must not define a start_location_id');
  if (mode === 'location-to-location' && (!startId || !byId.has(startId) || startId === destinationId)) throw new Error('location-to-location requires a distinct verified start_location_id');

  const providers = object(raw.providers, 'providers'); const imagery = IMAGERY[text(providers.imagery, 'providers.imagery', 80)]; const terrain = TERRAIN[text(providers.terrain, 'providers.terrain', 80)];
  if (!imagery) throw new Error('providers.imagery is unsupported'); if (!terrain) throw new Error('providers.terrain is unsupported');
  if ((imagery.testOnly || terrain.testOnly) && !testing) throw new Error('test providers require testing: true');
  if (!inCoverage(destination, imagery.coverage_bounds)) throw new Error(`destination is outside ${providers.imagery} supported coverage`);
  if (startId && !inCoverage(byId.get(startId), imagery.coverage_bounds)) throw new Error(`start location is outside ${providers.imagery} supported coverage`);
  const layers = providers.permitted_layers;
  if (!Array.isArray(layers) || !layers.length || layers.some((item) => !['imagery', 'terrain'].includes(item))) throw new Error('providers.permitted_layers may contain only imagery and terrain');

  const output = object(raw.output, 'output'); const width = finite(output.width, 'output.width', 320, 3840); const height = finite(output.height, 'output.height', 180, 3840); const fps = finite(output.fps, 'output.fps', 12, 60); const duration = finite(output.duration_sec, 'output.duration_sec', 3, 6);
  if (width % 2 || height % 2) throw new Error('output dimensions must be even');
  const format = text(output.format, 'output.format', 20); const ratio = width / height;
  if (format === 'landscape' && Math.abs(ratio - 16 / 9) > .01) throw new Error('landscape output must be native 16:9');
  if (format === 'portrait' && Math.abs(ratio - 9 / 16) > .01) throw new Error('portrait output must be native 9:16');
  if (!['landscape', 'portrait'].includes(format)) throw new Error('output.format must be landscape or portrait');
  if (output.codec !== 'h264' || output.pixel_format !== 'yuv420p' || output.fast_start !== true) throw new Error('output must request h264, yuv420p, and fast_start true');

  const camera = object(raw.camera, 'camera'); if (!['linear', 'cubic-in-out'].includes(camera.easing)) throw new Error('camera.easing must be linear or cubic-in-out');
  if (!Array.isArray(camera.keyframes) || camera.keyframes.length < 2) throw new Error('camera.keyframes must contain at least two entries');
  const keyframes = camera.keyframes.map((item, i) => { object(item, `camera.keyframes[${i}]`); return { at_sec: finite(item.at_sec, `camera.keyframes[${i}].at_sec`, 0, duration), view: view(item.view, `camera.keyframes[${i}].view`) }; });
  if (keyframes[0].at_sec !== 0) throw new Error('first camera keyframe must be at 0 seconds');
  for (let i = 1; i < keyframes.length; i++) if (keyframes[i].at_sec <= keyframes[i - 1].at_sec) throw new Error('camera keyframe times must increase');
  const arrival = keyframes.at(-1).at_sec;
  if (duration - arrival < 1.5 || duration - arrival > 2.25) throw new Error('destination hold must be between 1.5 and 2.25 seconds');
  const last = keyframes.at(-1).view;
  if (last.range_m < imagery.minimum_destination_range_m) throw new Error(`destination framing is closer than ${providers.imagery} supports`);
  if (distanceKm(last, destination) > extentToleranceKm(destination)) throw new Error('final camera target does not match the verified destination extent');
  if (mode === 'earth-to-location') {
    if (keyframes[0].view.range_m < 10_000_000) throw new Error('earth-to-location must begin with a recognizable Earth view');
  } else {
    const start = byId.get(startId);
    if (distanceKm(keyframes[0].view, start) > extentToleranceKm(start)) throw new Error('first camera target does not match the verified start location extent');
    if (keyframes.length < 3) throw new Error('location-to-location requires a pullback/transfer keyframe');
    const maxRange = Math.max(...keyframes.slice(1, -1).map((item) => item.view.range_m));
    if (maxRange < Math.max(keyframes[0].view.range_m, last.range_m) * 1.25) throw new Error('location-to-location must pull back enough to explain the geographic change');
  }

  const label = object(raw.destination_label, 'destination_label'); const labelText = text(label.text, 'destination_label.text', 42);
  if (labelText !== destination.display_label) throw new Error('destination label must match the verified brief display label');
  const reveal = finite(label.reveal_at_sec, 'destination_label.reveal_at_sec', 0, duration);
  if (reveal < arrival - .25 || reveal > arrival + .35) throw new Error('destination label must reveal at arrival');
  const fadeIn = finite(label.fade_in_sec ?? .25, 'destination_label.fade_in_sec', 0, .75); const fadeOut = finite(label.fade_out_sec ?? 0, 'destination_label.fade_out_sec', 0, .75);
  if (reveal + fadeIn > duration - 1) throw new Error('destination label is not readable for at least one second');
  const color = label.color ?? '#ffd65a'; if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('destination_label.color must be #RRGGBB');
  const safeZones = (raw.caption_safe_zones ?? []).map((item, i) => safeZone(item, `caption_safe_zones[${i}]`));
  for (const zone of safeZones) if (zone.x <= .5 && zone.x + zone.width >= .5 && zone.y <= .5 && zone.y + zone.height >= .5) throw new Error(`caption safe zone ${zone.id} obscures the destination point at frame centre`);
  const overlays = (raw.overlays ?? []).map((item, i) => verifiedOverlay(item, `overlays[${i}]`, duration));

  return {
    schema_version: 2, tool_id: TOOL_ID, mode, testing,
    editorial: { purpose: text(editorial.purpose, 'editorial.purpose'), narration: text(editorial.narration, 'editorial.narration'), context_note: text(editorial.context_note, 'editorial.context_note', 120), anchor: { text: text(anchor.text, 'editorial.anchor.text', 500), intended_placement: placement, timeline_reference: text(anchor.timeline_reference, 'editorial.anchor.timeline_reference', 160) } },
    geography: { locations, start_location_id: startId, destination_id: destinationId },
    providers: { imagery: { id: providers.imagery, ...imagery }, terrain: { id: providers.terrain, ...terrain }, permitted_layers: [...new Set(layers)], imagery_date: text(providers.imagery_date, 'providers.imagery_date', 200), retrieved_on: text(providers.retrieved_on, 'providers.retrieved_on', 32) },
    camera: { easing: camera.easing, keyframes },
    destination_label: { text: labelText, reveal_at_sec: reveal, fade_in_sec: fadeIn, fade_out_sec: fadeOut, color }, overlays, caption_safe_zones: safeZones,
    output: { format, width, height, fps, duration_sec: duration, codec: 'h264', pixel_format: 'yuv420p', fast_start: true, crf: finite(output.crf ?? 20, 'output.crf', 15, 35), capture_slowdown: finite(output.capture_slowdown ?? 1, 'output.capture_slowdown', 1, 8) },
  };
}

export function loadSpec(file) { const absolute = path.resolve(file); return { spec: normalizeSpec(JSON.parse(fs.readFileSync(absolute, 'utf8'))), path: absolute }; }
export function providerCatalogue() { return { imagery: IMAGERY, terrain: TERRAIN }; }
