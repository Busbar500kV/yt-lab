from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from feature_highlighter.core import sha256_file
from feature_highlighter.mail import send_review
from feature_highlighter.runtime import register_owned


class FakeTransport:
    def __init__(self, *, fail: bool = False) -> None:
        self.calls = 0
        self.fail = fail

    def send(self, message, config):
        self.calls += 1
        if self.fail:
            raise TimeoutError("simulated uncertain response")
        return {"accepted": True, "message_identifier": message["Message-ID"]}


def make_bundle(runtime: Path, run_id: str) -> tuple[Path, Path]:
    bundle = runtime / "mail" / "pending" / run_id
    bundle.mkdir(parents=True)
    attachment = bundle / "sample.mp4"
    attachment.write_bytes(b"small fake attachment")
    (bundle / "body.txt").write_text("lab review", encoding="utf-8")
    package = {
        "schema_version": 1,
        "run_id": run_id,
        "tool": "feature-highlighter",
        "commit": "abc123",
        "sample_run_dirs": [],
        "attachments": [{"filename": attachment.name, "sha256": sha256_file(attachment), "bytes": attachment.stat().st_size}],
    }
    (bundle / "package.json").write_text(json.dumps(package), encoding="utf-8")
    register_owned(runtime, bundle, "pending_bundle", run_id=run_id)
    config = runtime / "fake-email.json"
    config.write_text(json.dumps({"from_addr": "lab@example.com", "to_addr": "owner@example.com"}), encoding="utf-8")
    return bundle, config


class MailTests(unittest.TestCase):
    def test_accepted_batch_is_not_sent_twice(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw) / "runtime"
            bundle, config = make_bundle(runtime, "run-1")
            fake = FakeTransport()
            first = send_review(runtime, bundle, config, transport=fake)
            second = send_review(runtime, bundle, config, transport=fake)
            self.assertEqual(fake.calls, 1)
            self.assertFalse(first["duplicate_skipped"])
            self.assertTrue(second["duplicate_skipped"])

    def test_ambiguous_send_is_recorded_and_not_retried(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw) / "runtime"
            bundle, config = make_bundle(runtime, "run-2")
            fake = FakeTransport(fail=True)
            with self.assertRaisesRegex(RuntimeError, "ambiguous"):
                send_review(runtime, bundle, config, transport=fake)
            with self.assertRaisesRegex(RuntimeError, "ambiguous"):
                send_review(runtime, bundle, config, transport=fake)
            self.assertEqual(fake.calls, 1)
            record = json.loads((runtime / "mail" / "records" / "run-2.json").read_text(encoding="utf-8"))
            self.assertEqual(record["status"], "ambiguous")


if __name__ == "__main__":
    unittest.main()
