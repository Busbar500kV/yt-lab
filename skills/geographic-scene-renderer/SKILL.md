---
name: geographic-scene-renderer
description: Render a verified Hidden Order geographic transition from Earth to the initial story location, or from one established location to a meaningful next location. Use when physical geography materially improves comprehension; do not use for passing place-name mentions, unsupported locations, invented travel, or mandatory map decoration.
---

# Geographic scene renderer

Use this skill when geography is part of the explanation. Do not add a globe or
map merely for motion. Episode Codex resolves editorial meaning, place identity,
extent, and timing; this renderer executes the fixed specification.

## Choose the mode

- Use `earth-to-location` once when the narrator first establishes the episode's
  initial physical setting. Begin with recognizable Earth and finish with enough
  surrounding geography to understand the feature.
- Use `location-to-location` for a genuine change from the already established
  story location. Pull back only as far as needed, transfer, and arrive. Use it
  for a useful return to an earlier place, not every name mention.
- If the path would feel frantic within six seconds, simplify its keyframes or
  widen the destination framing. Never exceed six seconds or imply an actual
  journey, historical route, or event movement without source support.

## Resolve before rendering

1. Record the full place name, country, administrative region, feature type,
   episode context, verified WGS84 coordinate, target extent, source URLs, method,
   and verification date.
2. Search for same-name cities, rivers, districts, landmarks, and countries.
   Mark ambiguity `resolved` with a note, or stop. Never take the first geocoder
   hit silently.
3. Fix the verified coordinates in the JSON. Rendering must not geocode again.
4. Use a short display label such as `Galle, Sri Lanka`. Keep the full identity
   and verification only in provenance.
5. Record the exact narration/dialogue anchor and intended placement. Treat
   modern imagery as modern context, not historical evidence.

Coordinate objects use `lat` then `lon`; overlay arrays use `[lon, lat]`.

## Compose and invoke

Copy the nearest schema-2 example under
`tools/geographic-scene-renderer/examples/`. Author 1920×1080 documentary and
1080×1920 short scenes independently. Keep the location, label, attribution,
and caption/branding safe zones visible; never post-crop one format into another.
Leave 1.5–2 seconds after arrival for recognition and label reading.

Use only an admitted provider. NASA Blue Marble is worldwide regional context,
not building detail; USGS is the closer-detail option only within configured
contiguous-U.S. coverage. Unsupported coverage or closer-than-supported framing
must fail. Never add a route or boundary unless its exact geometry is verified.

```bash
tools/geographic-scene-renderer/scripts/install-upstream.sh
node tools/geographic-scene-renderer/src/cli.mjs validate path/to/scene.json
node tools/geographic-scene-renderer/src/cli.mjs render \
  path/to/scene.json runtime/geographic-scene-renderer/runs/RUN_ID/output
```

Run repository cleanup before and after lab work. Keep upstream dependencies,
tiles, Chromium state, videos, and private mail state out of Git.

## Review

Inspect the actual clip at normal speed on a display and inspect start, transfer,
arrival, and hold frames plus a dense sequence and phone-size views. Confirm:

- the verified location and extent match the spoken point;
- Earth is recognizable in the initial mode, while subsequent moves do not
  unnecessarily restart there;
- movement is comfortable, continuous, and free of missing-tile flashes;
- destination geography remains recognizable and the brief label is readable;
- caption/branding zones stay clear and attribution remains legible;
- current imagery is not presented as a historical condition;
- the clip is at most six seconds and the destination hold is useful.

On a headless host, disclose that automated real-time decoding plus dense frame
inspection is not human playback. Do not turn technical testing, visual review,
email acceptance, owner acceptance, and production integration into one status.

## Limits

Version 0.2.3 has no geocoder, automatic extent selection, route generation,
historical imagery, event reconstruction, live tracking, voice control, or paid
provider. Live dependencies may change and are not byte-identically reproducible.
Human editorial review remains required for location meaning, framing, labels,
motion, rights, and every route or boundary.
