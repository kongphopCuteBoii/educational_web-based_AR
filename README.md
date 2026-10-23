# Educational Web-based AR

A browser-based educational augmented-reality demo built with MindAR Image Tracking and Three.js. It runs as a static site, so it can be hosted on GitHub Pages without a backend or paid hosting.

## Model-outsourcing architecture

The renderer no longer needs to know where a model comes from. Lesson content lives in `content/manifest.json`; `lib/model-provider.js` handles bundled-model matching and public Sketchfab discovery. Search results are metadata and preview links, not direct GLB URLs.

`image target → lesson manifest → bundled GLB fallback`  
`keyword → public Sketchfab search → preview-only result or user-authorized GLB download/import → Three.js normalization and rendering`

- **Provider:** Sketchfab's public search endpoint, with no API key needed for discovery.
- **No secrets in the browser:** the site performs anonymous search only; it does not embed an access token or client secret.
- **Honest availability states:** bundled/direct GLB candidates are labelled separately from remote preview-only candidates.
- **User-assisted acquisition:** Sketchfab results can open the model page; if the account and creator permit downloading, import the downloaded `.glb` in the catalogue. The app does not scrape viewer internals or claim automatic downloads.
- **Fallback:** the five bundled educational models remain available if remote search fails.

Search is for discovery, not a guarantee of educational accuracy or download rights. Review each model's license and attribution before use.

## How content is configured

Each entry in `content/manifest.json` defines:

- `id`, `title`, `subject`, `description`, `facts`: educational content
- `targetIndex`: image target index in `markers/markers.mind`
- `modelUrl`: bundled GLB fallback
- `provider`, `providerQuery`, `providerMatchTerms`: optional external model lookup configuration
- `displaySize`, `scale`, `rotationSpeed`: uniform fit size and animation

The current project includes five precompiled image targets. Bundled models are local fallbacks. Remote Sketchfab results are discovered at runtime and are not copied into the repository.

## Limitations and next steps

- Image tracking uses the existing compiled targets in `markers/markers.mind`; this is not arbitrary textbook-page recognition.
- A general-purpose model catalogue may not contain accurate educational molecules or atoms, so the local fallback remains necessary for those lessons.
- Tracking quality depends on target image quality, lighting, camera permissions, and device/browser.
- A public model URL can fail because of CORS, format, or provider availability. The adapter fails safely to the bundled model.

## Running locally

Serve the project over HTTP (for example, with VS Code Live Server or Python's local HTTP server) and open it in a browser. Camera access generally requires HTTPS or localhost. GitHub Pages provides HTTPS when deployed.

## Mobile presentation and model normalization

The renderer uses MindAR's documented starting values for tracking smoothing. Each target can define educational text that appears in a compact mobile overlay.

Imported GLB scenes are measured with a Three.js bounding box, uniformly fitted to each manifest target's `displaySize`, and centered under a pivot group. Uniform fitting preserves proportions; it does not alter source geometry.

