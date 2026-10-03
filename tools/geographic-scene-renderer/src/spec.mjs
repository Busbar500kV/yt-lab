import fs from 'node:fs';
import path from 'node:path';

export const TOOL_ID = 'geographic-scene-renderer';
export const TOOL_VERSION = '0.1.0';
export const UPSTREAM_COMMIT = 'aa16b7c3b0166a89d8c7a6089e0aff53a22faaee';

const IMAGERY = Object.freeze({
  'usgs-national-map-imagery': {
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
    attribution: 'Imagery: USDA, USGS The National Map · data refreshed June 2024',
    rights_url: 'https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map',
    reuse_basis: 'USGS states National Map services and data are free and public domain; acknowledgement requested.',
  },
  'test-grid': {
    url: null,
    attribution: 'Synthetic test grid · not production evidence',
    rights_url: null,
    reuse_basis: 'Tool-generated deterministic test fixture.',
    testOnly: true,
  },
  'failed-test': {
    url: 'http://127.0.0.1:9/provider-must-fail',
    attribution: 'Intentional failed-provider fixture',
    rights_url: null,
    reuse_basis: 'Failure-path fixture.',
    testOnly: true,
  },
});

const TERRAIN = Object.freeze({
  'reearth-terrain': {
    url: 'https://terrain.reearth.land/cesium-mesh/ellipsoid',
    attribution: 'Terrain: Re:Earth / Mapterhorn (CC BY 4.0) · EGM2008 (public domain)',
    rights_url: 'https://github.com/reearth/reearth-terrain',
    reuse_basis: 'Mapterhorn terrain is CC BY 4.0; EGM2008 is a U.S. government work.',
  },
  ellipsoid: {
    url: null,
    attribution: 'Ellipsoid terrain · test only',
    rights_url: null,
    reuse_basis: 'Cesium ellipsoid generated in-process.',
    testOnly: true,
  },
});

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value;
}

function text(value, field, max = 4096) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  if (value.length > max) throw new Error(`${field} is too long`);
  return value.trim();
}

function finite(value, field, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${field} must be between ${min} and ${max}`);
  return Number(value);
}

function location(value, field) {
  object(value, field);
  return {
    id: text(value.id, `${field}.id`, 80),
    label: text(value.label, `${field}.label`, 120),
    lat: finite(value.lat, `${field}.lat`, -90, 90),
    lon: finite(value.lon, `${field}.lon`, -180, 180),
    source_url: text(value.source_url, `${field}.source_url`),
    verified_on: text(value.verified_on, `${field}.verified_on`, 32),
  };
}

function view(value, field) {
  object(value, field);
  return {
    lat: finite(value.lat, `${field}.lat`, -90, 90),
    lon: finite(value.lon, `${field}.lon`, -180, 180),
    range_m: finite(value.range_m, `${field}.range_m`, 100, 50_000_000),
    heading_deg: finite(value.heading_deg ?? 0, `${field}.heading_deg`, -360, 360),
    pitch_deg: finite(value.pitch_deg ?? -90, `${field}.pitch_deg`, -90, -10),
  };
}

function safeZone(value, field) {
  object(value, field);
  const result = {
    id: text(value.id, `${field}.id`, 80),
    x: finite(value.x, `${field}.x`, 0, 1),
    y: finite(value.y, `${field}.y`, 0, 1),
    width: finite(value.width, `${field}.width`, 0, 1),
    height: finite(value.height, `${field}.height`, 0, 1),
  };
  if (result.x + result.width > 1 || result.y + result.height > 1) throw new Error(`${field} extends outside the output`);
  return result;
}

function overlay(value, field, locationIds, duration) {
  object(value, field);
  const type = text(value.type, `${field}.type`, 32);
  if (!['marker', 'route', 'boundary'].includes(type)) throw new Error(`${field}.type is unsupported`);
  const result = {
    type,
    label: text(value.label, `${field}.label`, 100),
    source_url: text(value.source_url, `${field}.source_url`),
    verified: value.verified === true,
    reveal_at_sec: finite(value.reveal_at_sec ?? 0, `${field}.reveal_at_sec`, 0, duration),
    color: value.color ?? '#ffd65a',
  };
  if (!/^#[0-9a-f]{6}$/i.test(result.color)) throw new Error(`${field}.color must be #RRGGBB`);
  if (!result.verified) throw new Error(`${field} must be explicitly verified`);
  if (type === 'marker') {
    result.location_id = text(value.location_id, `${field}.location_id`, 80);
    if (!locationIds.has(result.location_id)) throw new Error(`${field}.location_id is unknown`);
  } else {
    if (!Array.isArray(value.points) || value.points.length < (type === 'route' ? 2 : 3)) throw new Error(`${field}.points has too few coordinates`);
    result.points = value.points.map((p, i) => {
      if (!Array.isArray(p) || p.length !== 2) throw new Error(`${field}.points[${i}] must be [lon, lat]`);
      return [finite(p[0], `${field}.points[${i}][0]`, -180, 180), finite(p[1], `${field}.points[${i}][1]`, -90, 90)];
    });
  }
  return result;
}

export function normalizeSpec(raw) {
  object(raw, 'specification');
  if (raw.schema_version !== 1) throw new Error('schema_version must be 1');
  if (raw.tool_id !== TOOL_ID) throw new Error(`tool_id must be ${TOOL_ID}`);
  const editorial = object(raw.editorial, 'editorial');
  const geography = object(raw.geography, 'geography');
  if (!Array.isArray(geography.locations) || !geography.locations.length) throw new Error('geography.locations must not be empty');
  const locations = geography.locations.map((item, i) => location(item, `geography.locations[${i}]`));
  const locationIds = new Set(locations.map((item) => item.id));
  if (locationIds.size !== locations.length) throw new Error('geography location IDs must be unique');
  const destinationId = text(geography.destination_id, 'geography.destination_id', 80);
  if (!locationIds.has(destinationId)) throw new Error('geography.destination_id is unknown');

  const providers = object(raw.providers, 'providers');
  const imagery = IMAGERY[text(providers.imagery, 'providers.imagery', 80)];
  const terrain = TERRAIN[text(providers.terrain, 'providers.terrain', 80)];
  if (!imagery) throw new Error('providers.imagery is unsupported');
  if (!terrain) throw new Error('providers.terrain is unsupported');
  const testing = raw.testing === true;
  if ((imagery.testOnly || terrain.testOnly) && !testing) throw new Error('test providers require testing: true');
  const layers = providers.permitted_layers;
  if (!Array.isArray(layers) || !layers.length || layers.some((item) => !['imagery', 'terrain'].includes(item))) {
    throw new Error('providers.permitted_layers may contain only imagery and terrain');
  }

  const camera = object(raw.camera, 'camera');
  const timing = object(camera.timing, 'camera.timing');
  const startHold = finite(timing.start_hold_sec, 'camera.timing.start_hold_sec', 0.25, 30);
  const move = finite(timing.move_sec, 'camera.timing.move_sec', 0.5, 60);
  const hold = finite(timing.hold_sec, 'camera.timing.hold_sec', 1, 60);
  const returnSec = finite(timing.return_sec ?? 0, 'camera.timing.return_sec', 0, 60);
  const calculatedDuration = startHold + move + hold + returnSec;
  if (!['linear', 'cubic-in-out'].includes(camera.easing)) throw new Error('camera.easing must be linear or cubic-in-out');

  const output = object(raw.output, 'output');
  const width = finite(output.width, 'output.width', 320, 3840);
  const height = finite(output.height, 'output.height', 180, 3840);
  if (width % 2 || height % 2) throw new Error('output dimensions must be even');
  const fps = finite(output.fps, 'output.fps', 12, 60);
  const duration = finite(output.duration_sec, 'output.duration_sec', 2, 120);
  if (Math.abs(duration - calculatedDuration) > 0.001) throw new Error(`output.duration_sec must equal camera timing total (${calculatedDuration})`);
  if (output.codec !== 'h264' || output.pixel_format !== 'yuv420p' || output.fast_start !== true) {
    throw new Error('output must request h264, yuv420p, and fast_start true');
  }

  const safeZones = (raw.caption_safe_zones ?? []).map((item, i) => safeZone(item, `caption_safe_zones[${i}]`));
  for (const zone of safeZones) {
    if (zone.x <= 0.5 && zone.x + zone.width >= 0.5 && zone.y <= 0.5 && zone.y + zone.height >= 0.5) {
      throw new Error(`caption safe zone ${zone.id} obscures the destination/evidence point at frame centre`);
    }
  }
  const overlays = (raw.overlays ?? []).map((item, i) => overlay(item, `overlays[${i}]`, locationIds, duration));

  return {
    schema_version: 1,
    tool_id: TOOL_ID,
    testing,
    editorial: {
      purpose: text(editorial.purpose, 'editorial.purpose'),
      narration: text(editorial.narration, 'editorial.narration'),
      context_note: text(editorial.context_note, 'editorial.context_note'),
    },
    geography: { locations, destination_id: destinationId },
    providers: {
      imagery: { id: providers.imagery, ...imagery },
      terrain: { id: providers.terrain, ...terrain },
      permitted_layers: [...new Set(layers)],
      imagery_date: text(providers.imagery_date, 'providers.imagery_date', 160),
    },
    camera: {
      start: view(camera.start, 'camera.start'),
      destination: view(camera.destination, 'camera.destination'),
      easing: camera.easing,
      timing: { start_hold_sec: startHold, move_sec: move, hold_sec: hold, return_sec: returnSec },
    },
    overlays,
    caption_safe_zones: safeZones,
    output: {
      width,
      height,
      fps,
      duration_sec: duration,
      codec: 'h264',
      pixel_format: 'yuv420p',
      fast_start: true,
      crf: finite(output.crf ?? 20, 'output.crf', 15, 35),
      capture_slowdown: finite(output.capture_slowdown ?? 1, 'output.capture_slowdown', 1, 8),
    },
  };
}

export function loadSpec(file) {
  const absolute = path.resolve(file);
  const raw = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  return { spec: normalizeSpec(raw), path: absolute };
}

export function providerCatalogue() {
  return { imagery: IMAGERY, terrain: TERRAIN };
}
