// 17-0 Draft service worker: makes the hosted game playable offline once visited.
// Strategy: the game shell (index.html, manifest, icons) is cached on install; navigations and
// same-origin assets are served from cache first and refreshed in the background. Bump VERSION
// whenever index.html changes so players get the new build on their next visit.
const VERSION = "17-0-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Only same-origin GETs; API calls (Supabase) and fonts go straight to the network.
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => {
    const fetched = fetch(e.request).then(res => {
      if (res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => hit);
    return hit || fetched;
  }));
});
