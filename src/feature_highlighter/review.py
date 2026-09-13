from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from .core import sha256_file
from .runtime import DEFAULT_PENDING_CAP, path_size, register_owned, set_source_pending


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default()


def _transcode(source: Path, target: Path, width: int, height: int) -> None:
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            "-vf", f"scale={width}:{height}:flags=lanczos", "-an", "-c:v", "libx264",
            "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-map_metadata", "-1", str(target),
        ],
        check=True,
    )


def _middle_preview(run_dir: Path, manifest: dict[str, Any]) -> Path:
    names = [name for name in manifest["output_hashes"] if name.startswith("preview-")]
    if not names:
        raise RuntimeError(f"no preview frames in {run_dir}")
    return run_dir / sorted(names)[len(names) // 2]


def _overview(image: Image.Image, box: tuple[int, int]) -> Image.Image:
    result = image.copy().convert("RGB")
    result.thumbnail(box, Image.Resampling.LANCZOS)
    return result


def _contact_sheet(samples: list[dict[str, Any]], target: Path) -> None:
    canvas = Image.new("RGB", (1600, 1120), (244, 244, 241))
    draw = ImageDraw.Draw(canvas)
    title_font = _font(34)
    body_font = _font(23)
    small_font = _font(19)
    draw.text((50, 32), "Feature highlighter — review frames", fill=(22, 24, 28), font=title_font)
    overview_slots = [(50, 105, 740, 670), (810, 105, 740, 670)]
    for sample, (x, y, width, height) in zip(samples, overview_slots):
        with Image.open(sample["preview"]) as opened:
            view = _overview(opened, (width, height - 70))
        canvas.paste(view, (x + (width - view.width) // 2, y))
        draw.text((x, y + height - 55), sample["label"], fill=(22, 24, 28), font=body_font)
        draw.text((x, y + height - 25), sample["feature"], fill=(55, 59, 65), font=small_font)

    detail_sample = samples[0]
    with Image.open(detail_sample["preview"]) as opened:
        full = opened.convert("RGB")
        points = detail_sample["manifest"]["geometry"]["output_region_points"]
        left = max(0, int(min(point[0] for point in points)) - 90)
        top = max(0, int(min(point[1] for point in points)) - 90)
        right = min(full.width, int(max(point[0] for point in points)) + 90)
        bottom = min(full.height, int(max(point[1] for point in points)) + 90)
        detail = full.crop((left, top, right, bottom))
    detail_x, detail_y = 50, 855
    canvas.paste(detail, (detail_x, detail_y))
    draw.rectangle(
        (detail_x - 1, detail_y - 1, detail_x + detail.width, detail_y + detail.height),
        outline=(80, 82, 88), width=1,
    )
    draw.text((500, 865), "1:1 pixel detail from the 1080p portrait render", fill=(22, 24, 28), font=body_font)
    draw.text((500, 905), "Use this crop to inspect outline edges and local alignment.", fill=(55, 59, 65), font=small_font)
    draw.text((500, 945), "Overview frames are reduced to fit this sheet.", fill=(55, 59, 65), font=small_font)
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, quality=90, optimize=True)


def package_review(
    runtime_root: Path,
    run_id: str,
    run_dirs: list[Path],
    *,
    commit: str,
    reproduce_command: str,
    inspection: dict[str, Any],
) -> dict[str, Any]:
    runtime_root = runtime_root.resolve()
    pending_root = runtime_root / "mail" / "pending"
    bundle = pending_root / run_id
    if bundle.exists():
        raise RuntimeError(f"pending review package already exists: {bundle}")
    current_pending = sum(path_size(path) for path in pending_root.iterdir()) if pending_root.exists() else 0
    if current_pending > DEFAULT_PENDING_CAP:
        raise RuntimeError("pending review queue already exceeds 50 MiB; send or explicitly discard it first")
    bundle.mkdir(parents=True)
    samples: list[dict[str, Any]] = []
    try:
        for index, run_dir in enumerate(run_dirs, start=1):
            manifest_path = run_dir / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            output = manifest["effective_specification"]["output"]
            portrait = int(output["height"]) > int(output["width"])
            width, height = ((720, 1280) if portrait else (1280, 720))
            feature = manifest["effective_specification"]["editorial"]["feature"]
            label = "Photograph" if index == 1 else "Technical figure"
            slug = "earth-over-lunar-horizon" if index == 1 else "steam-engine-linkage"
            clip = bundle / f"{index:02d}-{slug}-{width}x{height}.mp4"
            _transcode(run_dir / "highlight.mp4", clip, width, height)
            samples.append(
                {
                    "run_dir": str(run_dir.resolve()),
                    "manifest": manifest,
                    "preview": _middle_preview(run_dir, manifest),
                    "clip": clip,
                    "label": label,
                    "feature": feature,
                    "dimensions": f"{width}x{height}",
                }
            )
        sheet = bundle / "03-feature-highlighter-contact-sheet.jpg"
        _contact_sheet(samples, sheet)
        sample_lines = "\n".join(
            f"- {sample['clip'].name} ({sample['dimensions']}): {sample['feature']}."
            for sample in samples
        )
        body = f"""This is a yt-lab demonstration for feedback, not a production release.

Samples
{sample_lines}
- {sheet.name}: reduced overview frames plus a 1:1 detail from the 1080p portrait render for edge inspection.

Checks actually performed
{inspection['checks']}

Known limitations or unresolved defects
{inspection['limitations']}

Reproduce
Commit: {commit}
Command: {reproduce_command}

Feedback requested
1. Is the correct feature obvious?
2. Is the animation comfortable?
3. Is the image still readable?

Local retention
The ignored lab runtime keeps only the latest successfully emailed compact bundle (maximum 25 MiB). It becomes eligible for deletion after seven days on the next lab invocation. Full-resolution demonstration videos are removed after SMTP acceptance once reproducible source records and hashes are secured. No unattended expiry is claimed.
"""
        (bundle / "body.txt").write_text(body, encoding="utf-8")
        attachments = [sample["clip"] for sample in samples] + [sheet]
        package = {
            "schema_version": 1,
            "run_id": run_id,
            "tool": "feature-highlighter",
            "commit": commit,
            "reproduce_command": reproduce_command,
            "sample_run_dirs": [str(path.resolve()) for path in run_dirs],
            "attachments": [
                {"filename": path.name, "sha256": sha256_file(path), "bytes": path.stat().st_size}
                for path in attachments
            ],
        }
        (bundle / "package.json").write_text(json.dumps(package, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        projected = current_pending + path_size(bundle)
        if projected > DEFAULT_PENDING_CAP:
            raise RuntimeError("review package would exceed the 50 MiB pending queue cap")
        register_owned(runtime_root, bundle, "pending_bundle", run_id=run_id)
        set_source_pending(runtime_root, True)
        return package
    except BaseException:
        shutil.rmtree(bundle, ignore_errors=True)
        raise
