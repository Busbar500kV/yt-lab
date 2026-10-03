# God's Eye View and provider audit

Audited 2026-10-03 for `geographic-scene-renderer` 0.2.3.

## Upstream pin and selected surface

- Repository: <https://github.com/bilawalsidhu/gods-eye-view>
- Tested commit: `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee`
- Upstream package version: 0.2.1
- Code licence: MIT, with an explicit third-party data/asset carve-out
- Used: locked CesiumJS/Puppeteer dependencies, keyless terrain-provider pattern,
  and WGS84 camera semantics
- Excluded: dashboard/UI, voice/AI, live tracking and surveillance feeds, Google
  services, event material, bundled datasets/models, and upstream default imagery

The adapter imports only `cesium` and `puppeteer` from the locked upstream
installation under ignored runtime storage. Its package adds no dependencies.
`npm audit --omit=dev` on the pinned lockfile reported one low-severity indirect
DOMPurify advisory (GHSA-p98j-92pf-mc4p), with no moderate/high/critical finding.
The adapter does not invoke DOMPurify or render user HTML; Bootstrap must reassess
this before production adoption.

The upstream MCP surface controls the interactive application but is not a
continuous video exporter. This adapter supplies a minimal local Cesium viewer,
fixed time-based keyframes, keyframe readiness checks, an unrecorded deterministic
rehearsal, continuous compressed MediaStream capture, and FFmpeg transcode. It
does not assemble screenshots or retain an uncompressed frame sequence.

## Provider decision

The MIT licence covers code, not imagery or datasets. The adapter does not expose
the upstream TeleGeography or Bhote Koshi/GeoPera non-commercial data.

Admitted 0.2.3 sources are:

- **NASA EOSDIS GIBS — Blue Marble Next Generation.** The WMTS layer is a
  worldwide 2004 monthly composite, used as fixed modern geographic context.
  NASA Earthdata states NASA-led data are open (CC0 unless a dataset says
  otherwise), asks for acknowledgement, and prohibits endorsement implications.
  GIBS documents no fees or access constraints for the service. The output burns
  in `NASA EOSDIS GIBS / Blue Marble imagery`. The provider is keyless and the
  tested API cost is $0. Its level-8 detail is unsuitable for building/city
  close-ups, so specifications closer than 120 km are rejected. Imagery is held
  only in browser memory in the final configuration.
  - Policy: <https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy>
  - Access: <https://nasa-gibs.github.io/gibs-api-docs/access-basics/>
  - Dataset: <https://earthobservatory.nasa.gov/features/BlueMarble/BlueMarble.php>
- **USGS National Map — USGSImageryOnly.** USGS states National Map data and
  services are free/public domain and requests acknowledgement. The allow-list
  bounds it to the contiguous United States and excludes separately licensed
  Alaska imagery. Component acquisition dates vary; service metadata says June
  2024 refresh. Output attribution is `USGS The National Map imagery`. The
  service is keyless and tested cost is $0.
  - Terms: <https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map>
- **Re:Earth Terrain.** Mapterhorn terrain is CC BY 4.0 and EGM2008 is public
  domain. The adapter disables the optional OSM watermask and displays
  `Re:Earth / Mapterhorn terrain (CC BY 4.0)`.
  - Record: <https://github.com/reearth/reearth-terrain>

Esri World Imagery remains excluded: keyless/public access and an upstream
default do not establish export permission for commercial YouTube footage. A
Landsat WELD layer was explored but excluded from the release catalogue after
visual review exposed regional patch/no-data seams. No paid service or billing
was enabled.

## Accuracy and repeatability

Location verification is a separate editorial step. The renderer accepts only
fixed coordinates, extents, full identity, supporting references, verification
method/date, and resolved ambiguity. It does not query a geocoder or invent a
route. The same spec and tool version reproduce the keyframes, easing, timing,
composition, and label placement, but live provider availability and terrain can
change, so byte-identical output is not promised.

Modern imagery must not be described as historical conditions or an event in
progress. Recheck the upstream pin/licence, npm lock, provider terms, endpoints,
coverage, attribution, and data dates before production adoption or any provider
change.
