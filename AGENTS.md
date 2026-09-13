# yt-lab operating instructions

- Scope all code, caches, renders, mail state, and cleanup to this repository.
  Never modify production repositories or services.
- Work on `agent/codex-yt-lab`. Use `python -m unittest discover -s tests -v`
  for the focused test suite and `python -m feature_highlighter` for the CLI.
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
