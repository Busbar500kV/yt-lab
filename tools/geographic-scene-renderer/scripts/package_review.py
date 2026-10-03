#!/usr/bin/env python3
"""Build a bounded owner-review bundle from three already-inspected runs.

This script creates artifacts only below ignored runtime storage. Sending is a
separate explicit `--send` operation that reuses the repository's established
idempotent mail and cleanup implementation.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "src"))

from feature_highlighter.core import sha256_file  # noqa: E402
from feature_highlighter.mail import SMTPTransport, send_review  # noqa: E402
from feature_highlighter.runtime import register_owned  # noqa: E402


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def transcode(source: Path, target: Path, width: int, height: int) -> None:
    run(
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(source),
        "-vf", f"scale={width}:{height}:flags=lanczos",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "28",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target),
    )


def attachment(path: Path) -> dict[str, str]:
    return {"filename": path.name, "sha256": sha256_file(path)}


class GeographicSMTPTransport:
    def __init__(self, run_id: str, commit: str, delegate=None) -> None:
        self.run_id = run_id
        self.commit = commit
        self.delegate = delegate or SMTPTransport()

    def send(self, message, config):
        del message["Subject"]
        message["Subject"] = (
            f"[yt-lab] geographic-scene-renderer {self.run_id} "
            f"{self.commit[:12]}"
        )
        return self.delegate.send(message, config)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--mount-st-helens-run", type=Path, required=True)
    parser.add_argument("--grand-canyon-run", type=Path, required=True)
    parser.add_argument("--mount-rainier-run", type=Path, required=True)
    parser.add_argument("--smtp-config", type=Path)
    parser.add_argument("--owner-config", type=Path)
    parser.add_argument("--send", action="store_true")
    args = parser.parse_args()

    runtime = REPO / "runtime"
    pending = runtime / "mail" / "pending" / args.run_id
    if pending.exists() and any(pending.iterdir()):
        raise SystemExit(f"refusing non-empty bundle: {pending}")
    pending.mkdir(parents=True, exist_ok=True)
    pending.chmod(0o700)

    runs = [args.mount_st_helens_run.resolve(), args.grand_canyon_run.resolve(), args.mount_rainier_run.resolve()]
    source_videos = [item / "output" / "scene.mp4" for item in runs]
    for video in source_videos:
        if not video.is_file():
            raise SystemExit(f"missing inspected video: {video}")

    names = [
        "world-to-mount-st-helens-review-1280x720.mp4",
        "grand-canyon-terrain-review-1280x720.mp4",
        "mount-rainier-place-review-720x1280.mp4",
    ]
    sizes = [(1280, 720), (1280, 720), (720, 1280)]
    videos = []
    for source, name, (width, height) in zip(source_videos, names, sizes, strict=True):
        target = pending / name
        transcode(source, target, width, height)
        videos.append(target)

    frames = []
    for index, source in enumerate(source_videos):
        frame = pending / f"contact-{index}.jpg"
        run("ffmpeg", "-y", "-loglevel", "error", "-ss", "7.5", "-i", str(source), "-frames:v", "1", "-q:v", "2", str(frame))
        frames.append(frame)
    contact = pending / "geographic-scene-renderer-contact-sheet.jpg"
    # Two landscape panels, a portrait panel, and a native-resolution detail crop.
    run(
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(frames[0]), "-i", str(frames[1]), "-i", str(frames[2]), "-i", str(frames[0]),
        "-filter_complex",
        "[0:v]scale=720:405[a];[1:v]scale=720:405[b];[2:v]scale=360:640[c];"
        "[3:v]crop=720:405:600:330[d];[a][b][c][d]xstack=inputs=4:"
        "layout=0_0|730_0|0_415|370_415:fill=0x111111[out]",
        "-map", "[out]", "-frames:v", "1", "-q:v", "3", str(contact),
    )
    for frame in frames:
        frame.unlink()

    prompt = REPO / "docs" / "handoffs" / "geographic-scene-renderer-bootstrap-prompt.md"
    prompt_copy = pending / "geographic-scene-renderer-bootstrap-prompt.md"
    shutil.copy2(prompt, prompt_copy)
    reproduction = pending / "reproduction"
    reproduction.mkdir()
    for run_dir, label in zip(runs, ("mount-st-helens", "grand-canyon", "mount-rainier"), strict=True):
        shutil.copy2(run_dir / "output" / "manifest.json", reproduction / f"{label}-manifest.json")

    body = f"""Hidden Order lab demonstration for feedback — geographic-scene-renderer 0.1.0

Run: {args.run_id}
Tested commit: {args.commit}

Samples (silent, 10 seconds each):
- world-to-mount-st-helens-review-1280x720.mp4 — establishes the continental/wider region, then identifies Mount St. Helens for narration about its southwest Washington location.
- grand-canyon-terrain-review-1280x720.mp4 — approaches the Grand Canyon terrain and Colorado River corridor for narration about the canyon system.
- mount-rainier-place-review-720x1280.mp4 — a native portrait composition identifying Mount Rainier and returning toward wider Washington context.
- geographic-scene-renderer-contact-sheet.jpg — representative final views plus a native-resolution detail crop for label and edge inspection.

Source permissions: imagery is the USGS National Map public-domain map service (USDA/USGS acknowledgement shown). Terrain is Re:Earth/Mapterhorn CC BY 4.0 plus public-domain EGM2008 (attribution shown; OSM watermask disabled). These are modern geographic-context scenes; imagery component dates vary. Provider/API cost was $0 and no paid services or keys were used.

Checks completed: specification/coordinate/timing/safe-zone/provider failure tests; deterministic camera timing; browser end-to-end render; H.264, yuv420p, fast-start, dimensions, duration, frame count, blank-frame and tile-readiness checks. Full-resolution 1920x1080 and 1080x1920 outputs were validated separately. Opening, movement, overlay reveal, final hold, closing frames, 20 evenly sampled frames, and phone-size stills were visually inspected. Normal-speed playback could not be observed on the headless server; cadence was checked from capture timing and dense frame sampling.

Known limits: live provider tiles can change and are not byte-identical; complex route/boundary visibility still needs human review; output depends on headless WebGL and is substantially slower with software rendering. This review does not mean owner acceptance or production integration.

Reproduce one sample:
GEOGRAPHIC_RENDER_GPU_GROUP=render node tools/geographic-scene-renderer/src/cli.mjs render tools/geographic-scene-renderer/examples/mount-st-helens-landscape.json runtime/geographic-scene-renderer/runs/review-reproduction/output

Feedback:
1. Is the intended geographic evidence immediately obvious?
2. Is enough wider geographic context preserved?
3. Is the movement comfortable and the place/terrain readable on a phone?

Local retention: after SMTP acceptance, full-resolution working renders and disposable caches are removed. Only the latest compact accepted review bundle (25 MiB cap), private send record, compact manifests/specifications, and reports remain. The accepted bundle becomes eligible for deletion after seven days on a later lab invocation; there is no unattended expiry service.

The attached Bootstrap prompt is a draft for owner review. It does not authorize production integration, episode approval, or publication.
"""
    (pending / "body.txt").write_text(body, encoding="utf-8")

    attachments = [attachment(item) for item in [*videos, contact, prompt_copy]]
    package = {
        "schema_version": 1,
        "run_id": args.run_id,
        "commit": args.commit,
        "attachments": attachments,
        "sample_run_dirs": [str(item) for item in runs],
    }
    (pending / "package.json").write_text(json.dumps(package, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    register_owned(runtime, pending, "pending_bundle", run_id=args.run_id)
    print(json.dumps({"bundle": str(pending), "bytes": sum(p.stat().st_size for p in pending.rglob("*") if p.is_file())}, indent=2))

    if args.send:
        if not args.smtp_config or not args.owner_config:
            raise SystemExit("--send requires --smtp-config and --owner-config")
        result = send_review(
            runtime, pending, args.smtp_config,
            owner_config_path=args.owner_config,
            transport=GeographicSMTPTransport(args.run_id, args.commit),
        )
        print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
