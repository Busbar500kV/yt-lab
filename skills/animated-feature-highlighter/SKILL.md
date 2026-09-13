---
name: animated-feature-highlighter
description: Render a restrained animated outline and optional contextual dimming around an explicitly identified feature in a still image. Use when a documentary scene needs the viewer to locate precise evidence, a component, or a small detail; do not use for automatic segmentation, moving-video tracking, or decorative emphasis.
---

# Animated Feature Highlighter

Use the repository's `feature-highlighter` CLI and a JSON specification. Keep the
effect tied to the exact spoken or visual point: `editorial.feature` names what
must become obvious, and `editorial.scene` explains why the audience needs it.
If neither is specific, resolve the scene purpose before rendering.

Prepare rectangle or polygon coordinates in oriented source-image pixels, after
EXIF orientation is applied and before any resize or crop. Inspect the source at
native resolution, record the candidate points, and use an irregular polygon
only when a box would include misleading neighboring material. Choose `contain`
when all source context matters; choose `cover` with an explicit anchor when a
crop is editorially sound. The renderer rejects a selected point that lands
outside the visible output.

Run cleanup before and after work, fetch or verify sources from recorded recipes,
then render:

```bash
PYTHONPATH=src python3 -m feature_highlighter cleanup
PYTHONPATH=src python3 -m feature_highlighter render path/to/spec.json runtime/runs/RUN_ID
```

Review more than encoder success. Inspect source-to-output alignment at reveal,
full hold, and fade; inspect a 1:1 output detail for antialiasing and halo quality;
sample enough frames to see path progression; and evaluate an actual full-speed
playback when the environment permits. Check a phone-sized view for feature
obviousness, comfortable timing, retained context, and legibility. Record which
checks were direct frame inspection versus playback, and correct material defects
before review delivery.

Keep source identity, reuse basis, evidence URL, attribution, input hash, output
hashes, and the exact tool commit bound in the manifest. Never treat public
availability as reuse permission. Keep acquired sources, renders, and private mail
records in ignored runtime storage.

Version one requires an operator-supplied static region. It does not infer objects,
track motion, add captions, or decide that emphasis belongs in a scene. One image
source is intentionally unchanged; orientation, uniform scale, fit/crop offsets,
and the feature coordinates are recorded so production integration can be audited.
