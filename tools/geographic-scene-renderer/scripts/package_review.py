#!/usr/bin/env python3
"""Build or send the bounded 0.2.5 endpoint-label revision review bundle."""

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
        "-vf", f"scale={width}:{height}:flags=lanczos", "-an", "-c:v", "libx264",
        "-preset", "medium", "-crf", "28", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(target),
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
        message["Subject"] = f"[yt-lab] geographic-scene-renderer {self.run_id} {self.commit[:12]}"
        return self.delegate.send(message, config)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--nearby-run", type=Path, required=True)
    parser.add_argument("--long-run", type=Path, required=True)
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

    runs = [args.nearby_run.resolve(), args.long_run.resolve()]
    source_videos = [item / "output" / "scene.mp4" for item in runs]
    for video in source_videos:
        if not video.is_file():
            raise SystemExit(f"missing inspected video: {video}")

    names = [
        "springfield-to-st-louis-dual-label-review-1280x720.mp4",
        "galle-to-mount-fuji-dual-label-review-720x1280.mp4",
    ]
    sizes = [(1280, 720), (720, 1280)]
    videos: list[Path] = []
    for source, name, (width, height) in zip(source_videos, names, sizes, strict=True):
        target = pending / name
        transcode(source, target, width, height)
        videos.append(target)

    frames: list[Path] = []
    for index, source in enumerate(source_videos):
        for stage, at in (("start", "0.45"), ("arrival", "5.0")):
            frame = pending / f"contact-{index}-{stage}.jpg"
            run("ffmpeg", "-y", "-loglevel", "error", "-ss", at, "-i", str(source),
                "-frames:v", "1", "-q:v", "2", str(frame))
            frames.append(frame)
    contact = pending / "geographic-scene-renderer-v0.2.5-dual-label-contact-sheet.jpg"
    # Each transition's start and arrival, plus a full-resolution start-label detail.
    run(
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(frames[0]), "-i", str(frames[1]), "-i", str(frames[2]),
        "-i", str(frames[3]), "-i", str(frames[0]), "-filter_complex",
        "[0:v]scale=640:360[a];[1:v]scale=640:360[b];[2:v]scale=203:360[c];"
        "[3:v]scale=203:360[d];[4:v]crop=640:360:640:360[e];"
        "[a][b][c][d][e]xstack=inputs=5:layout=0_0|650_0|1300_0|1513_0|436_370:"
        "fill=0x111111[out]", "-map", "[out]", "-frames:v", "1", "-q:v", "3",
        str(contact),
    )
    for frame in frames:
        frame.unlink()

    prompt = REPO / "docs" / "handoffs" / "geographic-scene-renderer-bootstrap-prompt.md"
    prompt_copy = pending / "geographic-scene-renderer-bootstrap-prompt.md"
    shutil.copy2(prompt, prompt_copy)
    reproduction = pending / "reproduction"
    reproduction.mkdir()
    labels = ("springfield-st-louis", "galle-fuji")
    for run_dir, label in zip(runs, labels, strict=True):
        shutil.copy2(run_dir / "output" / "manifest.json", reproduction / f"{label}-manifest.json")

    body = f"""Hidden Order lab revision for feedback — geographic-scene-renderer 0.2.5

Run: {args.run_id}
Tested tool commit: {args.commit}
Status: PREPARED FOR REVIEW — NOT AUTHORIZED FOR INTEGRATION

Revised samples (silent, 6.0 seconds each):
- springfield-to-st-louis-dual-label-review-1280x720.mp4 — LOCATION TO LOCATION, nearby native landscape transition. The opening footage says “Springfield, Illinois”; that label clears before transfer; arrival says “St. Louis, Missouri.”
- galle-to-mount-fuji-dual-label-review-720x1280.mp4 — LOCATION TO LOCATION, substantial native portrait transition. The opening footage says “Galle, Sri Lanka”; that label clears before transfer; arrival says “Mount Fuji, Japan.”
- geographic-scene-renderer-v0.2.5-dual-label-contact-sheet.jpg — opening and arrival frames for both transitions, plus a native-resolution Springfield start-label detail.

The start label is fully readable for 0.95 seconds and clears at 1.20 seconds. The destination arrives at 4.2 seconds and holds for 1.8 seconds. The 720p attachments are email copies; native 1920x1080 and 1080x1920 masters were separately validated.

Sources/permissions/cost: NASA EOSDIS GIBS Blue Marble is a fixed 2004 worldwide composite used for regional geographic context under NASA Earthdata's open-data policy with acknowledgement. USGS National Map imagery is public-domain U.S. government data with acknowledgement. Re:Earth/Mapterhorn terrain is CC BY 4.0. Required attribution is burned in. No keys, paid API, billing, or provider charge were used.

Checks completed: schema and render tests plus fake-transport duplicate prevention; both modes; six-second/hold limits; narration anchors; verified location identity/ambiguity/extents; camera endpoints; required start and destination labels; label timing and safe-zone checks; provider coverage/minimum framing; native aspect ratios; provider failure; deterministic interpolation; H.264/yuv420p/fast-start dimensions, duration and frame count; blank-frame and tile-readiness gates. Both revised native masters were inspected at start, label fade, movement, arrival and hold, as dense sequences and at phone size. Real-time decode was exercised at normal speed on this headless host; visual inspection used frames because no human display was available.

Known limits: NASA Blue Marble is regional context, not city/building detail, and the tool rejects closer than 120 km with that provider. USGS close detail is bounded to the contiguous United States. Remote terrain/provider availability can change, so byte-identical rerenders are not promised. Human editorial review is still required; these maps are not evidence of historical conditions or actual travel.

Reproduce one sample:
node tools/geographic-scene-renderer/src/cli.mjs render tools/geographic-scene-renderer/examples/springfield-to-st-louis-landscape.json runtime/geographic-scene-renderer/runs/review-reproduction/output

Feedback:
1. Are both the starting and destination locations immediately obvious?
2. Does the start-label fade leave the movement comfortable and uncluttered?
3. Are both labels, geography, and attribution readable on a phone?

Local retention: after SMTP acceptance, full-resolution working renders and disposable caches are removed. The latest compact accepted bundle is retained under the 25 MiB cap with private send state and compact reproduction records. It becomes eligible for deletion after seven days on a later lab invocation; no unattended expiry service exists.

The attached Bootstrap prompt is a draft only. Emailing it does not authorize production integration, episode approval, or publication.
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
    (pending / "package.json").write_text(
        json.dumps(package, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    register_owned(runtime, pending, "pending_bundle", run_id=args.run_id)
    bundle_bytes = sum(path.stat().st_size for path in pending.rglob("*") if path.is_file())
    print(json.dumps({"bundle": str(pending), "bytes": bundle_bytes}, indent=2))

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
