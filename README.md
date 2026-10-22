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
