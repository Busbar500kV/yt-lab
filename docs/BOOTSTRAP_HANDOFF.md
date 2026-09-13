# Production Bootstrap handoff

Candidate: animated feature highlighter `0.1.0`.

- Runtime dependencies: Python 3.10+, Pillow 10–11, FFmpeg/ffprobe with libx264.
- Examples: `examples/photo-portrait.json` and
  `examples/diagram-landscape.json`; tracked source records provide retrieval URLs,
  reuse evidence, attribution, and expected SHA-256 hashes.
- Verification: focused `unittest` geometry, invalid-input, media-property,
  repeatability, cleanup-safety, and fake-mail tests; exact review run evidence is
  recorded in `reports/DEMO_SUMMARY.md` after the owner package transaction.
- Output: silent phone-compatible MP4, preview JPEGs, and a hash-bound manifest.
- Policies to evaluate: coordinate-space naming, production source ledger mapping,
  approved output encoder profile, ownership registry integration, and whether
  production mail should remain wholly separate from this lab sender.
- Known boundary: explicit static regions only; no segmentation or video tracking.

Bootstrap should evaluate the tested commit recorded in the demo summary, rerun the
examples, and select/integrate a version independently. Lab test or SMTP status is
not production readiness.
