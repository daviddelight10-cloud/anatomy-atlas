/* Anatomy Atlas service worker — app shell + model + plates + CDN caching. */
const VERSION = "v17";
const SHELL = `atlas-shell-${VERSION}-r4`;
const MODEL = `atlas-model-${VERSION}`;
const PLATES = `atlas-plates-${VERSION}`;
const CDN = `atlas-cdn-${VERSION}`;
const FONTS = `atlas-fonts-${VERSION}`;

const SHELL_URLS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "offline.html",
  "img/poster.jpg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/favicon-16.png",
  "icons/mark-256.png",
  "icons/icon-mono-512.png",
  "vendor/three.module.js",
  "vendor/addons/controls/OrbitControls.js",
  "vendor/addons/loaders/GLTFLoader.js",
  "vendor/addons/loaders/DRACOLoader.js",
  "vendor/addons/environments/RoomEnvironment.js",
  "vendor/addons/postprocessing/EffectComposer.js",
  "vendor/addons/postprocessing/RenderPass.js",
  "vendor/addons/postprocessing/ShaderPass.js",
  "vendor/addons/postprocessing/MaskPass.js",
  "vendor/addons/postprocessing/Pass.js",
  "vendor/addons/postprocessing/SSAOPass.js",
  "vendor/addons/shaders/CopyShader.js",
  "vendor/addons/shaders/SSAOShader.js",
  "vendor/addons/shaders/UnpackDepthRGBAShader.js",
  "vendor/addons/shaders/GammaCorrectionShader.js",
  "vendor/addons/math/SimplexNoise.js",
  "vendor/addons/utils/BufferGeometryUtils.js",
  "vendor/draco/draco_decoder.js",
  "vendor/draco/draco_decoder.wasm",
  "vendor/draco/draco_wasm_wrapper.js",
];

const MODEL_URL = "model.bin";
const PLATE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const PLATE_LIMIT = 500; // LRU cap for anatomy plates

const PIXEL = new Response(
  Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), c => c.charCodeAt(0)),
  { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } }
);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, MODEL, PLATES, CDN, FONTS]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

/* Trim a cache to maxEntries, oldest-first (FIFO — insertion order). */
async function trim(cacheName, maxEntries) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i <= keys.length - maxEntries; i++) await c.delete(keys[i]);
}

async function cacheFirst(cacheName, request, { fallback } = {}) {
  const cached = await caches.match(request, { ignoreSearch: cacheName === MODEL });
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === "opaque")) {
      const c = await caches.open(cacheName);
      c.put(request, res.clone());
    }
    return res;
  } catch (err) {
    if (fallback) return fallback;
    throw err;
  }
}

async function staleWhileRevalidate(cacheName, request) {
  const c = await caches.open(cacheName);
  const cached = await c.match(request);
  const net = fetch(request).then(res => {
    if (res && (res.ok || res.type === "opaque")) c.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || net.then(r => r || fetch(request));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App shell + 3D model: same-origin GETs
  if (url.origin === location.origin) {
    // Navigations: network-first, fall back to cached shell, then offline page
    if (req.mode === "navigate") {
      e.respondWith((async () => {
        try {
          const res = await fetch(req);
          const c = await caches.open(SHELL);
          c.put("index.html", res.clone());
          return res;
        } catch (err) {
          return (await caches.match("index.html")) || (await caches.match("offline.html"));
        }
      })());
      return;
    }
    const path = url.pathname;
    if (path.endsWith("/" + MODEL_URL) || path.endsWith(MODEL_URL)) {
      e.respondWith(cacheFirst(MODEL, req));
      return;
    }
    // Shell assets (index.html, manifest, icons, sw.js itself): cache-first
    e.respondWith(cacheFirst(SHELL, req));
    return;
  }

  // Anatomy plates on Wikimedia: cache-first with LRU trim; offline → transparent pixel
  if (PLATE_HOSTS.has(url.hostname)) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) {
          const c = await caches.open(PLATES);
          await c.put(req, res.clone());
          trim(PLATES, PLATE_LIMIT);
        }
        return res;
      } catch (err) {
        return PIXEL.clone();
      }
    })());
    return;
  }

  // jsdelivr (three.js, draco, shaders): immutable versioned → cache-first
  if (url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(cacheFirst(CDN, req));
    return;
  }

  // Google Fonts: CSS → SWR, font files → cache-first
  if (url.hostname === "fonts.googleapis.com") {
    e.respondWith(staleWhileRevalidate(FONTS, req));
    return;
  }
  if (url.hostname === "fonts.gstatic.com") {
    e.respondWith(cacheFirst(FONTS, req));
    return;
  }
});
