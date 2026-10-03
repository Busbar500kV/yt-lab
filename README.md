# yt-lab

This repository develops independent, reusable tools for Hidden Order. The
authoritative lifecycle catalogue is `tool-registry.json`. Integrated entries are
released lab capabilities and are excluded from subsequent tool handoffs.

## Released capability: animated feature highlighter

Version `0.1.0` is integrated in production. It animates a clean outline around
an explicitly supplied rectangle or polygon in a still image, optionally dimming
the area outside it. It preserves oriented source geometry through uniform resize,
source-derived padding, and explicit cover crops, and refuses a crop that hides any
selected point.

## Install and run the demonstrations

Requirements are Python 3.10+, Pillow 10–11, FFmpeg, and ffprobe. No service or web
interface is required.

```bash
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/python scripts/render_demo.py
```

The script invokes bounded cleanup, verifies both public-domain demonstration
sources against tracked retrieval records and hashes, then writes one portrait
photograph render and one landscape technical-figure render below ignored
`runtime/runs/`. Use a unique `--run-id NAME` when retaining multiple manual runs.

For a single specification:

```bash
.venv/bin/feature-highlighter render examples/photo-portrait.json runtime/runs/my-photo
```

Each run returns `highlight.mp4`, three representative JPEG frames, a compact
contact sheet, and `manifest.json`. MP4 output is H.264/yuv420p with fast-start
metadata and no audio; source images are never modified. Coordinates are pixels in
the EXIF-oriented source image, with origin at its upper-left.

Run tests and inspect cleanup without changing state:

```bash
PYTHONPATH=src python3 -m unittest discover -s tests -v
PYTHONPATH=src python3 -m feature_highlighter cleanup --dry-run
```

Status terms are intentionally separate: tests can pass; specific frames and
animation samples can be visually inspected; SMTP can accept a lab review package;
the owner can review it; and Production Bootstrap can integrate a tested version.
The registry records the highlighter's completed integration; none of these states
is inferred for a future tool.

## Candidate capability: geographic scene renderer

`geographic-scene-renderer` 0.2.2 is an independent candidate with explicit
Earth-to-location and location-to-location modes, fixed verified places, a
six-second ceiling, narration anchors, brief labels, and native landscape or
portrait composition. Episode Codex chooses scene purpose and timing; maps remain
scene-specific creative tools rather than mandatory intros. It is not integrated
into production. Installation, input contract, provider restrictions, and the
single-scene command are in
[`tools/geographic-scene-renderer/README.md`](tools/geographic-scene-renderer/README.md).

Its adapter has no package dependencies of its own. A reproducible installer
checks out the exact audited God's Eye View revision and installs its locked
Cesium/Puppeteer runtime below ignored storage. No voice AI, API keys, paid
services, live tracking, or bundled non-commercial datasets are enabled. NASA
Blue Marble supplies worldwide regional context; USGS remains limited to closer
contiguous-U.S. views.
