# Model catalogue and asset-ingestion workflow

## Product contract

The catalogue is a contextual choice layer, not a destination users must open and search manually.

1. A recognition adapter emits `catalogue:recognition-result` with `{ keyword: "DNA" }`.
2. The catalogue automatically searches that keyword and opens a compact bottom-sheet result strip over the camera.
3. The user inspects candidate thumbnails, titles, source and license.
4. Only an asset with an app-loadable GLB can be selected into the AR pipeline.
5. Selecting a result closes the contextual sheet. MindAR marker tracking remains independent.

The existing manual Browse button remains a development/fallback entry point. MindAR is intentionally unchanged; no claim is made that it performs general object recognition.

## Discovery versus AR-ready assets

A searchable public model page is not the same as a downloadable asset. Sketchfab's public Data API can return search metadata, thumbnails, viewer links and license labels. Its Download API requires user authentication and a download request; a search result or embedded viewer URL is not a GLB URL. Do not attempt to scrape the viewer, guess private file URLs, or bypass platform access controls.

The UI currently supports:
- live keyword discovery through Sketchfab search,
- thumbnails and embedded interactive previews for remote results,
- bundled GLBs as immediately loadable AR assets.

Remote Sketchfab previews are **preview-only** until an authorized download integration or a separately curated, legally distributable GLB is available. Do not label them as AR-ready.

## Recommended gathering pipeline

### 1. Discover
Search for the recognition keyword plus useful educational synonyms (e.g. `DNA molecule`, `double helix`, `nucleic acid`). Search is a discovery step; don't automatically accept the first result.

### 2. Review
For each candidate, record:
- title and stable source URL / source ID,
- creator/author and attribution text,
- exact license label and license URL if available,
- whether redistribution and modification are permitted,
- relevance to the recognized concept,
- triangle/texture size and whether it is suitable for mobile,
- whether a direct, authorized GLB is available.

Reject assets with unclear licensing, misleading titles, age-restricted content, or impractical geometry.

### 3. Acquire legally
Prefer creator-provided GLB downloads or a platform-authorized download flow. For Sketchfab Download API assets, implement the documented user OAuth flow and request the authorized download endpoint. If the project cannot support OAuth, use models that creators explicitly permit to be downloaded and redistributed, and manually add those assets to the project after verifying the license. Never store user access tokens in source code.

### 4. Normalize and test
For every accepted asset:
- convert/verify as GLB without stripping required textures or animations,
- test in Three.js GLTFLoader,
- test on a real mobile browser,
- keep file size and triangle count appropriate for the device,
- verify orientation, scale, origin, material transparency and animation,
- test attribution and source links in the UI.

### 5. Add to the manifest
Store catalogue metadata in a data manifest rather than hardcoding each card in UI code. Suggested fields:

```json
{
  "id": "dna-double-helix",
  "title": "DNA double helix",
  "keywords": ["dna", "double helix", "genetics", "molecule"],
  "summary": "A molecular model of the DNA double helix.",
  "thumbnail": "assets/catalogue/dna-double-helix.webp",
  "modelUrl": "assets/models/dna-double-helix.glb",
  "sourceName": "Creator or collection",
  "sourceUrl": "https://example.org/model-page",
  "creator": "Creator name",
  "licenseName": "Exact license name",
  "licenseUrl": "https://example.org/license",
  "arReady": true
}
```

These values are an example schema, not a real model listing. Do not publish placeholder source URLs or invented license data.

### 6. Keep discovery contextual
Recognition output should be normalized into a concise keyword or a small list of related terms. Search results should be ranked by title/tags relevance first, then filtered by licensing and AR readiness. Display remote preview-only candidates as previews, but make the primary selection action available only for AR-ready assets.

## Known limitation / next implementation milestone

The current Sketchfab search can display remote candidates and their interactive viewer, but remote download is not connected to the AR pipeline. The next milestone is a manifest-driven asset catalogue and a legal, repeatable acquisition workflow—not scraping third-party viewer internals.