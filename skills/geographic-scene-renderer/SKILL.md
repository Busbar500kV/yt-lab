---
name: geographic-scene-renderer
description: Render a short, sourced geographic establishing or terrain scene when a Hidden Order narration benefits from spatial context, using verified locations and an independently composed landscape or portrait camera move. Use for world-to-place views, terrain explanations, and sourced markers/routes; do not use as a mandatory globe intro or to simulate events.
---

# Geographic scene renderer

Use this skill only when geography materially helps the viewer understand the
spoken point. A map move is editorial evidence, not a default transition. Prefer
a still, archival source, or no geographic scene when place and scale are already
clear.

## Prepare the scene

1. Copy the nearest specification from
   `tools/geographic-scene-renderer/examples/`.
2. Write the exact narration in `editorial.narration` and state what the camera
   move proves or clarifies in `editorial.purpose`.
3. Verify latitude, longitude, place name, and every route or boundary against an
   authoritative or otherwise suitable source. Record each URL and verification
   date. Coordinate objects use `lat` then `lon`; overlay point arrays use
   `[lon, lat]`.
4. Use only a provider admitted by the tool. Confirm current source rights before
   production use; the upstream code licence does not license map imagery.
5. Label present-day imagery as modern context. Never imply it depicts a
   historical condition or event in progress.
6. Author camera start and destination separately for the episode format:
   1920×1080 for a landscape documentary or 1080×1920 for a short. Do not crop a
   landscape move into portrait after rendering. Keep the relevant place,
   attribution, and labels readable inside that format's safe areas.
7. Add only restrained, verified markers, boundaries, or routes. Never connect
   locations and call the line a road, river, pipeline, border, or journey unless
   the recorded source supports that exact geometry.

## Invoke

```bash
tools/geographic-scene-renderer/scripts/install-upstream.sh
node tools/geographic-scene-renderer/src/cli.mjs validate path/to/scene.json
GEOGRAPHIC_RENDER_GPU_GROUP=render node \
  tools/geographic-scene-renderer/src/cli.mjs render \
  path/to/scene.json runtime/geographic-scene-renderer/runs/RUN_ID/output
```

Run the repository cleanup command before and after the lab run. Keep runtime
tiles, Chromium state, videos, and mail records out of Git.

## Review

Inspect the opening, early and late movement, first overlay frame, final hold, and
closing frame. Also inspect a regular sample across the entire animation and a
phone-sized frame. Check:

- the place, terrain, and scale are correct for the narration;
- motion is continuous, comfortable, and free of missing-tile flashes;
- the final hold is long enough and does not isolate a misleading fragment;
- labels do not collide with captions and stay readable in the native aspect;
- imagery and terrain attribution remain visible;
- the scene says modern geographic context when historical narration could be
  misconstrued.

An encoder success, tile-ready flag, or contact sheet alone is not visual review.
On a headless machine, disclose if normal-speed playback could not be observed;
use timing metrics and dense frame sampling without calling that playback.

## Limits

Version 0.1.0 has no place search, automatic route creation, historical imagery,
event reconstruction, live tracking, voice operation, or paid provider support.
Live tiles can change and are not byte-identically reproducible. Complex line or
polygon visibility needs human frame review even when validation passes. Treat
the output as technically tested, visually inspected, owner accepted, or
production integrated only when the corresponding gate actually occurred.

