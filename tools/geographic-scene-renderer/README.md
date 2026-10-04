# Geographic scene renderer

`geographic-scene-renderer` 0.2.5 turns a verified, fixed scene specification
into one of two deterministic clips, each no longer than six seconds:

- `earth-to-location` introduces the episode's initial physical setting from a
  recognizable Earth view.
- `location-to-location` names the established place on the opening footage,
  clears that label before transfer, then names the meaningful next setting at
  arrival without implying a journey or historical route.

The terminal adapter produces a native landscape or portrait H.264/yuv420p
fast-start MP4, preview frames, a contact sheet, and a hashed manifest. It adds
brief endpoint labels, a modern-context note, required attribution, and
optional source-verified geographic overlays. It does not geocode, invent
routes, reconstruct events, use voice AI, or call paid services.

## Install

Requirements are Node.js 24, npm, FFmpeg/ffprobe, Git, Chromium graphics access,
and 2 GiB free disk. The installer checks out the exact audited God's Eye View
revision below ignored runtime storage and installs its locked dependencies:

```bash
tools/geographic-scene-renderer/scripts/install-upstream.sh
```

On busbar the renderer automatically uses the already-authorized `render` GPU
group when available; `GEOGRAPHIC_RENDER_GPU_GROUP=render` can select it
explicitly. Software WebGL remains a slower fallback. No key or billing account
is used.

## Render

```bash
PYTHONPATH=src .venv/bin/python -m feature_highlighter cleanup
node tools/geographic-scene-renderer/src/cli.mjs validate \
  tools/geographic-scene-renderer/examples/earth-to-galle-landscape.json
node tools/geographic-scene-renderer/src/cli.mjs render \
  tools/geographic-scene-renderer/examples/earth-to-galle-landscape.json \
  runtime/geographic-scene-renderer/runs/my-galle/output
PYTHONPATH=src .venv/bin/python -m feature_highlighter cleanup
```

Output is `scene.mp4`, three preview JPEGs, `contact-sheet.jpg`, and
`manifest.json`. The renderer refuses a non-empty output directory, less than 2
GiB free, an unsupported provider or location, ambiguous/unverified identity,
inconsistent mode/timing, a destination outside its verified extent, a label or
caption-safe collision, failed keyframe readiness, deficient capture cadence,
black frames, less than 75% in-capture tile-ready samples, or wrong encoded
properties. The queue ratio is recorded and complements—not replaces—frame
inspection because Cesium can refine off-screen/next-level tiles while the
visible globe remains complete.

## JSON contract

Schema 2 separates location resolution from rendering. Resolve and verify every
place before authoring the scene; the renderer never chooses a geocoder result.
Coordinates are decimal WGS84 `lat`/`lon`; overlay point arrays are explicit
`[longitude, latitude]` pairs.

- `mode`: `earth-to-location` or `location-to-location`.
- `editorial`: purpose, narration, modern-context note, and a narration anchor
  with intended placement and timeline reference.
- `geography.locations`: stable IDs, brief labels, complete descriptions,
  feature types, coordinates, extents, references, verification method/date,
  and explicit ambiguity resolution.
- `providers`: allow-listed imagery/terrain, permitted layers, retrieval date,
  and imagery-date disclosure.
- `camera`: fixed, increasing keyframes and `linear` or `cubic-in-out` easing.
  Arrival must leave 1.5–2.25 seconds of destination hold.
- `start_label`: required only for `location-to-location`; an exact verified
  brief label visible on the opening location and cleared before arrival.
- `destination_label`: exact verified brief label and arrival-bound fade.
- `overlays`: optional verified route or boundary only; no inferred connections.
- `caption_safe_zones`: normalized rectangles kept clear of the destination
  label and centered subject.
- `output`: native 16:9 or 9:16 geometry, 3–6 seconds, frame rate, H.264,
  yuv420p, fast-start, CRF, and optional capture slowdown.

Landscape and portrait are separately composed; neither is a crop of the other.
The manifest records the effective specification, narrative anchor, tool and
upstream revisions, providers/rights/dates, graphics and capture statistics,
output properties, and hashes.

## Providers and limits

`usgs-national-map-imagery` supports closer framing only inside the configured
contiguous-U.S. bounds. `nasa-gibs-blue-marble` is a fixed 2004 global composite
for Earth and regional context; its 120 km minimum destination range is enforced
because it is not city/building-detail imagery. Re:Earth/Mapterhorn provides
terrain. All are keyless and cost $0 for these tests, subject to availability and
reasonable-use limits. See `UPSTREAM_AUDIT.md` for rights and attribution.

Live remote dependencies mean byte-identical output is not promised. A scene
needing unsupported close detail must fail or use a newly reviewed provider; it
must not silently substitute imagery. Modern geographic context is not evidence
of historical conditions.

## Tests and review

```bash
cd tools/geographic-scene-renderer
npm test
```

The deterministic end-to-end fixture uses a generated grid and ellipsoid. Tests
cover both modes, six-second/hold timing, location ambiguity and extents, camera
endpoints, provider coverage and minimum range, both transition labels, native formats, safe
zones, failure paths, deterministic interpolation, H.264/yuv420p/fast-start,
frame count, cleanup-safe active markers, and mail duplicate prevention.

For a live render inspect start, movement, arrival, and hold frames; a dense
sequence; phone-size views; and normal-speed playback on a display. Encoder
success and a contact sheet alone do not establish visual quality.
