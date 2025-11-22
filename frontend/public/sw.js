self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  clients.claim();
});

self.addEventListener("fetch", (event) => {
  // PWA online-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
