const CACHE_NAME = "mistake-book-v1";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/manifest.json",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/mistake-book.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for navigation, stale-while-revalidate for assets, skip API routes
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip non-http(s) requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith("http")) return;

  // NEVER intercept API or auth endpoints (Drive sync, auth callbacks, etc.)
  if (url.pathname.startsWith("/api/")) return;

  // HTML navigation requests: Network-first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        })
    );
    return;
  }

  // Static assets (Next.js bundles, images, icons, fonts)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
