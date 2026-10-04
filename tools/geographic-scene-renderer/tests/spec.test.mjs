import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSpec } from '../src/spec.mjs';
import { sampleTimeline, sampleView, shortestDegrees } from '../src/camera.mjs';
import fixture from './fixtures/valid-spec.json' with { type: 'json' };

const clone = () => structuredClone(fixture);
const secondLocation = () => ({
  id: 'start', display_label: 'Start Place', place_name: 'Start Place', country: 'Test Fixture', administrative_region: 'Synthetic Grid', feature_type: 'synthetic point',
  full_description: 'A second fixed point used to test location transitions.', lat: 45.5, lon: -121.5,
  extent: { west: -121.7, south: 45.3, east: -121.3, north: 45.7 },
  sources: [{ title: 'Tool fixture', url: 'https://example.invalid/start', role: 'deterministic coordinate fixture' }],
  verification: { status: 'verified', verified_on: '2026-10-03', method: 'Fixed test value.', ambiguity_status: 'not-ambiguous', ambiguity_note: 'Synthetic fixture has one identity.' },
});

function locationTransition() {
  const raw = clone(); raw.mode = 'location-to-location'; raw.editorial.anchor.intended_placement = 'meaningful-location-change';
  raw.geography.locations.push(secondLocation()); raw.geography.start_location_id = 'start';
  raw.start_label = { text: 'Start Place', reveal_at_sec: 0, fade_in_sec: 0, hide_at_sec: .85, fade_out_sec: .15, color: '#72d6ff' };
  raw.camera.keyframes = [
    { at_sec: 0, view: { lat: 45.5, lon: -121.5, range_m: 100000, heading_deg: 0, pitch_deg: -60 } },
    { at_sec: .75, view: { lat: 45.8, lon: -121.8, range_m: 700000, heading_deg: 0, pitch_deg: -75 } },
    { at_sec: 1.5, view: { lat: 46.2, lon: -122.18, range_m: 500000, heading_deg: 5, pitch_deg: -65 } },
  ];
  return raw;
}

test('earth-to-location keeps fixed anchor, provider, format, and endpoints', () => {
  const spec = normalizeSpec(clone());
  assert.equal(spec.mode, 'earth-to-location'); assert.equal(spec.editorial.anchor.intended_placement, 'initial-location-introduction');
  assert.equal(spec.output.format, 'landscape'); assert.equal(spec.output.duration_sec, 3); assert.equal(spec.providers.imagery.id, 'test-grid');
  assert.equal(spec.camera.keyframes.at(-1).view.lat, spec.geography.locations[0].lat);
});

test('location-to-location requires a verified start, pullback, and destination endpoint', () => {
  const spec = normalizeSpec(locationTransition());
  assert.equal(spec.mode, 'location-to-location'); assert.equal(spec.geography.start_location_id, 'start');
  assert.equal(spec.start_label.text, 'Start Place'); assert.equal(spec.destination_label.text, 'Fixture Point');
  assert.equal(sampleTimeline(spec, 0).view.lat, 45.5); assert.equal(sampleTimeline(spec, 2.5).phase, 'destination-hold');
});

test('location-to-location requires readable verified endpoint labels with no overlap', () => {
  const missing = locationTransition(); delete missing.start_label; assert.throws(() => normalizeSpec(missing), /start_label must be an object/);
  const wrong = locationTransition(); wrong.start_label.text = 'Wrong Start'; assert.throws(() => normalizeSpec(wrong), /start_label must match/);
  const tooBrief = locationTransition(); tooBrief.start_label.hide_at_sec = .5; assert.throws(() => normalizeSpec(tooBrief), /fully readable/);
  const overlaps = locationTransition(); overlaps.start_label.hide_at_sec = 1.1; overlaps.start_label.fade_out_sec = .2; assert.throws(() => normalizeSpec(overlaps), /clear before destination/);
  const earth = clone(); earth.start_label = { text: 'Fixture Point' }; assert.throws(() => normalizeSpec(earth), /must not define a start_label/);
});

test('six-second maximum and destination hold bounds are enforced', () => {
  const tooLong = clone(); tooLong.output.duration_sec = 6.1; assert.throws(() => normalizeSpec(tooLong), /between 3 and 6/);
  const rushed = clone(); rushed.camera.keyframes.at(-1).at_sec = 2; assert.throws(() => normalizeSpec(rushed), /destination hold/);
});

test('unresolved ambiguity and missing verification fail closed', () => {
  const ambiguous = clone(); ambiguous.geography.locations[0].verification.ambiguity_status = 'ambiguous'; assert.throws(() => normalizeSpec(ambiguous), /remains ambiguous/);
  const unverified = clone(); unverified.geography.locations[0].verification.status = 'candidate'; assert.throws(() => normalizeSpec(unverified), /explicitly verified/);
});

test('coordinates, extents, and camera endpoints reject mismatches', () => {
  const swapped = clone(); swapped.geography.locations[0].lat = -122.18; swapped.geography.locations[0].lon = 46.2; assert.throws(() => normalizeSpec(swapped), /lat|extent/);
  const endpoint = clone(); endpoint.camera.keyframes.at(-1).view.lat = 0; endpoint.camera.keyframes.at(-1).view.lon = 0; assert.throws(() => normalizeSpec(endpoint), /final camera target/);
});

test('provider coverage and resolution limits reject unsupported close-ups', () => {
  const outside = clone(); outside.testing = false; outside.providers.imagery = 'usgs-national-map-imagery'; outside.providers.terrain = 'reearth-terrain'; outside.geography.locations[0].lat = 6; outside.geography.locations[0].lon = 80; outside.geography.locations[0].extent = { west: 79.9, south: 5.9, east: 80.1, north: 6.1 }; outside.camera.keyframes.at(-1).view.lat = 6; outside.camera.keyframes.at(-1).view.lon = 80; assert.throws(() => normalizeSpec(outside), /outside .* supported coverage/);
  const tooClose = clone(); tooClose.testing = false; tooClose.providers.imagery = 'nasa-gibs-blue-marble'; tooClose.providers.terrain = 'reearth-terrain'; tooClose.camera.keyframes.at(-1).view.range_m = 10000; assert.throws(() => normalizeSpec(tooClose), /closer than/);
});

test('native format geometry rejects stretched or mislabeled output', () => {
  const raw = clone(); raw.output.format = 'portrait'; assert.throws(() => normalizeSpec(raw), /native 9:16/);
  const odd = clone(); odd.output.width = 641; assert.throws(() => normalizeSpec(odd), /even/);
});

test('brief destination label is bound to verified identity and arrival', () => {
  const wrong = clone(); wrong.destination_label.text = 'Somewhere Else'; assert.throws(() => normalizeSpec(wrong), /verified brief display label/);
  const early = clone(); early.destination_label.reveal_at_sec = .5; assert.throws(() => normalizeSpec(early), /reveal at arrival/);
  const long = clone(); long.geography.locations[0].display_label = 'A'.repeat(43); long.destination_label.text = long.geography.locations[0].display_label; assert.throws(() => normalizeSpec(long), /too long/);
});

test('mode and narrative placement cannot contradict each other', () => {
  const raw = clone(); raw.editorial.anchor.intended_placement = 'meaningful-location-change'; assert.throws(() => normalizeSpec(raw), /initial location introduction/);
  const transition = locationTransition(); delete transition.geography.start_location_id; assert.throws(() => normalizeSpec(transition), /distinct verified start/);
});

test('caption safe zone and unverified route fail closed', () => {
  const zone = clone(); zone.caption_safe_zones.push({ id: 'middle', x: .4, y: .4, width: .2, height: .2 }); assert.throws(() => normalizeSpec(zone), /obscures/);
  const route = clone(); route.overlays.push({ type: 'route', label: 'Unknown route', source_url: 'https://example.invalid', verified: false, points: [[-1, 1], [0, 0]] }); assert.throws(() => normalizeSpec(route), /explicitly verified/);
});

test('camera interpolation is deterministic and takes shortest longitude arc', () => {
  assert.equal(shortestDegrees(179, -179), 2);
  const from = { lat: 0, lon: 179, range_m: 10000, heading_deg: 350, pitch_deg: -80 }; const to = { lat: 10, lon: -179, range_m: 1000, heading_deg: 10, pitch_deg: -45 };
  assert.deepEqual(sampleView(from, to, .375), sampleView(from, to, .375)); assert.ok(sampleView(from, to, .5).lon > 179);
});

test('unknown provider and test-provider leakage are rejected', () => {
  const unknown = clone(); unknown.providers.imagery = 'esri-world-imagery'; assert.throws(() => normalizeSpec(unknown), /unsupported/);
  const leaked = clone(); leaked.testing = false; assert.throws(() => normalizeSpec(leaked), /testing: true/);
});
