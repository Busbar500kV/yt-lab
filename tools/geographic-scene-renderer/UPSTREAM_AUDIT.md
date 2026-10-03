# God's Eye View upstream audit

Audited 2026-10-03 for `geographic-scene-renderer` 0.1.0.

## Pin and selected surface

- Repository: <https://github.com/bilawalsidhu/gods-eye-view>
- Tested commit: `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee`
- Upstream package version: 0.2.1
- Code licence: MIT, with the upstream licence's explicit third-party data and
  asset carve-out
- Used here: locked CesiumJS/Puppeteer dependencies, keyless terrain-provider
  pattern, WGS84 camera semantics
- Deliberately unused: upstream UI/dashboard, voice and AI features, live
  aircraft/ship/satellite/CCTV feeds, Google services, event material, bundled
  datasets, 3D models, and upstream default imagery

The upstream package has a wide dependency set because it is an intelligence
dashboard. This adapter imports only its installed `cesium` and `puppeteer`
packages into a small local viewer. `npm ci` is retained outside Git under the
ignored runtime checkout. The adapter itself declares no npm dependencies.

`npm audit --omit=dev` on the pinned lockfile reported one low-severity indirect
DOMPurify advisory (GHSA-p98j-92pf-mc4p), with a fix available. This adapter does
not invoke DOMPurify or render user-authored HTML, but Bootstrap must reassess and
either update the bounded dependency safely or record the residual finding before
production adoption. No moderate, high, or critical advisory was reported.

## Controls and unattended export

The upstream scene/director code exposes camera and project controls, and the MCP
server exposes interactive application tools. The audited MCP surface is not a
continuous video exporter. Its presence therefore was not treated as export
support.

The adapter supplies the missing unattended path: it serves a minimal Cesium
page, waits for stable terrain/imagery at sampled camera positions, animates an
explicit timeline, copies WebGL frames to a browser-owned 2D recording canvas,
records a continuous compressed MediaStream, and transcodes it with FFmpeg. It
never assembles screenshots or writes an uncompressed image sequence. Bounded
retries fail the render if scene data does not become ready.

## Data and commercial-use decision

The MIT grant covers upstream code, not imagery, map data, or bundled assets.
The upstream licence identifies, among other exclusions, TeleGeography CC
BY-NC-SA material and Bhote Koshi Vantor/GeoPera CC BY-NC material. None is
served, copied, or referenced by this adapter.

Version 0.1.0 admits only:

- **USGS National Map — USGSImageryOnly.** USGS states National Map data and map
  services are free and public domain and asks for acknowledgement. The output
  includes `Imagery: USDA, USGS The National Map`. Service metadata says the
  service was refreshed June 2024, while component acquisition dates vary.
  Terms: <https://www.usgs.gov/faqs/what-are-terms-uselicensing-map-services-and-data-national-map>
- **Re:Earth Terrain.** Re:Earth documents Mapterhorn terrain under CC BY 4.0,
  EGM2008 as public domain, and an optional OSM watermask. The adapter disables
  the watermask and displays the Mapterhorn/EGM attribution.
  Source/licence record: <https://github.com/reearth/reearth-terrain>

Examples are limited to the contiguous United States. They do not use the
National Map's separately licensed Alaska imagery noted by USGS. Esri World
Imagery was rejected from the allow-list: public/keyless access and an upstream
default do not establish permission to export it into a commercial YouTube
video. No paid access was enabled and expected provider cost for this version is
$0, subject to provider availability and reasonable-use limits.

Modern imagery is labelled as modern geographic context and must not be described
as an image of a historical event. Every marker, route, or boundary needs a
scene-specific verification URL and `verified: true`; the tool does not infer a
route between points.

## Re-audit triggers

Recheck the upstream commit and licence, npm lockfile, provider terms, endpoint
availability, attribution, and data dates before changing the pin, adding a
provider, or integrating into production. A future provider is not admitted by
being technically reachable.
