from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from feature_highlighter.core import (
    SpecError,
    _outline_overlay,
    _rounded_vertices,
    compute_transform,
    load_spec,
    render,
    source_region_points,
    transform_and_validate_region,
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class GeometryTests(unittest.TestCase):
    def test_contain_transform_preserves_geometry(self) -> None:
        transform = compute_transform((400, 200), {"width": 200, "height": 200, "fit": "contain", "anchor": [0.5, 0.5]})
        self.assertEqual(transform.scale, 0.5)
        self.assertEqual(transform.point((100, 50)), (50, 75))

    def test_cover_rejects_region_cropped_out(self) -> None:
        transform = compute_transform((100, 100), {"width": 100, "height": 50, "fit": "cover", "anchor": [0.5, 0.5]})
        with self.assertRaisesRegex(SpecError, "not fully visible"):
            transform_and_validate_region([(10, 0), (20, 0), (20, 10)], (100, 100), transform)

    def test_region_outside_source_is_rejected(self) -> None:
        transform = compute_transform((100, 100), {"width": 100, "height": 100, "fit": "cover", "anchor": [0.5, 0.5]})
        with self.assertRaisesRegex(SpecError, "outside the oriented source"):
            transform_and_validate_region([(-1, 5), (5, 5), (5, 10)], (100, 100), transform)

    def test_rectangle_becomes_closed_corner_list(self) -> None:
        self.assertEqual(
            source_region_points({"type": "rectangle", "x": 2, "y": 3, "width": 5, "height": 7}),
            [(2, 3), (7, 3), (7, 10), (2, 10)],
        )

    def test_completed_outline_has_no_unique_endpoint_marker(self) -> None:
        closed = [(20, 20), (80, 20), (80, 80), (20, 80), (20, 20)]
        self.assertEqual(_rounded_vertices(closed, 1.0), closed[:-1])
        self.assertEqual(_rounded_vertices(closed[:3], 0.5), [closed[0], closed[2]])
        overlay = _outline_overlay(
            (100, 100), closed[:-1], 1.0, 1.0, (255, 216, 74), 8, 4
        )
        self.assertGreater(overlay.getchannel("A").getbbox()[2], 80)

    def test_exif_orientation_defines_coordinate_space(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            source = root / "rotated.jpg"
            image = Image.new("RGB", (40, 20), "red")
            exif = image.getexif()
            exif[274] = 6
            image.save(source, exif=exif)
            spec = _spec(source.name, width=20, height=40)
            spec_path = root / "spec.json"
            spec_path.write_text(json.dumps(spec), encoding="utf-8")
            _, _, loaded = load_spec(spec_path)
            self.assertEqual(loaded.size, (20, 40))


def _spec(source_path: str, *, width: int = 96, height: int = 64) -> dict:
    return {
        "source": {
            "path": source_path,
            "coordinate_space": "oriented_pixels",
            "identity": "synthetic geometry fixture",
            "reuse": {"basis": "created by test", "evidence_url": "https://example.invalid/test", "attribution": "test"},
        },
        "region": {"type": "polygon", "points": [[20, 15], [75, 12], [80, 45], [25, 50]]},
        "editorial": {"feature": "test quadrilateral", "scene": "geometry test"},
        "output": {"width": width, "height": height, "fps": 4, "duration": 1, "fit": "cover", "anchor": [0.5, 0.5], "crf": 24},
        "style": {"outline_color": "#FFD84A", "outline_width": 3, "outside_dimming": 0.3},
        "timing": {"start": 0, "reveal": 0.25, "hold": 0.5, "fade": 0.25},
    }


class RenderTests(unittest.TestCase):
    def test_repeatable_end_to_end_render_and_properties(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            source = root / "fixture.png"
            image = Image.new("RGB", (96, 64), "white")
            for x in range(96):
                image.putpixel((x, x % 64), (0, 0, 0))
            image.save(source)
            before = digest(source)
            spec_path = root / "spec.json"
            spec_path.write_text(json.dumps(_spec(source.name)), encoding="utf-8")
            first = render(spec_path, root / "first", repo_root=Path.cwd())
            second = render(spec_path, root / "second", repo_root=Path.cwd())
            self.assertEqual(before, digest(source), "source image changed")
            self.assertEqual(first["output_hashes"], second["output_hashes"])
            stream = first["output"]["streams"][0]
            self.assertEqual((stream["width"], stream["height"]), (96, 64))
            self.assertEqual(stream["codec_name"], "h264")
            self.assertEqual(stream["pix_fmt"], "yuv420p")
            self.assertEqual(int(stream["nb_frames"]), 4)
            self.assertAlmostEqual(float(first["output"]["format"]["duration"]), 1.0, places=2)

    def test_odd_output_dimension_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            source = root / "fixture.png"
            Image.new("RGB", (96, 64), "white").save(source)
            spec = _spec(source.name, width=95)
            path = root / "spec.json"
            path.write_text(json.dumps(spec), encoding="utf-8")
            with self.assertRaisesRegex(SpecError, "must be even"):
                render(path, root / "run", repo_root=Path.cwd())


if __name__ == "__main__":
    unittest.main()
