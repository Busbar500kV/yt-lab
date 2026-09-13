# yt-lab animated feature highlighter

This repository contains one reusable lab tool: it animates a clean outline around
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
the owner can later accept it; and Production Bootstrap can later integrate a
tested version. None of those states implies the next.
