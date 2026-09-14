# Animated feature highlighter demonstration

Run ID: `fh-20260913-669ef5e`

Rendered tool commit: `669ef5ec244f`

Review-delivery/manifest-retention code: `bd066a925221`

## Status

- Technically tested: yes; 19 focused tests passed on 2026-09-13 UTC.
- Visually inspected: yes; native sources, exact 1080p hold frames, 16 samples
  per animation at 0.5-second intervals, 1:1 edge detail, and exact 720p email
  frames were inspected. Both clips also decoded end-to-end at real-time pacing.
- Emailed for owner review: SMTP accepted one 835,931-byte MIME message. This is
  transport acceptance only, not confirmed inbox delivery or owner review.
- Owner reviewed: yes; confirmed by the owner on 2026-09-14. This records review,
  not approval of any episode or release.
- Production integrated: yes; production commit
  `74383dbb474581052868e9767b889e32cffd980d` on 2026-09-14 selected lab commit
  `f4103b7237692f008dca5b092049bd10e76f913f` and renderer revision
  `669ef5ec244fdca628ca2708c4f44707e7cdc458`.

The headless host did not provide direct full-speed visual playback. Sampled-frame
inspection and real-time decoder pacing are recorded as separate evidence. The
closed-path corner marker found in an earlier exact-commit render was corrected,
retested, and visually rechecked before this batch.

After acceptance, the two compact master manifests were recovered by a deterministic
rerender. The renderer-core Git blob matched reviewed commit `669ef5ec244f`, and
both new 720p transcodes matched the accepted attachment hashes exactly. The
recovery record and manifests remain in ignored `runtime/reports/reproduction/`.

## Review attachments

- `01-earth-over-lunar-horizon-720x1280.mp4` — 8.000 seconds, H.264/yuv420p;
  SHA-256 `d8158d949d1bf9f49b2b4ce4a1b52a21ef9deb20882f1687a1a9a9603aa325c0`.
- `02-steam-engine-linkage-1280x720.mp4` — 8.000 seconds, H.264/yuv420p;
  SHA-256 `d6f58fe48e5dd8e5fa365d64a5876dc070cbb92df53d0408b8d66fea9710b014`.
- `03-feature-highlighter-contact-sheet.jpg` — overview frames and a 1:1 1080p
  detail; SHA-256
  `fc25087765480806ad7bdcbfde180de1629bf040961b2811c48dd9caf8533ca5`.

Recovered master MP4 hashes are
`8623577a62e36d21e34b235167d4806976769753e9537bf338ce083659fe9211`
(portrait) and
`0b4fb74bb0d31134f13f529210309788c5f2c268fd586940e84b263c02c01e20`
(landscape).

The source photograph is NASA AS11-44-6642 (public domain in the United States),
and the technical figure is Pearson Scott Foresman's public-domain steam-engine
diagram. Retrieval recipes, reuse evidence, attribution, and expected hashes are
tracked under `examples/sources/`; acquired files remain outside Git.

## Retention and reproduction

Cleanup receipts record 19,610,934 bytes reclaimed across development, recovery,
and final
review runs. The full-resolution demonstration renders and inspection scratch data
are gone. Runtime retains the latest sent bundle (619,510 bytes), both verified
sources (952,997 bytes total), compact reproduction manifests/reports, and the
private mode-0600 acceptance record. The sent bundle is eligible for deletion after seven days on the next lab
invocation; no unattended expiry is claimed.

Regenerate both intended-resolution demonstrations from the recorded sources:

```bash
.venv/bin/python scripts/render_demo.py --run-id reproduced-669ef5e
```

Version one remains limited to operator-supplied static rectangles/polygons. It
does not segment objects or track features through moving video.
