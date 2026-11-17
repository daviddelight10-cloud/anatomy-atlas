# Anatomy Atlas

Interactive human anatomy atlas (500+ structures) with a 3D explorer built on
Z-Anatomy (CC BY-SA 4.0, based on BodyParts3D © DBCLS).

**Live site:** https://daviddelight10-cloud.github.io/anatomy-atlas/

## Features

- 📖 500+ anatomical structures with labeled plates (Gray's Anatomy 1918, Wikimedia Commons)
- 🧊 Full-screen 3D explorer — drag, zoom, tap structures (three.js + Draco), presets, peel/slice/explode, X-ray, wireframe
- 📌 **Anchored pins** — pin any structure: a marker sticks to the body with a leader-line label (drag it, double-click for a note), survives reloads and deep links
- 🎓 **Learn mode** (`#/learn`) — guided lessons that fly the camera through Location → Form → Function → Neighbours → Clinical for every structure, in method inspired by TeachMeAnatomy/AnatomyQuest
- 🙈 Hide-the-labels self-test, 2D + 3D quizzes, XP/streaks/badges
- 🧠 **Spaced repetition** — structures you miss come back for review on a 1/2/4/8/16-day schedule
- 🗺️ Body map, searchable index, dark/light themes
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
