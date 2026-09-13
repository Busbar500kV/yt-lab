#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from feature_highlighter.core import render  # noqa: E402
from feature_highlighter.runtime import cleanup_runtime, register_owned  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default=datetime.now(timezone.utc).strftime("demo-%Y%m%dT%H%M%SZ"))
    args = parser.parse_args()
    runtime = REPO_ROOT / "runtime"
    cleanup_runtime(runtime)
    subprocess.run([sys.executable, str(REPO_ROOT / "scripts" / "fetch_demo_sources.py")], check=True)
    jobs = [
        ("photo-portrait", REPO_ROOT / "examples" / "photo-portrait.json"),
        ("diagram-landscape", REPO_ROOT / "examples" / "diagram-landscape.json"),
    ]
    created: list[Path] = []
    try:
        for label, spec in jobs:
            run_dir = runtime / "runs" / f"{args.run_id}-{label}"
            try:
                render(spec, run_dir, repo_root=REPO_ROOT)
            except BaseException:
                if run_dir.exists():
                    register_owned(runtime, run_dir, "failed_render", run_id=args.run_id)
                raise
            register_owned(runtime, run_dir, "render_full", run_id=args.run_id)
            created.append(run_dir)
            print(run_dir.relative_to(REPO_ROOT))
        return 0
    finally:
        cleanup_runtime(runtime)


if __name__ == "__main__":
    raise SystemExit(main())
