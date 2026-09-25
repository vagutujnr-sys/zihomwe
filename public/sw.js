self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== "zihomwe-static-v2")
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // Keep API and authenticated page responses network-backed; cache only static assets.
  if (
    request.destination === "document" ||
    request.url.includes("/_next/data/") ||
    new URL(request.url).pathname.startsWith("/api/")
  ) return;

  event.respondWith(
    caches.open("zihomwe-static-v2").then(async (cache) => {
      const cached = await cache.match(request);

      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return cached ?? Response.error();
      }
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
  self.skipWaiting();
  }
});
