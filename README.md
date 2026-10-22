# Educational Web-based AR

A browser-based educational augmented-reality demo built with MindAR Image Tracking and Three.js. It runs as a static site, so it can be hosted on GitHub Pages without a backend or paid hosting.

## How content is configured

The target-to-model mapping lives in `content/manifest.json`. Each entry defines:

- `id` and `title`: content identifiers and loading label
- `targetIndex`: the image target index in `markers/markers.mind`
- `modelUrl`: a local GLB path or a direct public GLB URL
- `scale`: uniform model scale
- `rotationSpeed`: per-frame Y rotation speed; use `"rotate": false` to disable rotation

To add or change a model, edit the manifest and make sure the target index corresponds to the target compiled into `markers/markers.mind`. The current project includes five precompiled image targets.

## Using externally hosted models

A model URL must point directly to a browser-loadable GLB file. The host must allow cross-origin requests (CORS), and you should verify the model's license and attribution requirements before using it. External hosts may change URLs, impose rate limits, or remove files, so local assets are more reliable for a portfolio demo.

This is a static frontend: **never put private API keys or secrets in client-side files**. The manifest supports direct model URLs; it does not currently search a model catalog or call a model-provider API automatically.

## Current limitations

- Image tracking uses the existing compiled targets in `markers/markers.mind`; this is not arbitrary textbook-page recognition.
- Tracking quality depends on target image quality, lighting, camera permissions, and the device/browser.
- A public model URL can fail because of CORS, file availability, format, or licensing restrictions.

## Running locally

Serve the project over HTTP (for example, with VS Code Live Server or Python's local HTTP server) and open it in a browser. Camera access generally requires HTTPS or localhost. GitHub Pages provides HTTPS when deployed.


## Mobile presentation and learning content

The AR renderer uses MindAR's image tracking filter with `filterMinCF: 0.001` and `filterBeta: 1000`, its documented default starting values. Filter tuning balances image jitter against lag; fast camera movement and low-detail markers can still affect stability.

Each manifest target can define `subject`, `description`, and a `facts` array. These appear in a compact mobile overlay when the corresponding image target is recognized. Model scale remains uniform; apparent on-screen size naturally changes with the tracked marker's distance and perspective.


## Model normalization

Imported GLB scenes are measured with a Three.js bounding box, uniformly fitted to each manifest target's `displaySize`, and centered under a pivot group. This prevents wildly different source-model dimensions and off-center origins from dominating the marker view. Uniform fitting preserves proportions; it does not alter the source geometry. Per-target display size is tuned in `content/manifest.json`.
