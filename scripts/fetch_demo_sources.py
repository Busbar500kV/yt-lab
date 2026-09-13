#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from feature_highlighter.runtime import register_owned  # noqa: E402


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    cache = REPO_ROOT / "runtime" / "source_cache"
    cache.mkdir(parents=True, exist_ok=True)
    for record_path in sorted((REPO_ROOT / "examples" / "sources").glob("*.json")):
        record = json.loads(record_path.read_text(encoding="utf-8"))
        target = cache / record["filename"]
        if not target.exists():
            request = urllib.request.Request(
                record["retrieval_url"], headers={"User-Agent": "yt-lab-feature-highlighter/0.1"}
            )
            temporary = target.with_suffix(target.suffix + ".download")
            with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as output:
                while block := response.read(1024 * 1024):
                    output.write(block)
            temporary.replace(target)
        actual = hash_file(target)
        if actual != record["expected_sha256"]:
            raise RuntimeError(
                f"hash mismatch for {target.name}: expected {record['expected_sha256']}, got {actual}"
            )
        register_owned(
            REPO_ROOT / "runtime",
            target,
            "source_cache",
            metadata={
                "retrieval_url": record["retrieval_url"],
                "evidence_url": record["evidence_url"],
                "expected_sha256": actual,
                "required_for_pending": False,
            },
        )
        print(f"verified {target.name} {actual}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
