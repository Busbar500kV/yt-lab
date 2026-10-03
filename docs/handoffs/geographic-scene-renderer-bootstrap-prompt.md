# PREPARED FOR REVIEW — NOT AUTHORIZED FOR INTEGRATION

This draft is for owner review. It does not authorize Bootstrap execution,
production integration, episode approval, release, or publication.

## Scope

Inspect `/home/busbar/yt` first and preserve its production backbone, creative
workflow, policies, and review/release gates. If equivalent functionality is
already present, report it and skip duplicate files or behavior. Integrate only
the candidate capability with stable ID `geographic-scene-renderer`; never copy
or synchronize the full `yt-lab` repository.

Tested lab version: `0.2.4`

Immutable tag: `tool/geographic-scene-renderer/v0.2.4`

Exact tested commit: `eebcbcf30f2f607f339631bf4fe0837efdf2f82b`

Pinned God's Eye View commit: `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee`
(upstream package 0.2.1)

Explicitly exclude `animated-feature-highlighter` and every previously integrated
or unrelated capability. Do not rebuild, repackage, resubmit, or ask to
reintegrate them. Lab email, cleanup, caches, and runtime media are not production
payload.

Evaluate only:

- `tools/geographic-scene-renderer/`
- `skills/geographic-scene-renderer/SKILL.md`
- the `geographic-scene-renderer` entry in `tool-registry.json`
- this handoff as review evidence

## Creative and policy behavior

Expose two explicit, scene-selected modes to Episode Codex:

1. `earth-to-location`: use when narration first introduces the episode's
   initial physical location. Start with recognizable Earth, arrive at an extent
   appropriate to the city, canyon, building, island, or region, and show a brief
   verified label.
2. `location-to-location`: use for a meaningful change from the established
   story location. Pull back as needed, move to the next verified place, and
   arrive with a brief label. Do not restart from Earth.

These are available creative treatments, not mandatory footage. Do not use them
for every place-name mention, in episodes without a relevant physical setting,
or when geography does not aid comprehension. A return to a previous location
may use the second mode when it helps orientation.

Every clip must be at most six seconds, normally 5–6 seconds, with roughly
1.5–2 seconds of destination hold. If a move is too complex, simplify the path
or framing rather than exceed six seconds or rush. The narration must not wait
for the animation.

Camera movement shows spatial relationship; it must not imply an actual journey,
historical route, border, event movement, pipeline, road, or river without
verified supporting geometry and sources. Present modern imagery as modern
geographic context, never as historical conditions.

## Location and output contract

Keep location resolution separate from rendering. Episode Codex must resolve and
store the full place name, country, administrative region, feature type, episode
context, fixed WGS84 coordinate, target extent, verification date/method, source
references, and ambiguity resolution. Never silently accept the first geocoder
result. Stop on unresolved same-name ambiguity or unsupported coverage.

The scene spec must also contain the exact narration/dialogue anchor and intended
timeline placement, provider/date settings, fixed camera keyframes/easing,
destination hold, short display label, optional source-verified overlays,
caption/branding safe zones, and native output geometry. Render 1920×1080
documentary and 1080×1920 short scenes independently; do not stretch or crop one
from the other.

Output is a complete H.264/yuv420p fast-start MP4, representative JPEG previews,
a contact sheet, and a compact manifest. The manifest records the effective spec,
narrative placement, tool/upstream commits, sources/rights/dates, provider
settings, graphics/capture measurements, output properties, and hashes.

## Providers and repeatability

Candidate providers are keyless and were tested at $0 cost:

- NASA EOSDIS GIBS Blue Marble, a fixed 2004 global composite for worldwide
  Earth/regional context, with a 120 km minimum destination range;
- USGS National Map imagery for closer views only within the configured
  contiguous-U.S. bounds;
- Re:Earth/Mapterhorn terrain (CC BY 4.0; OSM watermask disabled).

Review the exact rights and attribution evidence in `UPSTREAM_AUDIT.md` and
reconfirm current terms before enabling production. Preserve visible provider
attribution. Do not enable paid services, billing, upstream default imagery, or
bundled non-commercial datasets without separate owner authorization. Fail on
missing tiles, blank terrain, unsupported detail, or provider error; never swap
in misleading imagery.

Fixed keyframes, timing, easing, target extents, and label placement are
repeatable from a fixed spec. Live remote provider behavior may change, so do not
promise byte-identical video. Preserve dependency/browser versions, retrieval
details, relevant hashes, and cache behavior allowed by provider terms.

## Dependencies, invocation, and tests

The adapter requires Node.js 24, FFmpeg/ffprobe, headless Chromium graphics, and
the locked Cesium/Puppeteer dependencies from the pinned upstream checkout. Its
own package adds no dependencies. Review the installer and upstream low-severity
DOMPurify audit note. Import neither the dashboard nor voice, surveillance,
tracking, AI, model, or paid-service components.

Reference invocation:

```bash
node tools/geographic-scene-renderer/src/cli.mjs render \
  tools/geographic-scene-renderer/examples/earth-to-galle-landscape.json \
  runtime/geographic-scene-renderer/runs/RUN_ID/output
```

Before enabling production, run production-local tests for both modes,
six-second/hold bounds, narration anchor, ambiguity and coordinate validation,
camera endpoints, labels, provider coverage/minimum extent, native 16:9/9:16,
safe-zone collision, provider failure, deterministic timing, source/provenance,
dimensions/duration/frame count, H.264/yuv420p/fast-start, blank frames, and tile
readiness. Render and inspect both aspect ratios, Earth and subsequent-location
moves, nearby and long transitions, and one correctly disambiguated duplicate
name.

Inspect actual clips at normal speed on a display and at phone size, plus start,
movement, arrival, hold, and dense sampled frames. Confirm geography, labels,
attribution, motion comfort, tile completeness, safe areas, and narration fit.
Retain the existing accessibility, provenance, deduplication, owner-review,
episode-approval, release, and publication gates.

## Rollback and status

Integrate in a bounded tool-only commit or range. Document how to disable/remove
the command, skill, provider configuration, runtime dependencies, and narrow
policy allowance without touching existing tools. Keep it disabled if rights,
attribution, graphics, coverage, or visual checks fail. Report the exact
production commit, test evidence, visual review, limitations, and rollback steps
to the owner.

Current status is technically tested and prepared for owner review only. Email
transport acceptance does not mean owner acceptance, and neither means production
integration or publication approval.
