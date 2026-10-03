# yt-lab operating instructions

- Scope all code, caches, renders, mail state, and cleanup to this repository.
  Never modify production repositories or services.
- Work on `agent/codex-yt-lab`. Read `tool-registry.json`, Git history, tags, and
  the relevant tool-scoped handoff before starting a cycle.
- Treat registry entries with status `integrated` as immutable released lab
  capabilities. Do not rebuild, rename, reorganize, resubmit, or incidentally
  refactor them. Do not include them in a later Bootstrap handoff.
- Each new capability uses a new stable ID with implementation under
  `tools/<tool-id>/`, a skill at `skills/<tool-id>/SKILL.md`, tool-local tests and
  fixtures, ignored runtime output, its own version, handoff, catalogue entry,
  and lifecycle status.
- Add shared code only after two implemented tools need the same stable behavior.
  Extract it in a separate commit, document all consumers, and rerun every
  affected tool's regression tests.
- Runtime files live under ignored `runtime/`. Acquired media and private mail
  records never enter Git.
- Run `python -m feature_highlighter cleanup` before and after render/mail work.
  Defaults: 25 MiB latest-sent cap, 50 MiB pending cap, 100 MiB source cache,
  seven-day sent retention, and a 2 GiB free-space render reserve.
- Review email is authorized only for the configured owner. One initial package
  and one explicitly requested revision may be sent. Never blindly retry an
  ambiguous send or resend an accepted batch.
- Resume by reading `README.md`, checking `git status`, running cleanup dry-run,
  and examining ignored `runtime/reports/` and `runtime/mail/records/`.
- Commit code and compact non-private reports only. Do not commit rendered media,
  downloaded sources, credentials, caches, or private mail state.
- For `geographic-scene-renderer`, keep the pinned upstream checkout, Chromium,
  tile cache, and renders below `runtime/geographic-scene-renderer/`. Provider
  access is not reuse permission: follow its upstream audit and admit no new map
  source without a rights review. Maps are scene-specific, never mandatory, and
  landscape documentary and portrait short compositions are authored separately.
