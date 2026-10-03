# Architecture and integration boundary

## Independent tool lifecycle

`tool-registry.json` is the authoritative compact catalogue. Each new tool gets a
stable ID, independent `tools/<tool-id>/` implementation, matching skill, tests,
fixtures, runtime namespace, version, and tool-scoped Bootstrap handoff. A handoff
offers only that tool and tells Bootstrap to inspect production and skip anything
already present; it never asks Bootstrap to synchronize the lab.

Shared code is introduced only after two implemented tools demonstrate the same
stable need, in a separate commit with regression coverage for every consumer.
Integrated tools are not reorganized to fit newer conventions. The animated
feature highlighter is the one legacy-layout capability and remains at its recorded
paths.

## Released highlighter contract

The JSON input has six small sections:

- `source`: path, `oriented_pixels` coordinate space, canonical identity, and
  reuse basis/evidence/attribution.
- `region`: a positive rectangle (`x`, `y`, `width`, `height`) or a polygon of at
  least three `[x, y]` source points.
- `editorial`: the exact `feature` and supporting `scene`.
- `output`: even dimensions, frame rate, duration, `contain` or `cover`, and a
  normalized crop/pad anchor. Optional CRF controls H.264 quality.
- `style`: `#RRGGBB` outline, pixel width, and outside dimming from 0 to 0.85.
- `timing`: start, reveal, hold, and fade durations that fit the output duration.

EXIF orientation is applied first. One uniform scale and x/y offset map source
points to output points. A cover crop is rejected unless every selected point is
visible. Contain padding uses a darkened, blurred crop of the source rather than a
flat matte.

The renderer holds one resized source frame and small masks in memory, generates a
locally supersampled antialiased outline, and streams RGB frames into FFmpeg. It
does not create an uncompressed frame sequence. The source stays unchanged.

Outputs are an H.264/yuv420p/fast-start MP4, three preview frames, a contact sheet,
and a manifest with source hash and rights references, effective specification,
transform, ffprobe properties, tool version/commit, and output hashes.

## Runtime and production boundary

`runtime/ownership.json` is the ignored deletion allow-list. Cleanup resolves each
registered path beneath `runtime/`, refuses symlinks and active runs, protects
pending packages, enforces the 25/50/100 MiB sent/pending/source defaults, and
reports before/after disk use. Seven-day deletion happens only on a later
invocation; there is no scheduler.

Mail packaging creates 720p review transcodes and a contact sheet from already
inspected 1080p runs. Sending takes SMTP credentials and sender identity from the
user-only SignalBrief configuration, but resolves the recipient separately from
the explicit Hidden Order owner policy. It is size checked on the encoded MIME
message, journaled before transport, and idempotent after acceptance. An exception
after send begins is recorded as ambiguous and blocks automatic retry. Compact
master manifests are copied into the retained reproduction-report area before the
full-resolution run directories become cleanup candidates.

The highlighter was integrated by production commit `74383dbb474581052868e9767b889e32cffd980d`.
Its historical handoff is closed and must not be reused by a later tool. Lab work
does not mutate production repositories or running services.

## Geographic scene renderer candidate

`geographic-scene-renderer` is independent of the released highlighter. Its Node
adapter lives under `tools/geographic-scene-renderer/`; the ignored upstream
checkout, locked npm installation, Chromium runtime, tile cache, renders, and
private review state live below `runtime/geographic-scene-renderer/` or the
existing repository-wide runtime mail namespace.

The schema-2 contract separates verified location resolution from rendering. It
combines one of two explicit narrative modes, an exact narration anchor,
source-verified WGS84 identities/coordinates/extents, an allow-listed
imagery/terrain pair, fixed time-based camera keyframes, a brief label, verified
overlays, safe zones, and native output geometry. Location objects are
latitude/longitude; overlay arrays are longitude/latitude. One Cesium WGS84
transformation drives camera, terrain, and overlays. Landscape and portrait are
separately composed rather than stretched or post-cropped.

The adapter serves a minimal local Cesium page. Before recording it verifies
authored keyframes and rehearses the deterministic path, then captures the
continuous WebGL animation through
a browser-owned compressed MediaStream and transcodes directly to final H.264.
It does not retain an uncompressed frame sequence. Output validation checks
dimensions, duration, frame count, pixel format, fast-start placement, blank
frames, tile readiness, and the destination projection. The compact manifest
records effective input, tool/upstream revisions, providers and rights, changing
data status, capture timing, renderer details, output properties, and hashes.

Version 0.2.4 adds NASA GIBS Blue Marble as fixed worldwide Earth/regional
context and retains USGS National Map for closer contiguous-U.S. framing, with
Re:Earth/Mapterhorn terrain. Provider-specific minimum framing and coverage are
enforced. Rights and attribution are contract data, not dashboard defaults. Live
dependencies may change, so output hashes do not imply byte-identical rerenders.
The production boundary is a tool-scoped Bootstrap review; no lab email or
handoff authorizes integration, episode approval, or publication.
