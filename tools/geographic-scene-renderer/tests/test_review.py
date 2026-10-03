from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "src"))

from feature_highlighter.core import sha256_file
from feature_highlighter.mail import send_review


MODULE_PATH = REPO / "tools" / "geographic-scene-renderer" / "scripts" / "package_review.py"
SPEC = importlib.util.spec_from_file_location("geographic_package_review", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class FakeTransport:
    def __init__(self) -> None:
        self.calls = 0
        self.subject = None

    def send(self, message, config):
        self.calls += 1
        self.subject = message["Subject"]
        return {"accepted": True, "response": "fake accepted"}


class ReviewMailTests(unittest.TestCase):
    def test_subject_and_accepted_batch_are_not_resent(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            runtime = root / "runtime"
            bundle = runtime / "mail" / "pending" / "geo-review-test"
            bundle.mkdir(parents=True)
            (bundle / "sample.txt").write_text("review", encoding="utf-8")
            (bundle / "body.txt").write_text("body", encoding="utf-8")
            package = {
                "schema_version": 1,
                "run_id": "geo-review-test",
                "commit": "a" * 40,
                "attachments": [{"filename": "sample.txt", "sha256": sha256_file(bundle / "sample.txt")}],
                "sample_run_dirs": [],
            }
            (bundle / "package.json").write_text(json.dumps(package), encoding="utf-8")
            config = root / "smtp.json"
            config.write_text(json.dumps({"from_addr": "lab@example.test", "to_addr": "wrong@example.test"}), encoding="utf-8")
            owner = root / "owner.json"
            owner.write_text(json.dumps({"owner_email": "owner@example.test"}), encoding="utf-8")
            fake = FakeTransport()
            transport = MODULE.GeographicSMTPTransport("geo-review-test", "a" * 40, delegate=fake)

            first = send_review(runtime, bundle, config, owner_config_path=owner, transport=transport)
            second = send_review(runtime, bundle, config, owner_config_path=owner, transport=transport)

            self.assertEqual(first["status"], "accepted")
            self.assertFalse(first["duplicate_skipped"])
            self.assertTrue(second["duplicate_skipped"])
            self.assertEqual(fake.calls, 1)
            self.assertEqual(first["recipient"], "owner@example.test")
            self.assertEqual(fake.subject, "[yt-lab] geographic-scene-renderer geo-review-test aaaaaaaaaaaa")


if __name__ == "__main__":
    unittest.main()

