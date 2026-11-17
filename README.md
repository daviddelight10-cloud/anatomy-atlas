# Anatomy Atlas

Interactive human anatomy atlas (500+ structures) with a 3D explorer built on
Z-Anatomy (CC BY-SA 4.0, based on BodyParts3D © DBCLS).

**Live site:** https://daviddelight10-cloud.github.io/anatomy-atlas/

## Features

- 📖 500+ anatomical structures with labeled plates (Gray's Anatomy 1918, Wikimedia Commons)
- 🧊 Interactive 3D body explorer — drag, zoom, tap structures (three.js + Draco)
- 🗺️ Body map, quizzes, searchable index, dark/light themes
- 📲 **Installable PWA** — add to home screen on Android, iOS, or desktop
- ⚡ Works offline: the app shell, visited pages, anatomy plates, and the 3D body are cached locally
- 💾 Optional "Save 3D body for offline" — the ~22 MB model downloads once, then never again

## How it works

| Piece | Detail |
|---|---|
| `index.html` | Self-contained app (~1.9 MB inline CSS/JS/data) |
| `model.bin` | Gzipped glTF of the Z-Anatomy body (22 MB), streamed with progress and gunzipped via `DecompressionStream` |
| `sw.js` | Service worker: precaches the shell, cache-first for plates/three.js/fonts/model with LRU trimming |
| `manifest.webmanifest` + `icons/` | Installability |

On a slow network the first visit downloads only the app shell — the 3D model
loads lazily with a progress bar when you open the explorer, and every repeat
visit is instant.

## Local preview

```bash
npx serve .        # or: python -m http.server
```

Then open http://localhost:3000 (service workers require http(s) or localhost).

## Credits

- 3D model: [Z-Anatomy](https://www.z-anatomy.com/) (CC BY-SA 4.0), based on BodyParts3D © DBCLS
- Plates: Gray's Anatomy (1918) and open-license sources via Wikimedia Commons
