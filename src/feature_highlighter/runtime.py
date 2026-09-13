from __future__ import annotations

import json
import os
import shutil
import stat
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


MIB = 1024 * 1024
DEFAULT_SENT_CAP = 25 * MIB
DEFAULT_PENDING_CAP = 50 * MIB
DEFAULT_SOURCE_CAP = 100 * MIB
DEFAULT_SENT_DAYS = 7


class RuntimeSafetyError(RuntimeError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None = None) -> str:
    return (value or utc_now()).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _contained_path(runtime_root: Path, relative: str) -> Path:
    root = runtime_root.resolve()
    candidate = runtime_root / relative
    if candidate.is_absolute() and not str(candidate).startswith(str(root) + os.sep):
        raise RuntimeSafetyError(f"absolute path is outside runtime root: {candidate}")
    resolved = candidate.resolve(strict=False)
    if resolved != root and root not in resolved.parents:
        raise RuntimeSafetyError(f"path escapes runtime root: {candidate}")
    current = candidate
    while current != runtime_root.parent and current != root.parent:
        if current.is_symlink():
            raise RuntimeSafetyError(f"refusing symlinked runtime path: {current}")
        if current == runtime_root or current == root:
            break
        current = current.parent
    return resolved


def path_size(path: Path) -> int:
    if not path.exists():
        return 0
    if path.is_symlink():
        raise RuntimeSafetyError(f"refusing to size symlink: {path}")
    if path.is_file():
        return path.stat().st_size
    total = 0
    for base, directories, files in os.walk(path, followlinks=False):
        base_path = Path(base)
        directories[:] = [name for name in directories if not (base_path / name).is_symlink()]
        for name in files:
            item = base_path / name
            if item.is_symlink():
                continue
            total += item.stat().st_size
    return total


def _load_registry(runtime_root: Path) -> dict[str, Any]:
    path = runtime_root / "ownership.json"
    if not path.exists():
        return {"schema_version": 1, "items": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 1 or not isinstance(data.get("items"), list):
        raise RuntimeSafetyError("unsupported runtime ownership registry")
    return data


def _save_registry(runtime_root: Path, registry: dict[str, Any]) -> None:
    runtime_root.mkdir(parents=True, exist_ok=True)
    path = runtime_root / "ownership.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(registry, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def register_owned(
    runtime_root: Path,
    path: Path,
    category: str,
    *,
    run_id: str | None = None,
    status: str = "retained",
    created_at: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    root = runtime_root.resolve()
    resolved = path.resolve(strict=False)
    if resolved != root and root not in resolved.parents:
        raise RuntimeSafetyError(f"cannot register path outside runtime root: {path}")
    relative = resolved.relative_to(root).as_posix()
    _contained_path(root, relative)
    registry = _load_registry(root)
    item = {
        "path": relative,
        "category": category,
        "run_id": run_id,
        "status": status,
        "created_at": created_at or _iso(),
        "metadata": metadata or {},
    }
    registry["items"] = [existing for existing in registry["items"] if existing.get("path") != relative]
    registry["items"].append(item)
    _save_registry(root, registry)


def update_owned(runtime_root: Path, path: Path, **changes: Any) -> None:
    root = runtime_root.resolve()
    relative = path.resolve(strict=False).relative_to(root).as_posix()
    registry = _load_registry(root)
    found = False
    for item in registry["items"]:
        if item.get("path") == relative:
            item.update(changes)
            found = True
            break
    if not found:
        raise RuntimeSafetyError(f"path is not registered as lab-owned: {path}")
    _save_registry(root, registry)


def unregister_owned(runtime_root: Path, path: Path) -> None:
    root = runtime_root.resolve()
    relative = path.resolve(strict=False).relative_to(root).as_posix()
    registry = _load_registry(root)
    registry["items"] = [item for item in registry["items"] if item.get("path") != relative]
    _save_registry(root, registry)


def set_source_pending(runtime_root: Path, required: bool) -> None:
    root = runtime_root.resolve()
    registry = _load_registry(root)
    for item in registry["items"]:
        if item.get("category") == "source_cache":
            item.setdefault("metadata", {})["required_for_pending"] = required
    _save_registry(root, registry)


def _active(path: Path) -> bool:
    if path.is_dir() and (path / ".active.json").exists():
        return True
    return any(parent.name == "active" for parent in [path, *path.parents])


def _delete(path: Path) -> None:
    mode = path.lstat().st_mode
    if stat.S_ISLNK(mode):
        raise RuntimeSafetyError(f"refusing to delete symlink: {path}")
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()


@dataclass
class CleanupPolicy:
    sent_cap_bytes: int = DEFAULT_SENT_CAP
    pending_cap_bytes: int = DEFAULT_PENDING_CAP
    source_cap_bytes: int = DEFAULT_SOURCE_CAP
    sent_retention_days: int = DEFAULT_SENT_DAYS


def cleanup_runtime(
    runtime_root: Path,
    *,
    dry_run: bool = False,
    now: datetime | None = None,
    policy: CleanupPolicy | None = None,
    write_report: bool = True,
) -> dict[str, Any]:
    policy = policy or CleanupPolicy()
    now = now or utc_now()
    root = runtime_root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    before_free = shutil.disk_usage(root).free
    registry = _load_registry(root)
    present: list[tuple[dict[str, Any], Path, int]] = []
    skipped: list[dict[str, str]] = []
    for item in registry["items"]:
        try:
            path = _contained_path(root, str(item.get("path", "")))
            size = path_size(path)
            if path.exists():
                present.append((item, path, size))
        except RuntimeSafetyError as exc:
            skipped.append({"path": str(item.get("path")), "reason": str(exc)})

    pending_bytes = sum(size for item, _, size in present if item.get("category") == "pending_bundle")
    source_bytes = sum(size for item, _, size in present if item.get("category") == "source_cache")
    delete_reasons: dict[str, str] = {}

    for item, path, _ in present:
        if _active(path):
            skipped.append({"path": item["path"], "reason": "active run"})
            continue
        category = item.get("category")
        if category in {"scratch", "failed_render", "superseded_render"}:
            delete_reasons[item["path"]] = "disposable"

    sent = sorted(
        [(item, path, size) for item, path, size in present if item.get("category") == "sent_bundle"],
        key=lambda entry: entry[0].get("metadata", {}).get("accepted_at", entry[0].get("created_at", "")),
        reverse=True,
    )
    for index, (item, _, size) in enumerate(sent):
        accepted = _parse_time(item.get("metadata", {}).get("accepted_at", item["created_at"]))
        expired = now - accepted >= timedelta(days=policy.sent_retention_days)
        if index > 0:
            delete_reasons[item["path"]] = "older sent bundle"
        elif expired:
            delete_reasons[item["path"]] = "sent retention expired"
        elif size > policy.sent_cap_bytes:
            delete_reasons[item["path"]] = "sent bundle exceeds cap"

    if source_bytes > policy.source_cap_bytes:
        candidates = sorted(
            [
                entry
                for entry in present
                if entry[0].get("category") == "source_cache"
                and entry[0].get("metadata", {}).get("retrieval_url")
                and entry[0].get("metadata", {}).get("expected_sha256")
                and not entry[0].get("metadata", {}).get("required_for_pending", False)
            ],
            key=lambda entry: entry[0].get("created_at", ""),
        )
        remaining = source_bytes
        for item, _, size in candidates:
            if remaining <= policy.source_cap_bytes:
                break
            delete_reasons[item["path"]] = "source cache cap eviction"
            remaining -= size

    deleted: list[dict[str, Any]] = []
    retained: list[dict[str, Any]] = []
    surviving_items: list[dict[str, Any]] = []
    reclaimed = 0
    for item, path, size in present:
        reason = delete_reasons.get(item["path"])
        if reason and not _active(path):
            deleted.append({"path": item["path"], "bytes": size, "reason": reason})
            reclaimed += size
            if dry_run:
                surviving_items.append(item)
            else:
                _delete(path)
            continue
        retained.append({"path": item["path"], "bytes": size, "category": item.get("category")})
        surviving_items.append(item)
    missing_items = [item for item in registry["items"] if not (root / str(item.get("path", ""))).exists()]
    if not dry_run:
        registry["items"] = surviving_items + [
            {**item, "status": "evicted"}
            for item in missing_items
            if item.get("category") == "source_cache"
            and item.get("metadata", {}).get("retrieval_url")
            and item.get("metadata", {}).get("expected_sha256")
        ]
        _save_registry(root, registry)
    after_free = shutil.disk_usage(root).free
    report = {
        "schema_version": 1,
        "timestamp": _iso(now),
        "dry_run": dry_run,
        "disk_free_before": before_free,
        "disk_free_after": after_free,
        "bytes_reclaimed": 0 if dry_run else reclaimed,
        "bytes_reclaimable": reclaimed,
        "pending_bytes": pending_bytes,
        "pending_cap_bytes": policy.pending_cap_bytes,
        "pending_queue_blocked": pending_bytes > policy.pending_cap_bytes,
        "source_cache_bytes": source_bytes,
        "source_cap_bytes": policy.source_cap_bytes,
        "deleted": deleted,
        "retained": retained,
        "skipped": skipped,
    }
    if write_report and not dry_run:
        reports = root / "reports"
        reports.mkdir(exist_ok=True)
        stamp = now.strftime("%Y%m%dT%H%M%SZ")
        (reports / f"cleanup-{stamp}.json").write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
    return report
