# Anatomy Atlas

Interactive human anatomy atlas (500+ structures) with a 3D explorer built on
Z-Anatomy (CC BY-SA 4.0, based on BodyParts3D © DBCLS).

**Live site:** https://daviddelight10-cloud.github.io/anatomy-atlas/

## Features

- 📖 500+ anatomical structures with labeled plates (Gray's Anatomy 1918, Wikimedia Commons) — now with **Latin (TA) names**, 🔊 **pronunciation** (speech synthesis), and **cadaver/dissection photos** (Wellcome Collection, CC BY 4.0)
- 🧊 Full-screen 3D explorer — drag, zoom, tap structures (three.js + Draco), presets, peel/slice/explode, X-ray, wireframe
- 💪 **Muscle facts** — structured Origin / Insertion / Innervation / Action tables on muscle pages and in 3D info cards; "Attachments" highlights the origin/insertion marker meshes with a pull-arrow showing the line of action
- 🛤 **Nerve & vessel tracing** — 25 pathways (brachial plexus, median/ulnar/radial nerves, sciatic & femoral approximations, arterial tree, venous return) drawn as colored tubes with a travelling pulse and step-through camera, in the Layers drawer and via `?trace=` deep links
- 📌 **Anchored pins** — pin any structure: a marker sticks to the body with a leader-line label (drag it, double-click for a note), survives reloads and deep links
- 🎓 **Learn mode** (`#/learn`) — guided lessons that fly the camera through Location → Form → Function → Neighbours → Clinical for every structure
- 🛤 **Guided paths** (`#/paths`) — 10 curated tours (upper limb, brachial plexus, exam cram…) with objectives, progress tracking and path badges
- 🎯 **Quiz modes** — multiple choice, **type-the-answer** (fuzzy spell-check), **clinical cases**, **muscle facts**, and a **custom quiz builder** (`#/quiz-builder`) with shareable links like `#/quiz/c:sys=muscular&mode=type&n=20`
- 🔍 **Fuzzy search** — typo-tolerant ("sturnum" → sternum) across names, alternates and Latin
- 🙈 Hide-the-labels self-test, 2D + 3D quizzes, XP/streaks/badges
- 🧠 **Spaced repetition** — structures you miss come back for review on a 1/2/4/8/16-day schedule
- 🗺️ Body map, searchable index, dark/light themes
- 📲 **Installable PWA** — add to home screen on Android, iOS, or desktop
- ⚡ Works offline: the app shell, visited pages, anatomy plates, and the 3D body are cached locally
- 💾 Optional "Save 3D body for offline" — the ~22 MB model downloads once, then never again
- ▶ **Watch** links — curated free anatomy videos (AnatomyZone, The Noted Anatomist, Instant Anatomy) on system and structure pages

## How it works

| Piece | Detail |
|---|---|
| `index.html` | Self-contained app (~2.2 MB inline CSS/JS/data) |
| `model.bin` | Gzipped glTF of the Z-Anatomy body (22 MB), streamed with progress and gunzipped via `DecompressionStream` |
| `sw.js` | Service worker: precaches the shell, cache-first for plates/three.js/fonts/model with LRU trimming |
| `manifest.webmanifest` + `icons/` | Installability |
| `supabase/` | `schema.sql` (subscriptions table + RLS) and the `verify-payment` Edge Function |

On a slow network the first visit downloads only the app shell — the 3D model
loads lazily with a progress bar when you open the explorer, and every repeat
visit is instant.

## Auth & Premium

The app requires an account (Supabase Auth — email/password or Google).
The atlas reference (systems, regions, plates, body map) is free; the 3D
explorer, lessons, guided paths, quizzes, review and articles need **Premium**:

| Plan | Price | Days |
|---|---|---|
| 1 Month | ₦1,500 | 30 |
| Semester | ₦6,000 | 180 |
| 1 Year | ₦10,000 | 365 |

Payments run through the **Paystack** inline popup; a Supabase Edge Function
(`supabase/functions/verify-payment`) verifies the transaction server-side and
writes the subscription row. The `subscriptions` table is RLS-locked — users
read their own rows, only the function writes. Entitlement is cached in
`localStorage("atlas-premium")` so Premium survives offline until expiry.

Setup: create a Supabase project, run `supabase/schema.sql`, deploy
`verify-payment`, set `PAYSTACK_SECRET_KEY` as a function secret, then fill
`SUPA_URL` / `SUPA_ANON_KEY` / `PAYSTACK_PK` near the top of the auth module in
`index.html` (search for `SUPA_URL`; see `.env.example`).

## Local preview

```bash
npx serve .        # or: python -m http.server
```

Then open http://localhost:3000 (service workers require http(s) or localhost).

## Credits

- 3D model: [Z-Anatomy](https://www.z-anatomy.com/) (CC BY-SA 4.0), based on BodyParts3D © DBCLS
- Plates: Gray's Anatomy (1918) and open-license sources via Wikimedia Commons
- Dissection photos & cross-sections: Wellcome Collection ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) and other Commons contributors as marked
- Skeleton poster: "Human skeleton front" by LadyofHats (public domain, Wikimedia Commons)
- Video links point to free educational channels: AnatomyZone, The Noted Anatomist, Instant Anatomy, Ninja Nerd
