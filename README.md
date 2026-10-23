# Educational Web-based AR

A browser-based augmented-reality learning prototype built with **MindAR Image Tracking** and **Three.js**. It places lightweight educational 3D models over printed image markers, without requiring a native mobile app.

> Originally developed as a school Independent Study project. This repository is being refined into a clearer, more usable demonstration of browser-based AR and interactive 3D.

## What it does

- Tracks a set of compiled image targets using the device camera.
- Loads bundled GLB assets and attaches them to corresponding MindAR anchors.
- Renders the models through Three.js in the browser.
- Provides a simple start/stop flow and a message when a marker is not currently detected.
- Runs as a static website, suitable for GitHub Pages.

## Technology

- **MindAR Image Tracking** — marker recognition and anchor tracking
- **Three.js** — 3D scene, lighting, rendering, and GLTF loading
- **GLB / glTF** — bundled 3D assets
- **HTML, CSS, JavaScript modules** — interface and application logic
- **GitHub Pages** — static hosting

## Run it

1. Open the deployed site on a supported mobile browser, or serve the repository from a local HTTP server.
2. Allow camera access when prompted.
3. Point the camera at one of the supported printed markers.
4. Keep the marker visible and reasonably well lit while viewing the model.

Camera access generally requires HTTPS (or localhost during local development). This is a static site; there is no application server or database.

## Repository layout

```text
index.html          Landing screen, AR controls, and interface styling
lib/main.js         MindAR setup, model loading, anchors, and render loop
markers/            Source marker images and compiled markers.mind target data
models/             Bundled GLB models used by the AR experience
staffs/             Original project team images
.github/workflows/  GitHub Pages deployment workflow
```

## Design principles for the current iteration

The goal is a **small, stable, modestly interactive AR experience**, inspired by the focused interactions of Nintendo 3DS AR Games—not a full 3D editor or a service-dependent content platform.

- Prefer stable tracking and conservative model motion over flashy effects.
- Keep interactions understandable and reversible.
- Keep the core experience usable without third-party API keys or a backend.
- Treat the non-AR model exploration experience and the AR camera session as separate modes.
- Fail visibly and gracefully when camera permission, model loading, or marker tracking fails.

## Current limitations

- The tracked targets are the images compiled into `markers/markers.mind`; this is not general-purpose recognition of arbitrary textbook pages.
- The current AR scene uses predefined model-to-anchor assignments and hardcoded scales in `lib/main.js`.
- Camera-based tracking quality depends on lighting, camera focus, marker visibility, and device performance.
- The original prototype has not been validated across a comprehensive device/browser matrix.
- The repository does not currently provide an automated Sketchfab download integration. The core experience is designed to work with bundled assets.

## Architecture at a glance

```text
Camera
  ↓
MindAR image tracking
  ↓
Tracked image anchor
  ↓
Three.js scene + GLB model
  ↓
Browser renderer
```

MindAR owns the tracked anchor transforms. Model animation should be applied to the model beneath its anchor rather than overriding the anchor's transform; this keeps tracking and presentation concerns separate.

## Development direction

This repository is being improved incrementally from its existing working prototype. The priorities are:

1. Make the landing and model-selection experience feel intentional.
2. Add small educational interactions without destabilizing tracking.
3. Make loading, tracking loss, and camera errors understandable to users.
4. Document technical decisions and known limitations honestly.

The scope is deliberately modest: a polished, understandable demonstration is more valuable than an unfinished feature catalogue.

## Credits

Built with MindAR and Three.js. The project originated as an Independent Study (I30201) submission for the 2025 academic year.
