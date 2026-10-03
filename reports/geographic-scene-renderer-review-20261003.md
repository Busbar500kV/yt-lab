# Geographic scene renderer 0.1.0 review summary

Date: 2026-10-03

## Version and scope

- Tool ID: `geographic-scene-renderer`
- Tested implementation: `07f759667ed2c5bc19941fd77bb0365c31a2674c`
- Review-render snapshot: `4b38a7f65df83b2f646bac442fd3a5c2bfb35312`
- Version tag: `tool/geographic-scene-renderer/v0.1.0`
- Upstream: God's Eye View
  `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee`
- Bootstrap draft:
  `docs/handoffs/geographic-scene-renderer-bootstrap-prompt.md`
- Explicitly excluded: animated feature highlighter and every previously
  integrated capability

## Verification

- 11 Node tests passed: specification and coordinate validation, provider
  allow-list and failed-provider behavior, caption collision, timing, overlay
  verification, repeatable camera timing, active-marker failure cleanup, and an
  end-to-end H.264/yuv420p/fast-start browser render.
- One fake-transport Python test passed for owner-recipient resolution, the
  geographic subject, and duplicate prevention. It made no network call.
- All three 10-second review masters were 300 frames at 30 fps. Landscape masters
  were 1920×1080; the portrait master was 1080×1920. All passed black-frame,
  tile-readiness, codec, pixel-format, duration, dimensions, and fast-start gates.
- Twenty evenly spaced frames per master, plus opening/movement/overlay/hold/
  closing states and phone-size hold frames, were visually inspected. No missing
  tile flash, crop error, mislabeled target, or material readability defect was
  found. Normal-speed playback was unavailable on the headless host; capture
  cadence metrics and dense frame inspection are not represented as playback.
- WebGL 2 / Chrome 152 hardware-group renders took 117.53–133.35 seconds each.
  Peak orchestrator RSS was 194,480–248,276 KiB. Tile-ready sample ratios were
  0.9451–0.9672.
- The pinned upstream lockfile had one low-severity indirect DOMPurify advisory,
  with no moderate, high, or critical finding. The adapter does not invoke that
  dependency; production must still reassess or remediate it.

## Owner review package

Run ID: `geo-review-20261003-4b38a7f`

SMTP accepted a 4,143,188-byte MIME message. Inbox delivery is not confirmed.
Owner acceptance and production integration remain pending.

Attachments:

- `world-to-mount-st-helens-review-1280x720.mp4`
- `grand-canyon-terrain-review-1280x720.mp4`
- `mount-rainier-place-review-720x1280.mp4`
- `geographic-scene-renderer-contact-sheet.jpg`
- `geographic-scene-renderer-bootstrap-prompt.md`

The review bundle uses USGS National Map imagery and Re:Earth/Mapterhorn terrain
with visible attribution. No API key, billing, paid call, voice AI, tracking feed,
or bundled non-commercial dataset was used.

## Retention and cleanup

All full-resolution review runs, failed/superseded renders, live tile cache,
temporary capture data, redundant Chromium headless shell, and disposable browser
profile were removed through registered lab-owned paths. Geographic work reclaimed
1,216,413,253 bytes over the development cycle. The latest 3,088,992-byte sent
bundle and 21,093 bytes of reproduction manifests remain under ignored runtime
storage. The pinned upstream checkout and the Chromium binary required to rerender
remain outside Git; both are reproducibly installable. Free space after final
cleanup was 35,337,781,248 bytes.

