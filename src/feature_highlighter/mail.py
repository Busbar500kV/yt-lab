from __future__ import annotations

import json
import mimetypes
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import make_msgid
from pathlib import Path
from typing import Any, Protocol

from .core import sha256_file
from .runtime import (
    cleanup_runtime,
    register_owned,
    set_source_pending,
    unregister_owned,
    update_owned,
)


MIB = 1024 * 1024
DEFAULT_MESSAGE_LIMIT = 10 * MIB


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _atomic_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.parent.chmod(0o700)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)
    path.chmod(0o600)


def resolve_owner_recipient(owner_config_path: Path) -> str:
    policy = json.loads(owner_config_path.read_text(encoding="utf-8"))
    owner = policy.get("owner_email")
    if not owner and isinstance(policy.get("soundtrack_intake"), dict):
        owner = policy["soundtrack_intake"].get("owner_mailbox")
    if not isinstance(owner, str) or "@" not in owner or not owner.strip():
        raise RuntimeError("explicit owner mailbox is missing from owner configuration")
    return owner.strip()


def _private_file(path: Path, label: str) -> None:
    if not path.is_file() or path.stat().st_mode & 0o077:
        raise RuntimeError(f"{label} is missing or has unsafe permissions")


class MailTransport(Protocol):
    def send(self, message: EmailMessage, config: dict[str, Any]) -> dict[str, Any]: ...


class SMTPTransport:
    def send(self, message: EmailMessage, config: dict[str, Any]) -> dict[str, Any]:
        password_path = Path(config["password_path"])
        _private_file(password_path, "SMTP password file")
        password = password_path.read_text(encoding="utf-8").strip()
        with smtplib.SMTP(config["smtp_server"], int(config["smtp_port"]), timeout=60) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(config["username"], password)
            refused = smtp.send_message(message)
        if refused:
            raise RuntimeError(f"SMTP refused recipients: {sorted(refused)}")
        return {"accepted": True, "response": "SMTP transaction accepted; inbox delivery not confirmed"}


def build_message(bundle: Path, config: dict[str, Any]) -> tuple[EmailMessage, dict[str, Any]]:
    package = json.loads((bundle / "package.json").read_text(encoding="utf-8"))
    message = EmailMessage()
    message["From"] = config["from_addr"]
    message["To"] = config["to_addr"]
    message["Subject"] = f"[yt-lab] feature-highlighter {package['run_id']} {package['commit'][:12]}"
    domain = str(config["from_addr"]).rsplit("@", 1)[-1]
    message["Message-ID"] = make_msgid(idstring=f"yt-lab-{package['run_id']}", domain=domain)
    message.set_content((bundle / "body.txt").read_text(encoding="utf-8"))
    for attachment in package["attachments"]:
        path = bundle / attachment["filename"]
        if sha256_file(path) != attachment["sha256"]:
            raise RuntimeError(f"attachment hash changed: {path.name}")
        guessed, _ = mimetypes.guess_type(path.name)
        maintype, subtype = (guessed or "application/octet-stream").split("/", 1)
        message.add_attachment(path.read_bytes(), maintype=maintype, subtype=subtype, filename=path.name)
    encoded_bytes = len(message.as_bytes())
    sender_limit = config.get("max_message_bytes")
    limit = min(DEFAULT_MESSAGE_LIMIT, int(sender_limit)) if sender_limit else DEFAULT_MESSAGE_LIMIT
    if encoded_bytes > limit:
        raise RuntimeError(f"encoded message is {encoded_bytes} bytes, above the {limit}-byte limit")
    return message, {"encoded_bytes": encoded_bytes, "limit_bytes": limit, "package": package}


def send_review(
    runtime_root: Path,
    bundle: Path,
    config_path: Path,
    *,
    owner_config_path: Path | None = None,
    transport: MailTransport | None = None,
) -> dict[str, Any]:
    runtime_root = runtime_root.resolve()
    bundle = bundle.resolve()
    hinted_record = runtime_root / "mail" / "records" / f"{bundle.name}.json"
    if hinted_record.exists():
        existing = json.loads(hinted_record.read_text(encoding="utf-8"))
        if existing.get("status") == "accepted" and not bundle.exists():
            return {**existing, "duplicate_skipped": True}
        if existing.get("status") in {"sending", "ambiguous"}:
            raise RuntimeError("previous send outcome is ambiguous; resolve it explicitly before retrying")
    if transport is None:
        _private_file(config_path, "SMTP configuration")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    if owner_config_path is not None:
        config = {**config, "to_addr": resolve_owner_recipient(owner_config_path)}
    message, details = build_message(bundle, config)
    package = details["package"]
    run_id = package["run_id"]
    attachment_hashes = {item["filename"]: item["sha256"] for item in package["attachments"]}
    record_path = runtime_root / "mail" / "records" / f"{run_id}.json"
    if record_path.exists():
        existing = json.loads(record_path.read_text(encoding="utf-8"))
        if existing.get("status") == "accepted":
            if existing.get("attachment_hashes") != attachment_hashes:
                raise RuntimeError("run ID was accepted previously with different attachment hashes")
            return {**existing, "duplicate_skipped": True}
        if existing.get("status") in {"sending", "ambiguous"}:
            raise RuntimeError("previous send outcome is ambiguous; resolve it explicitly before retrying")
    record = {
        "schema_version": 1,
        "run_id": run_id,
        "recipient": config["to_addr"],
        "attachment_hashes": attachment_hashes,
        "message_id": message["Message-ID"],
        "encoded_bytes": details["encoded_bytes"],
        "status": "sending",
        "attempted_at": _now(),
    }
    _atomic_json(record_path, record)
    selected_transport = transport or SMTPTransport()
    try:
        result = selected_transport.send(message, config)
    except BaseException as exc:
        record.update({"status": "ambiguous", "error_type": type(exc).__name__, "error": str(exc)[:500]})
        _atomic_json(record_path, record)
        raise RuntimeError("mail outcome is ambiguous; the lab will not retry automatically") from exc
    record.update({"status": "accepted", "accepted_at": _now(), "transport_result": result})
    _atomic_json(record_path, record)
    sent = runtime_root / "mail" / "sent" / run_id
    sent.parent.mkdir(parents=True, exist_ok=True)
    sent.parent.chmod(0o700)
    bundle.rename(sent)
    unregister_owned(runtime_root, bundle)
    register_owned(
        runtime_root,
        sent,
        "sent_bundle",
        run_id=run_id,
        metadata={"accepted_at": record["accepted_at"]},
    )
    for raw_path in package.get("sample_run_dirs", []):
        path = Path(raw_path)
        try:
            update_owned(runtime_root, path, category="superseded_render", status="disposable_after_acceptance")
        except (ValueError, RuntimeError):
            pass
    set_source_pending(runtime_root, False)
    cleanup = cleanup_runtime(runtime_root)
    return {**record, "duplicate_skipped": False, "sent_bundle": str(sent), "cleanup": cleanup}
