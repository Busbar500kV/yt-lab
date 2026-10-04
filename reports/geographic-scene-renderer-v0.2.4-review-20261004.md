# Geographic scene renderer 0.2.4 review summary

Date: 2026-10-04

## Version and scope

- Tool ID: `geographic-scene-renderer`
- Tested implementation: `eebcbcf30f2f607f339631bf4fe0837efdf2f82b`
- Review-render snapshot: `c59f816690f01e4d33f44fa8df2d4d31260d3c16`
- Version tag: `tool/geographic-scene-renderer/v0.2.4`
- Upstream God's Eye View pin:
  `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee`
- Bootstrap draft:
  `docs/handoffs/geographic-scene-renderer-bootstrap-prompt.md`
- Explicitly excluded: `animated-feature-highlighter` and every previously
  integrated or unrelated capability

## Result and verification

- Explicit `earth-to-location` and `location-to-location` modes use fixed
  verified locations, narration anchors, time-based keyframes, brief labels, and
  native 16:9 or 9:16 composition. Every review clip arrives at 4.2 seconds and
  holds for 1.8 seconds within a 6.0-second total.
- Fourteen Node tests passed for the schema, both modes, ambiguity/location
  validation, camera endpoints, six-second/hold bounds, label binding, provider
  coverage/minimum range, native formats, safe zones, verified overlays,
  deterministic timing, provider failure, and end-to-end H.264/yuv420p/fast-start
  output. The fake-transport duplicate-prevention test also passed without a
  network call.
- Four native masters were 180 frames at 30 fps and exactly 6.0 seconds:
  landscape 1920×1080 Earth→Galle and Springfield→St. Louis; portrait 1080×1920
  Earth→Springfield and Galle→Mount Fuji.
- All passed codec, pixel format, fast-start, dimensions, duration/frame count,
  black-frame, capture-cadence, keyframe-readiness, and tile-ready-ratio gates.
  Ratios were 0.7656–0.9275 against the documented 0.75 minimum.
- Start, movement, arrival, and hold were inspected in 24 evenly sampled frames
  per clip plus phone-size arrival frames. Specific defects corrected before
  send were NASA regional seams, an ocean-dominated long-transition interval,
  stale imagery-date disclosure, and overlapping portrait footer text.
- Each MP4 decoded at real-time input rate on the headless host. This was an
  automated normal-speed decode, not human display playback; visual review used
  the sampled frames and phone-sized stills.
- Hardware WebGL 2 / Chrome 152 renders took 89.26–116.57 seconds. Peak
  orchestrator RSS was 110–199 MiB. Provider/API cost was $0; no key, billing,
  or paid service was enabled.

## Provider scope and limits

NASA EOSDIS GIBS Blue Marble supplies fixed 2004 worldwide Earth/regional
context and enforces a 120 km minimum destination range. USGS National Map
imagery permits closer framing only inside the configured contiguous-U.S. bounds.
Re:Earth/Mapterhorn supplies CC BY 4.0 terrain. Visible attribution and modern-
context disclosure are burned into the output. Blue Marble is not city/building
detail, and live terrain/provider availability prevents byte-identical promises.

## Owner review package

Run ID: `geo-review-v024-20261004-eebcbcf`

SMTP accepted the 3,980,526-byte MIME message. Inbox delivery is not confirmed.
Owner acceptance and production integration remain pending.

Attachments:

- `earth-to-galle-review-1280x720.mp4`
- `earth-to-springfield-review-720x1280.mp4`
- `springfield-to-st-louis-review-1280x720.mp4`
- `galle-to-mount-fuji-review-720x1280.mp4`
- `geographic-scene-renderer-v0.2.4-contact-sheet.jpg`
- `geographic-scene-renderer-bootstrap-prompt.md`

## Retention and cleanup

Cleanup during this revision reclaimed 787,079,403 bytes. The post-acceptance
phase accounts for 667,073,122 bytes, including all four full-resolution masters,
the older sent bundle, redundant tile cache, and Chromium profile. Retained
runtime state is the latest 2,992,061-byte accepted review bundle, its private
send record, 44,316 bytes of copied reproduction manifests, the reproducible
pinned upstream/npm checkout, and Chromium binary. Final reported free space was
35,470,147,584 bytes.

Lifecycle status is technically tested, visually inspected, and emailed for
owner review. It is not owner accepted and not integrated into production.
