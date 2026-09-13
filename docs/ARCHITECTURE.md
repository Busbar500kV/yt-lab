# Architecture and integration boundary

## Contract

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
after send begins is recorded as ambiguous and blocks automatic retry.

Production Bootstrap should evaluate this repository as a candidate component. It
must decide interface/policy compatibility and integrate a selected commit
individually. Nothing here imports production code, mutates a production service,
runs a release workflow, or represents owner acceptance or production integration.
