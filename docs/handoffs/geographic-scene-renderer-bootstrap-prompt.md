# Draft Bootstrap prompt: geographic-scene-renderer only

Status: prepared for owner review. This prompt does **not** authorize Bootstrap
execution, production integration, episode approval, or publication.

## Requested scope

Inspect `/home/busbar/yt` first, preserve its production backbone and review
gates, and integrate only the lab capability with stable tool ID
`geographic-scene-renderer` if production does not already contain an equivalent
capability. Skip files or behavior already present. Do not copy or synchronize the
whole `yt-lab` repository.

The exact tested lab revision is
`07f75964e49f2ff92cd656424368061905238c36`. The immutable version is
`tool/geographic-scene-renderer/v0.1.0`. The audited upstream revision is God's
Eye View `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee` (package 0.2.1).

Explicitly exclude `animated-feature-highlighter` and every other previously
integrated or unrelated capability. Do not modify, repackage, resubmit, or ask to
reintegrate them. The lab mail/cleanup mechanisms and lab runtime are not part of
the production payload.

## Candidate files and dependency boundary

Evaluate only:

- `tools/geographic-scene-renderer/`
- `skills/geographic-scene-renderer/SKILL.md`
- the matching entry in `tool-registry.json`
- this handoff as review evidence

The adapter requires Node.js 24, FFmpeg/ffprobe, and the locked dependencies from
the pinned upstream checkout. Its own `package.json` adds no dependencies. Review
the reproducible installer and decide how production should cache/pin Chromium
and upstream npm packages without copying ignored lab runtime. Preserve the MIT
notice for upstream code and the separate third-party-data warning. Do not import
the upstream dashboard, bundled data, models, voice AI, surveillance/live-tracking
features, paid services, or credentials.

## Narrow production-policy allowance

Permit sourced geographic rendering only when a scene's verified location,
scale, terrain, boundary, or route materially improves comprehension of the
specific narration. Maps and globe introductions are optional creative tools,
not episode templates or mandatory transitions. Author native 1920×1080
documentary and 1080×1920 short compositions independently; do not stretch or
blindly crop one into the other.

The allowance must require:

- scene purpose and exact supporting narration;
- verified coordinates/place names and source references;
- provider-specific commercial reuse review, attribution, and data-date notes;
- only explicitly permitted layers;
- explicit camera/timing, overlays, caption-safe zones, and aspect ratio;
- a visible modern-context disclosure when contemporary imagery accompanies
  historical narration;
- review for geographic accuracy, phone readability, motion comfort, missing
  tiles, label/caption collisions, and source attribution;
- provenance and deduplication records, manifests/hashes, and all existing
  accessibility, owner-review, release, and publication gates.

Never infer or invent a road, river, pipeline, border, movement, or historical
event between coordinates. A route or boundary requires verified geometry and a
supporting source. Do not present current imagery as historical conditions or
simulate an event unfolding. Do not treat keyless/public access or an MIT code
licence as imagery permission.

For 0.1.0, the only production candidate sources are USGS National Map
`USGSImageryOnly` (public-domain service/data with acknowledgement; exclude
separately licensed Alaska imagery) and Re:Earth Terrain's Mapterhorn CC BY 4.0
terrain plus public-domain EGM2008, with the OSM watermask disabled. Reconfirm
current terms before adoption. The intended provider/API cost is $0; do not
enable billing or paid APIs without separate owner authorization.

## Invocation and outputs

The lab reference invocation is:

```bash
GEOGRAPHIC_RENDER_GPU_GROUP=render node \
  tools/geographic-scene-renderer/src/cli.mjs render \
  tools/geographic-scene-renderer/examples/mount-st-helens-landscape.json \
  runtime/geographic-scene-renderer/runs/RUN_ID/output
```

It returns a phone-compatible H.264/yuv420p fast-start MP4, three preview JPEGs,
a contact sheet, and a compact JSON manifest. The manifest records tool/upstream
revisions, the effective spec, geographic source and rights references, imagery
date disclosure, renderer/capture statistics, output properties, and hashes.
Remote live tiles change, so production must not claim byte-identical
reproducibility.

## Production validation and rollback

Before enabling the capability, run production-local tests for validation and
coordinate order, deterministic timing, failed providers, output dimensions,
duration/frame count, codec/pixel format/fast-start, blank or missing-tile frames,
caption-safe collisions, and a landscape plus portrait render. Inspect opening,
movement, overlay reveal, final hold, closing frames, dense animation samples,
and normal-speed playback on a suitable display. Confirm attribution and phone
readability. Record graphics mode, elapsed time, memory, disk use, provider dates,
and any system/browser packages production adds.

Integrate in a bounded commit or commit range affecting only this capability.
Document how to disable/remove its command, skill, runtime dependencies, policy
allowance, and provider configuration without touching existing production
capabilities. Keep the feature disabled or unavailable if rights, attribution,
tile readiness, or graphics checks fail. Report the exact production commit,
tests, visual review, rollback steps, and remaining limitations to the owner;
do not infer episode approval or publication permission.
