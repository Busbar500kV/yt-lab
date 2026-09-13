from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from feature_highlighter.runtime import CleanupPolicy, cleanup_runtime, register_owned


NOW = datetime(2026, 9, 13, 12, 0, tzinfo=timezone.utc)


class CleanupTests(unittest.TestCase):
    def test_confinement_skips_escape_entry(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            base = Path(raw)
            runtime = base / "runtime"
            runtime.mkdir()
            outside = base / "outside.txt"
            outside.write_text("keep", encoding="utf-8")
            (runtime / "ownership.json").write_text(
                json.dumps({"schema_version": 1, "items": [{"path": "../outside.txt", "category": "scratch", "created_at": "2026-01-01T00:00:00Z", "metadata": {}}]}),
                encoding="utf-8",
            )
            report = cleanup_runtime(runtime, now=NOW, write_report=False)
            self.assertTrue(outside.exists())
            self.assertTrue(report["skipped"])

    def test_active_run_and_unsent_package_are_protected(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw) / "runtime"
            active = runtime / "runs" / "active"
            active.mkdir(parents=True)
            (active / ".active.json").write_text("{}", encoding="utf-8")
            (active / "scratch.bin").write_bytes(b"x" * 10)
            pending = runtime / "mail" / "pending" / "review"
            pending.mkdir(parents=True)
            (pending / "clip.mp4").write_bytes(b"x" * 10)
            register_owned(runtime, active, "scratch")
            register_owned(runtime, pending, "pending_bundle")
            report = cleanup_runtime(runtime, now=NOW, write_report=False)
            self.assertTrue(active.exists())
            self.assertTrue(pending.exists())
            self.assertEqual(report["bytes_reclaimed"], 0)

    def test_sent_retention_keeps_only_latest_unexpired_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw) / "runtime"
            old = runtime / "mail" / "sent" / "old"
            latest = runtime / "mail" / "sent" / "latest"
            old.mkdir(parents=True)
            latest.mkdir(parents=True)
            (old / "a").write_bytes(b"old")
            (latest / "b").write_bytes(b"latest")
            register_owned(runtime, old, "sent_bundle", metadata={"accepted_at": "2026-09-10T00:00:00Z"})
            register_owned(runtime, latest, "sent_bundle", metadata={"accepted_at": "2026-09-12T00:00:00Z"})
            cleanup_runtime(runtime, now=NOW, write_report=False)
            self.assertFalse(old.exists())
            self.assertTrue(latest.exists())

    def test_latest_sent_bundle_expires_on_next_invocation_after_seven_days(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw) / "runtime"
            sent = runtime / "mail" / "sent" / "expired"
            sent.mkdir(parents=True)
            (sent / "clip").write_bytes(b"data")
            accepted = NOW - timedelta(days=7)
            register_owned(runtime, sent, "sent_bundle", metadata={"accepted_at": accepted.isoformat()})
            cleanup_runtime(runtime, now=NOW, write_report=False)
            self.assertFalse(sent.exists())

    def test_dry_run_reports_without_deleting(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw) / "runtime"
            scratch = runtime / "scratch" / "old"
            scratch.mkdir(parents=True)
            (scratch / "temp").write_bytes(b"123")
            register_owned(runtime, scratch, "scratch")
            report = cleanup_runtime(runtime, dry_run=True, now=NOW, write_report=False)
            self.assertTrue(scratch.exists())
            self.assertEqual(report["bytes_reclaimed"], 0)
            self.assertEqual(report["bytes_reclaimable"], 3)

    def test_pending_cap_blocks_without_deleting_unsent_data(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw) / "runtime"
            pending = runtime / "mail" / "pending" / "large"
            pending.mkdir(parents=True)
            (pending / "clip").write_bytes(b"12345")
            register_owned(runtime, pending, "pending_bundle")
            report = cleanup_runtime(
                runtime, now=NOW, policy=CleanupPolicy(pending_cap_bytes=4), write_report=False
            )
            self.assertTrue(report["pending_queue_blocked"])
            self.assertTrue(pending.exists())

    def test_source_cache_evicts_only_retrievable_nonpending_input(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            runtime = Path(raw) / "runtime"
            protected = runtime / "source_cache" / "protected"
            evictable = runtime / "source_cache" / "evictable"
            protected.parent.mkdir(parents=True)
            protected.write_bytes(b"1234")
            evictable.write_bytes(b"5678")
            common = {"retrieval_url": "https://example.invalid/source", "expected_sha256": "abc"}
            register_owned(runtime, protected, "source_cache", metadata={**common, "required_for_pending": True})
            register_owned(runtime, evictable, "source_cache", metadata={**common, "required_for_pending": False})
            cleanup_runtime(
                runtime, now=NOW, policy=CleanupPolicy(source_cap_bytes=4), write_report=False
            )
            self.assertTrue(protected.exists())
            self.assertFalse(evictable.exists())


if __name__ == "__main__":
    unittest.main()
