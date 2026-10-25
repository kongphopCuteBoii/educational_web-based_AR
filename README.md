# Educational Web-based AR

A browser-based augmented reality project that brings educational 3D models into the real world through image tracking. Built as a lightweight web experience, it explores how familiar printed markers can become an interactive way to learn.

## Goals

- Making 3D learning experiences accessible without a native app.
- Connecting image tracking with interactive, real-time 3D rendering.
- Keeping the experience simple enough to explore on a mobile browser.

## Development

The project uses MindAR to track known image targets and Three.js to render GLB models. A separate viewer lets users examine the available models outside the camera session.

- **Platform:** Web browsers with camera support
- **Graphics:** Three.js
- **AR tracking:** MindAR Image Tracking
- **Project status:** Work in progress

The experience currently uses predefined image targets and bundled models. Camera access requires HTTPS or localhost, and tracking quality depends on lighting, focus, and device performance.

---

*Originally developed as a school Independent Study project.*
