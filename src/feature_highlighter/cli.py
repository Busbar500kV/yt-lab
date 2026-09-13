from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import SpecError, render
from .runtime import RuntimeSafetyError, cleanup_runtime, register_owned
from .mail import send_review
from .review import package_review


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="feature-highlighter")
    subparsers = parser.add_subparsers(dest="command", required=True)
    render_parser = subparsers.add_parser("render", help="render a JSON specification")
    render_parser.add_argument("spec", type=Path)
    render_parser.add_argument("run_dir", type=Path)
    cleanup_parser = subparsers.add_parser("cleanup", help="apply bounded runtime retention rules")
    cleanup_parser.add_argument("--runtime-root", type=Path, default=Path("runtime"))
    cleanup_parser.add_argument("--dry-run", action="store_true")
    package_parser = subparsers.add_parser("package-review", help="make a compact owner review bundle")
    package_parser.add_argument("run_id")
    package_parser.add_argument("run_dirs", nargs="+", type=Path)
    package_parser.add_argument("--commit", required=True)
    package_parser.add_argument("--reproduce-command", required=True)
    package_parser.add_argument("--inspection-report", type=Path, required=True)
    send_parser = subparsers.add_parser("send-review", help="send one idempotent owner review bundle")
    send_parser.add_argument("bundle", type=Path)
    send_parser.add_argument("--runtime-root", type=Path, default=Path("runtime"))
    send_parser.add_argument("--config", type=Path, default=Path("/home/busbar/.config/signalbrief/email.json"))
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "render":
            runtime_root = (Path.cwd() / "runtime").resolve()
            cleanup_runtime(runtime_root)
            try:
                manifest = render(args.spec.resolve(), args.run_dir.resolve(), repo_root=Path.cwd())
                register_owned(runtime_root, args.run_dir.resolve(), "render_full", run_id=args.run_dir.name)
            except BaseException:
                if args.run_dir.resolve().exists():
                    register_owned(runtime_root, args.run_dir.resolve(), "failed_render", run_id=args.run_dir.name)
                raise
            finally:
                cleanup_runtime(runtime_root)
            print(json.dumps({"run_dir": str(args.run_dir), "output_hashes": manifest["output_hashes"]}, indent=2))
            return 0
        if args.command == "cleanup":
            report = cleanup_runtime(args.runtime_root.resolve(), dry_run=args.dry_run)
            print(json.dumps(report, indent=2, sort_keys=True))
            return 3 if report["pending_queue_blocked"] else 0
        if args.command == "package-review":
            inspection = json.loads(args.inspection_report.read_text(encoding="utf-8"))
            package = package_review(
                (Path.cwd() / "runtime").resolve(), args.run_id,
                [path.resolve() for path in args.run_dirs],
                commit=args.commit, reproduce_command=args.reproduce_command, inspection=inspection,
            )
            print(json.dumps(package, indent=2, sort_keys=True))
            return 0
        if args.command == "send-review":
            result = send_review(args.runtime_root, args.bundle, args.config)
            print(json.dumps(result, indent=2, sort_keys=True))
            return 0
    except (SpecError, RuntimeError, RuntimeSafetyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
