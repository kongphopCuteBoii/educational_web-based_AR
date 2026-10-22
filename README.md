# Educational Web-based AR

A browser-based educational augmented-reality demo built with MindAR Image Tracking and Three.js. It runs as a static site, so it can be hosted on GitHub Pages without a backend or paid hosting.

## Model-outsourcing architecture

The renderer no longer needs to know where a model comes from. Each target in `content/manifest.json` describes the lesson and its provider query; `lib/model-provider.js` asks the public, keyless 3DAssets.dev catalogue for a matching GLB, validates the result URL, and hands it to the existing Three.js loader.

`image target → lesson manifest → provider adapter → semantic candidate filter → GLB URL → Three.js normalization and rendering`

- **Provider:** 3DAssets.dev public REST API. Searching and reading assets require no account, API key, paid plan, or backend.
- **No secrets in the browser:** only anonymous read requests are made.
- **Relevance guard:** the adapter only accepts a candidate when its metadata strongly matches the configured terms. It will not blindly display the first search result.
- **Fallback:** if the provider is unavailable or has no confident match, the existing local GLB is used, so the AR demo still works.
- **Provider swap:** model lookup is isolated in one module; another catalogue can be added without rewriting tracking/rendering.

The provider is an optional first integration, not a guarantee that a catalogue contains every scientific model. Molecular diagrams and specific atomic structures may not exist in a general-purpose prop library; those use the bundled educational asset unless a strong match is found.

## How content is configured

Each entry in `content/manifest.json` defines:

- `id`, `title`, `subject`, `description`, `facts`: educational content
- `targetIndex`: image target index in `markers/markers.mind`
- `modelUrl`: bundled GLB fallback
- `provider`, `providerQuery`, `providerMatchTerms`: optional external model lookup configuration
- `displaySize`, `scale`, `rotationSpeed`: uniform fit size and animation

The current project includes five precompiled image targets. The provider is queried at runtime; provider models are not copied into the repository.

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
