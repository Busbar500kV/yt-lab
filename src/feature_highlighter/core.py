from __future__ import annotations

import hashlib
import json
import math
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

from . import __version__


class SpecError(ValueError):
    """A specification cannot produce a safe, geometrically correct result."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _finite_number(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise SpecError(f"{name} must be a number")
    result = float(value)
    if not math.isfinite(result):
        raise SpecError(f"{name} must be finite")
    return result


def _positive(value: Any, name: str) -> float:
    result = _finite_number(value, name)
    if result <= 0:
        raise SpecError(f"{name} must be greater than zero")
    return result


def _dimension(value: Any, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise SpecError(f"{name} must be a positive integer")
    return value


def _hex_color(value: Any) -> tuple[int, int, int]:
    if not isinstance(value, str) or len(value) != 7 or value[0] != "#":
        raise SpecError("style.outline_color must be #RRGGBB")
    try:
        return tuple(int(value[index : index + 2], 16) for index in (1, 3, 5))  # type: ignore[return-value]
    except ValueError as exc:
        raise SpecError("style.outline_color must be #RRGGBB") from exc


def source_region_points(region: dict[str, Any]) -> list[tuple[float, float]]:
    kind = region.get("type")
    if kind == "rectangle":
        x = _finite_number(region.get("x"), "region.x")
        y = _finite_number(region.get("y"), "region.y")
        width = _positive(region.get("width"), "region.width")
        height = _positive(region.get("height"), "region.height")
        return [(x, y), (x + width, y), (x + width, y + height), (x, y + height)]
    if kind == "polygon":
        raw_points = region.get("points")
        if not isinstance(raw_points, list) or len(raw_points) < 3:
            raise SpecError("polygon region.points must contain at least three points")
        points: list[tuple[float, float]] = []
        for index, point in enumerate(raw_points):
            if not isinstance(point, list) or len(point) != 2:
                raise SpecError(f"region.points[{index}] must be [x, y]")
            points.append(
                (
                    _finite_number(point[0], f"region.points[{index}][0]"),
                    _finite_number(point[1], f"region.points[{index}][1]"),
                )
            )
        return points
    raise SpecError("region.type must be rectangle or polygon")


@dataclass(frozen=True)
class Transform:
    scale: float
    offset_x: float
    offset_y: float
    output_width: int
    output_height: int

    def point(self, point: tuple[float, float]) -> tuple[float, float]:
        return (
            point[0] * self.scale + self.offset_x,
            point[1] * self.scale + self.offset_y,
        )


def compute_transform(
    source_size: tuple[int, int], output: dict[str, Any]
) -> Transform:
    source_width, source_height = source_size
    width = _dimension(output.get("width"), "output.width")
    height = _dimension(output.get("height"), "output.height")
    if width % 2 or height % 2:
        raise SpecError("output width and height must be even for yuv420p")
    mode = output.get("fit")
    if mode not in {"contain", "cover"}:
        raise SpecError("output.fit must be contain or cover")
    anchor = output.get("anchor", [0.5, 0.5])
    if not isinstance(anchor, list) or len(anchor) != 2:
        raise SpecError("output.anchor must be [x, y]")
    anchor_x = _finite_number(anchor[0], "output.anchor[0]")
    anchor_y = _finite_number(anchor[1], "output.anchor[1]")
    if not (0 <= anchor_x <= 1 and 0 <= anchor_y <= 1):
        raise SpecError("output.anchor values must be between zero and one")
    ratios = (width / source_width, height / source_height)
    scale = min(ratios) if mode == "contain" else max(ratios)
    scaled_width = source_width * scale
    scaled_height = source_height * scale
    return Transform(
        scale=scale,
        offset_x=(width - scaled_width) * anchor_x,
        offset_y=(height - scaled_height) * anchor_y,
        output_width=width,
        output_height=height,
    )


def transform_and_validate_region(
    points: Iterable[tuple[float, float]],
    source_size: tuple[int, int],
    transform: Transform,
) -> list[tuple[float, float]]:
    source_width, source_height = source_size
    source_points = list(points)
    for x, y in source_points:
        if x < 0 or y < 0 or x > source_width or y > source_height:
            raise SpecError("selected region extends outside the oriented source image")
    result = [transform.point(point) for point in source_points]
    epsilon = 0.01
    for x, y in result:
        if (
            x < -epsilon
            or y < -epsilon
            or x > transform.output_width + epsilon
            or y > transform.output_height + epsilon
        ):
            raise SpecError("selected region is not fully visible after fit/crop")
    return result


def _validate_text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise SpecError(f"{name} must be a non-empty string")
    return value.strip()


def load_spec(spec_path: Path) -> tuple[dict[str, Any], Path, Image.Image]:
    try:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SpecError(f"cannot read JSON specification: {exc}") from exc
    if not isinstance(spec, dict):
        raise SpecError("specification root must be an object")
    source = spec.get("source")
    if not isinstance(source, dict):
        raise SpecError("source must be an object")
    path_value = _validate_text(source.get("path"), "source.path")
    if source.get("coordinate_space") != "oriented_pixels":
        raise SpecError("source.coordinate_space must be oriented_pixels")
    _validate_text(source.get("identity"), "source.identity")
    reuse = source.get("reuse")
    if not isinstance(reuse, dict):
        raise SpecError("source.reuse must be an object")
    for key in ("basis", "evidence_url", "attribution"):
        _validate_text(reuse.get(key), f"source.reuse.{key}")
    source_path = (spec_path.parent / path_value).resolve()
    if not source_path.is_file():
        raise SpecError(f"source image does not exist: {source_path}")
    try:
        with Image.open(source_path) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
    except OSError as exc:
        raise SpecError(f"cannot decode source image: {exc}") from exc
    editorial = spec.get("editorial")
    if not isinstance(editorial, dict):
        raise SpecError("editorial must be an object")
    _validate_text(editorial.get("feature"), "editorial.feature")
    _validate_text(editorial.get("scene"), "editorial.scene")
    return spec, source_path, image


def validate_spec(spec: dict[str, Any], image: Image.Image) -> tuple[Transform, list[tuple[float, float]]]:
    output = spec.get("output")
    if not isinstance(output, dict):
        raise SpecError("output must be an object")
    fps = _positive(output.get("fps"), "output.fps")
    duration = _positive(output.get("duration"), "output.duration")
    if fps > 120:
        raise SpecError("output.fps must not exceed 120")
    transform = compute_transform(image.size, output)
    region = spec.get("region")
    if not isinstance(region, dict):
        raise SpecError("region must be an object")
    transformed = transform_and_validate_region(source_region_points(region), image.size, transform)
    style = spec.get("style")
    if not isinstance(style, dict):
        raise SpecError("style must be an object")
    _hex_color(style.get("outline_color"))
    _positive(style.get("outline_width"), "style.outline_width")
    dimming = _finite_number(style.get("outside_dimming", 0), "style.outside_dimming")
    if not 0 <= dimming <= 0.85:
        raise SpecError("style.outside_dimming must be between 0 and 0.85")
    timing = spec.get("timing")
    if not isinstance(timing, dict):
        raise SpecError("timing must be an object")
    start = _finite_number(timing.get("start", 0), "timing.start")
    reveal = _positive(timing.get("reveal"), "timing.reveal")
    hold = _positive(timing.get("hold"), "timing.hold")
    fade = _positive(timing.get("fade"), "timing.fade")
    if start < 0 or start + reveal + hold + fade > duration + 1e-9:
        raise SpecError("reveal/hold/fade timing must fit within output.duration")
    return transform, transformed


def _base_frame(image: Image.Image, transform: Transform, fit: str) -> Image.Image:
    width, height = transform.output_width, transform.output_height
    if fit == "contain":
        cover_scale = max(width / image.width, height / image.height)
        cover_size = (round(image.width * cover_scale), round(image.height * cover_scale))
        background = image.resize(cover_size, Image.Resampling.LANCZOS)
        left = max(0, (background.width - width) // 2)
        top = max(0, (background.height - height) // 2)
        background = background.crop((left, top, left + width, top + height))
        background = ImageEnhance.Brightness(background.filter(ImageFilter.GaussianBlur(24))).enhance(0.42)
    else:
        background = Image.new("RGB", (width, height))
    resized = image.resize(
        (round(image.width * transform.scale), round(image.height * transform.scale)),
        Image.Resampling.LANCZOS,
    )
    background.paste(resized, (round(transform.offset_x), round(transform.offset_y)))
    return background


def _polygon_mask(size: tuple[int, int], points: list[tuple[float, float]], aa: int = 4) -> Image.Image:
    high = Image.new("L", (size[0] * aa, size[1] * aa), 0)
    draw = ImageDraw.Draw(high)
    draw.polygon([(round(x * aa), round(y * aa)) for x, y in points], fill=255)
    return high.resize(size, Image.Resampling.LANCZOS)


def _partial_path(points: list[tuple[float, float]], fraction: float) -> list[tuple[float, float]]:
    closed = points + [points[0]]
    lengths = [math.dist(a, b) for a, b in zip(closed, closed[1:])]
    target = sum(lengths) * max(0.0, min(1.0, fraction))
    result = [closed[0]]
    for a, b, length in zip(closed, closed[1:], lengths):
        if target >= length:
            result.append(b)
            target -= length
            continue
        if length > 0 and target > 0:
            ratio = target / length
            result.append((a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio))
        break
    return result


def _rounded_vertices(
    path: list[tuple[int, int]], fraction: float
) -> list[tuple[int, int]]:
    return path[:-1] if fraction >= 1.0 else [path[0], path[-1]]


def _outline_overlay(
    size: tuple[int, int],
    points: list[tuple[float, float]],
    fraction: float,
    opacity: float,
    color: tuple[int, int, int],
    width: float,
    aa: int = 4,
) -> Image.Image:
    path = _partial_path(points, fraction)
    if len(path) < 2 or opacity <= 0:
        return Image.new("RGBA", size, (0, 0, 0, 0))
    alpha = round(255 * max(0.0, min(1.0, opacity)))
    luminance = (0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]) / 255
    halo = (0, 0, 0, alpha) if luminance >= 0.48 else (255, 255, 255, alpha)
    inner_width = max(1, round(width * aa))
    halo_width = inner_width + max(2 * aa, round(width * aa * 0.85))
    margin = math.ceil(halo_width / aa) + 3
    left = max(0, math.floor(min(x for x, _ in points) - margin))
    top = max(0, math.floor(min(y for _, y in points) - margin))
    right = min(size[0], math.ceil(max(x for x, _ in points) + margin))
    bottom = min(size[1], math.ceil(max(y for _, y in points) + margin))
    overlay = Image.new("RGBA", ((right - left) * aa, (bottom - top) * aa), (0, 0, 0, 0))
    scaled = [(round((x - left) * aa), round((y - top) * aa)) for x, y in path]
    draw = ImageDraw.Draw(overlay)
    rounded = _rounded_vertices(scaled, fraction)
    draw.line(scaled, fill=halo, width=halo_width, joint="curve")
    halo_radius = halo_width // 2
    for x, y in rounded:
        draw.ellipse((x - halo_radius, y - halo_radius, x + halo_radius, y + halo_radius), fill=halo)
    draw.line(scaled, fill=(*color, alpha), width=inner_width, joint="curve")
    radius = inner_width // 2
    for x, y in rounded:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*color, alpha))
    local = overlay.resize((right - left, bottom - top), Image.Resampling.LANCZOS)
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    result.alpha_composite(local, (left, top))
    return result


def _animation_state(t: float, timing: dict[str, Any]) -> tuple[float, float]:
    start = float(timing.get("start", 0))
    reveal = float(timing["reveal"])
    hold = float(timing["hold"])
    fade = float(timing["fade"])
    if t < start:
        return 0.0, 0.0
    if t < start + reveal:
        progress = (t - start) / reveal
        return progress, min(1.0, progress * 1.5)
    if t < start + reveal + hold:
        return 1.0, 1.0
    if t < start + reveal + hold + fade:
        opacity = 1 - (t - start - reveal - hold) / fade
        return 1.0, opacity
    return 1.0, 0.0


def compose_frame(
    base: Image.Image,
    region_mask: Image.Image,
    points: list[tuple[float, float]],
    spec: dict[str, Any],
    time_seconds: float,
    fully_dimmed: Image.Image | None = None,
) -> Image.Image:
    fraction, opacity = _animation_state(time_seconds, spec["timing"])
    dimming = float(spec["style"].get("outside_dimming", 0)) * opacity
    if dimming > 0:
        if fully_dimmed is None:
            fully_dimmed = ImageEnhance.Brightness(base).enhance(
                1 - float(spec["style"].get("outside_dimming", 0))
            )
        dimmed = Image.blend(base, fully_dimmed, opacity)
        frame = Image.composite(base, dimmed, region_mask)
    else:
        frame = base.copy()
    overlay = _outline_overlay(
        base.size,
        points,
        fraction,
        opacity,
        _hex_color(spec["style"]["outline_color"]),
        float(spec["style"]["outline_width"]),
    )
    return Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")


def _git_revision(repo_root: Path) -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short=12", "HEAD"],
            cwd=repo_root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except subprocess.CalledProcessError:
        return "uncommitted"


def _probe_video(path: Path) -> dict[str, Any]:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name,width,height,pix_fmt,avg_frame_rate,nb_frames:format=duration,size",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def _save_previews(
    run_dir: Path,
    base: Image.Image,
    mask: Image.Image,
    points: list[tuple[float, float]],
    spec: dict[str, Any],
) -> list[Path]:
    timing = spec["timing"]
    times = [
        float(timing.get("start", 0)) + float(timing["reveal"]) * 0.5,
        float(timing.get("start", 0)) + float(timing["reveal"]) + float(timing["hold"]) * 0.5,
        float(timing.get("start", 0)) + float(timing["reveal"]) + float(timing["hold"]) + float(timing["fade"]) * 0.5,
    ]
    paths: list[Path] = []
    for index, timestamp in enumerate(times, start=1):
        path = run_dir / f"preview-{index:02d}-{timestamp:.2f}s.jpg"
        compose_frame(base, mask, points, spec, timestamp).save(path, quality=90, optimize=True)
        paths.append(path)
    thumb_width = min(480, base.width)
    thumbs = []
    for path in paths:
        with Image.open(path) as image:
            thumb = image.copy()
            thumb.thumbnail((thumb_width, 480), Image.Resampling.LANCZOS)
            thumbs.append(thumb)
    sheet = Image.new("RGB", (max(im.width for im in thumbs), sum(im.height for im in thumbs)), "white")
    cursor = 0
    for thumb in thumbs:
        sheet.paste(thumb, ((sheet.width - thumb.width) // 2, cursor))
        cursor += thumb.height
    sheet_path = run_dir / "contact-sheet.jpg"
    sheet.save(sheet_path, quality=88, optimize=True)
    paths.append(sheet_path)
    return paths


def render(spec_path: Path, run_dir: Path, *, repo_root: Path | None = None) -> dict[str, Any]:
    if run_dir.exists():
        raise SpecError(f"run directory already exists: {run_dir}")
    spec, source_path, image = load_spec(spec_path)
    transform, points = validate_spec(spec, image)
    free = shutil.disk_usage(run_dir.parent).free
    reserve = int(os.environ.get("FEATURE_HIGHLIGHTER_FREE_RESERVE_BYTES", 2 * 1024**3))
    if free < reserve:
        raise SpecError(f"insufficient free disk space: {free} bytes available, {reserve} required")
    run_dir.mkdir(parents=True)
    active = run_dir / ".active.json"
    active.write_text(json.dumps({"pid": os.getpid(), "run_dir": str(run_dir.resolve())}) + "\n", encoding="utf-8")
    video_path = run_dir / "highlight.mp4"
    try:
        base = _base_frame(image, transform, spec["output"]["fit"])
        mask = _polygon_mask(base.size, points)
        fully_dimmed = ImageEnhance.Brightness(base).enhance(
            1 - float(spec["style"].get("outside_dimming", 0))
        )
        fps = float(spec["output"]["fps"])
        duration = float(spec["output"]["duration"])
        frame_count = round(fps * duration)
        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{base.width}x{base.height}",
            "-r", str(fps), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium",
            "-crf", str(spec["output"].get("crf", 18)), "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-map_metadata", "-1", str(video_path),
        ]
        encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
        assert encoder.stdin is not None
        try:
            for frame_index in range(frame_count):
                frame = compose_frame(base, mask, points, spec, frame_index / fps, fully_dimmed)
                encoder.stdin.write(frame.tobytes())
            encoder.stdin.close()
            status = encoder.wait()
        except BaseException:
            encoder.kill()
            encoder.wait()
            raise
        if status != 0:
            raise RuntimeError(f"ffmpeg exited with status {status}")
        previews = _save_previews(run_dir, base, mask, points, spec)
        root = repo_root or spec_path.resolve().parents[1]
        manifest = {
            "schema_version": 1,
            "tool": {"name": "feature-highlighter", "version": __version__, "commit": _git_revision(root)},
            "input": {
                "sha256": sha256_file(source_path),
                "oriented_dimensions": {"width": image.width, "height": image.height},
                "identity": spec["source"]["identity"],
                "reuse": spec["source"]["reuse"],
            },
            "effective_specification": spec,
            "geometry": {
                "scale": transform.scale,
                "offset": [transform.offset_x, transform.offset_y],
                "output_region_points": [[x, y] for x, y in points],
            },
            "output": _probe_video(video_path),
            "output_hashes": {
                path.name: sha256_file(path) for path in [video_path, *previews]
            },
        }
        (run_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return manifest
    finally:
        active.unlink(missing_ok=True)
