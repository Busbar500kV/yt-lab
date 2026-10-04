# Geographic scene renderer 0.2.5 dual-label review

Date: 2026-10-04

## Version and change

- Tool ID: `geographic-scene-renderer`
- Tested implementation: `641a60447bd5a4bd5a78e79a57de85aec6ae96b9`
- Review-render snapshot: `8594d66379b90ad7c1bbd9f90091624d8ca79844`
- Version tag: `tool/geographic-scene-renderer/v0.2.5`
- Pinned God's Eye View commit:
  `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee`
- Bootstrap draft:
  `docs/handoffs/geographic-scene-renderer-bootstrap-prompt.md`

`location-to-location` now requires a brief verified start label on the opening
footage and a brief verified destination label at arrival. The start label must
remain fully readable for at least 0.75 seconds and clear before arrival. Both
labels are projected and checked against output bounds and caption-safe zones at
their respective camera endpoints. Their text and timing are recorded in the
manifest. Earth-to-location behavior is unchanged.

## Verification

- Sixteen Node tests passed, including schema failures and deterministic
  end-to-end renders for Earth-to-location and a dual-label location transition.
- The fake-transport duplicate-prevention test passed without network access.
- The skill validator passed.
- Native masters were H.264/yuv420p/fast-start, 180 frames at 30 fps, and
  exactly 6.0 seconds: Springfield to St. Louis at 1920×1080 and Galle to Mount
  Fuji at 1080×1920.
- Springfield to St. Louis rendered in 110.66 seconds with 195,796 KiB peak
  orchestrator RSS and a 0.9217 tile-ready sample ratio.
- Galle to Mount Fuji rendered in 113.25 seconds with 207,284 KiB peak
  orchestrator RSS and a 0.7621 tile-ready ratio. Both exceeded the documented
  0.75 gate and passed blank-frame, cadence, dimensions, duration, codec, pixel
  format, frame-count, and fast-start checks.
- Each start label was inspected at 0.45 seconds, through its fade, and after its
  1.20-second clearance; movement, 4.20-second arrival, and 1.80-second hold were
  inspected in 24 evenly sampled frames. Opening and arrival frames were also
  inspected at phone size. Both MP4s decoded at real-time input rate on the
  headless host. This was automated normal-speed decoding, not human display
  playback; visual review used extracted frames.

## Owner review package

Run ID: `geo-review-v025-dual-label-20261004-641a604`

SMTP accepted the 2,436,584-byte encoded message at 2026-10-04T00:53:14Z.
Inbox delivery is not confirmed. Owner acceptance and production integration
remain pending.

Attachments:

- `springfield-to-st-louis-dual-label-review-1280x720.mp4`
- `galle-to-mount-fuji-dual-label-review-720x1280.mp4`
- `geographic-scene-renderer-v0.2.5-dual-label-contact-sheet.jpg`
- `geographic-scene-renderer-bootstrap-prompt.md`

## Cleanup and retention

Cleanup reclaimed 142,143,024 bytes: the superseded accepted v0.2.4 bundle,
both full-resolution v0.2.5 masters and redundant previews, inspection scratch,
the browser profile, and the bounded tile cache. The latest 1,833,888-byte sent
bundle, 29,306 bytes of separate reproduction manifests, pinned upstream
checkout, Chromium binary, source cache, specifications, code, tests, and
private send record remain. The sent bundle follows the seven-day-on-next-run
retention rule; there is no unattended expiry service.

Status is technically tested, visually inspected, and emailed for owner review.
It is not owner accepted and not integrated into production.
