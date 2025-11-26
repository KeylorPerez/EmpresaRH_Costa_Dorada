self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      await clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Fuerza a que todas las peticiones se resuelvan siempre desde la red
  // (sin usar cache del navegador) y como respaldo intenta usar el cache
  // solo si el request ya estaba almacenado. Esto previene que versiones
  // viejas de archivos estáticos queden atascadas en el cliente.
  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request, { cache: "no-store" });
      } catch (error) {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        throw error;
      }
    })()
  );
});
