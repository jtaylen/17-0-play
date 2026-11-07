// 17-0 Draft service worker: makes the hosted game playable offline once visited.
// Strategy: the game shell (index.html, manifest, icons) is cached on install; navigations and
// same-origin assets are served from cache first and refreshed in the background, except art/ (fonts, images: immutable, cached
// on first use, never refetched, never in SHELL). Range requests (video) skip the cache. Bump VERSION
// whenever index.html changes so players get the new build on their next visit.
const VERSION = "17-0-v20";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./faq.html", "./how-to-play.html", "./games-like-17-0.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Only same-origin GETs; API calls (Supabase) go straight to the network.
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // A Range request (video) goes straight to the network: a cached full 200 is not a valid answer, and Cache.put rejects a 206.
  if (e.request.headers.has("range")) { e.respondWith(fetch(e.request)); return; }
  if (url.pathname.includes("/art/")) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const fetched = fetch(e.request).then(res => {
      if (res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => hit);
    return hit || fetched;
  }));
});
