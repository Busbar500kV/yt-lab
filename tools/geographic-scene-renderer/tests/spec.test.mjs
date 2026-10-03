import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSpec } from '../src/spec.mjs';
import { sampleTimeline, sampleView, shortestDegrees } from '../src/camera.mjs';
import fixture from './fixtures/valid-spec.json' with { type: 'json' };

const clone = () => structuredClone(fixture);

test('valid specification normalizes independent landscape geometry', () => {
  const spec = normalizeSpec(clone());
  assert.equal(spec.output.width, 640);
  assert.equal(spec.output.height, 360);
  assert.equal(spec.providers.imagery.id, 'test-grid');
  assert.equal(spec.camera.timing.start_hold_sec + spec.camera.timing.move_sec + spec.camera.timing.hold_sec, spec.output.duration_sec);
});

test('coordinates reject swapped or out-of-range latitude/longitude', () => {
  const raw = clone();
  raw.geography.locations[0].lat = -122.18;
  raw.geography.locations[0].lon = 46.2;
  assert.throws(() => normalizeSpec(raw), /lat/);
});

test('unknown or noncommercial provider is not admitted', () => {
  const raw = clone();
  raw.providers.imagery = 'esri-world-imagery';
  assert.throws(() => normalizeSpec(raw), /unsupported/);
});

test('test providers cannot enter a production specification', () => {
  const raw = clone();
  raw.testing = false;
  assert.throws(() => normalizeSpec(raw), /testing: true/);
});

test('caption exclusion zone cannot obscure destination point', () => {
  const raw = clone();
  raw.caption_safe_zones.push({ id: 'middle', x: .4, y: .4, width: .2, height: .2 });
  assert.throws(() => normalizeSpec(raw), /obscures/);
});

test('timing must sum exactly to duration', () => {
  const raw = clone();
  raw.output.duration_sec += 1;
  assert.throws(() => normalizeSpec(raw), /timing total/);
});

test('unverified overlay and invented route are rejected', () => {
  const raw = clone();
  raw.overlays[0].verified = false;
  assert.throws(() => normalizeSpec(raw), /explicitly verified/);
  const route = clone();
  route.overlays.push({ type:'route', label:'Unknown path', source_url:'https://example.invalid', verified:false, points:[[-1,1],[0,0]] });
  assert.throws(() => normalizeSpec(route), /explicitly verified/);
});

test('camera interpolation takes shortest dateline arc and repeats exactly', () => {
  assert.equal(shortestDegrees(179, -179), 2);
  const from={lat:0,lon:179,range_m:10_000,heading_deg:350,pitch_deg:-80};
  const to={lat:10,lon:-179,range_m:1_000,heading_deg:10,pitch_deg:-45};
  assert.deepEqual(sampleView(from,to,.375), sampleView(from,to,.375));
  assert.ok(sampleView(from,to,.5).lon > 179);
});

test('timeline has stable opening, movement, hold, and return phases', () => {
  const raw=clone(); raw.camera.timing.hold_sec=1;raw.camera.timing.return_sec=1;raw.output.duration_sec=4;
  const spec=normalizeSpec(raw);
  assert.equal(sampleTimeline(spec,.2).phase,'opening');
  assert.equal(sampleTimeline(spec,1).phase,'move');
  assert.equal(sampleTimeline(spec,2.2).phase,'hold');
  assert.equal(sampleTimeline(spec,3.5).phase,'return');
});
