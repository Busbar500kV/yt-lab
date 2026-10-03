# Geographic scene renderer

`geographic-scene-renderer` 0.1.0 is a terminal adapter for short, sourced
geographic establishing scenes. It renders an independently composed landscape
or portrait camera move, optional verified overlays, attribution, preview frames,
a contact sheet, and an H.264/yuv420p fast-start MP4. It does not use voice AI,
tracking feeds, event simulation, or paid APIs.

The adapter reuses the pinned God's Eye View CesiumJS dependency and camera
semantics but not its dashboard or bundled data. Read `UPSTREAM_AUDIT.md` before
changing providers.

## Install

Requirements: Node.js 24, npm, FFmpeg/ffprobe, Git, and enough graphics access for
headless Chromium. The reproducible installer clones the exact audited upstream
revision and installs its locked dependencies and Chromium below ignored runtime
storage:

```bash
tools/geographic-scene-renderer/scripts/install-upstream.sh
```

On busbar, Chromium needs the existing `render` supplementary group:

```bash
export GEOGRAPHIC_RENDER_GPU_GROUP=render
```

No API key or billing account is used. The installer does not alter the system or
production repositories.

## Validate and render

Run cleanup before and after a lab session using the existing lab facility:

```bash
PYTHONPATH=src .venv/bin/python -m feature_highlighter cleanup
node tools/geographic-scene-renderer/src/cli.mjs validate \
  tools/geographic-scene-renderer/examples/mount-st-helens-landscape.json
GEOGRAPHIC_RENDER_GPU_GROUP=render node \
  tools/geographic-scene-renderer/src/cli.mjs render \
  tools/geographic-scene-renderer/examples/mount-st-helens-landscape.json \
  runtime/geographic-scene-renderer/runs/my-mount-st-helens/output
PYTHONPATH=src .venv/bin/python -m feature_highlighter cleanup
```

Output is `scene.mp4`, three JPEG previews, `contact-sheet.jpg`, and
`manifest.json`. The renderer refuses a non-empty output directory, less than 2
GiB free space, an unapproved provider ID, a destination outside the final view,
a centre collision with a caption exclusion zone, inconsistent timing, a failed
tile-readiness gate, black frames, or wrong encoded properties. The source tile
cache is bounded to 100 MiB.

## JSON contract

Coordinates are decimal WGS84 latitude and longitude. Arrays used by route or
boundary overlays are explicit `[longitude, latitude]` pairs. The contract has:

- `editorial`: scene purpose, exact narration, and an on-screen modern-context
  note;
- `geography`: source-verified locations and one destination ID;
- `providers`: allow-listed imagery and terrain plus permitted layers and data
  date disclosure;
- `camera`: start/destination views, cubic or linear easing, and opening, move,
  hold, and optional return timings;
- `overlays`: verified marker, route, or boundary with a source reference;
- `caption_safe_zones`: normalized output rectangles that the destination must
  not occupy;
- `output`: even dimensions, frame rate, total duration, H.264/yuv420p/fast-start
  requirements, CRF, and optional capture slowdown.

The start and destination are separately authored for each aspect ratio. The
tool does not stretch or crop an existing map image. Camera position and overlay
geometry share one WGS84-to-Cesium transformation in every frame.

## Tests and limitations

```bash
cd tools/geographic-scene-renderer
GEOGRAPHIC_RENDER_GPU_GROUP=render npm test
```

The deterministic fixture uses a generated grid and ellipsoid terrain. Live
demonstrations depend on changing remote tiles, so their effective specifications,
provider dates, tile-request statistics, and hashes are recorded, but byte-for-byte
reproduction is not claimed. The destination visibility check covers the evidence
point; complex overlays still require frame review. Headless rendering needs a
working WebGL implementation and is much slower under SwiftShader.

