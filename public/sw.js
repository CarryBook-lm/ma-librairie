// Service Worker CarryBooks v3 - Cache offline + PDF
const CACHE_NAME = "carrybooks-v3";
const PDF_CACHE = "carrybooks-pdfs";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== PDF_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes API (Supabase, Campay, etc.)
  if (url.hostname.includes("supabase") || url.pathname.startsWith("/api/")) {
    return;
  }

  // Pour les PDF: Cache first (priorité au cache)
  if (url.pathname.endsWith(".pdf") || request.url.includes(".pdf")) {
    event.respondWith(
      caches.match(request, { cacheName: PDF_CACHE }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const respClone = response.clone();
            caches.open(PDF_CACHE).then((cache) => cache.put(request, respClone));
          }
          return response;
        }).catch(() => {
          return new Response("PDF non disponible hors connexion", { status: 503 });
        });
      })
    );
    return;
  }

  // Pour les images (couvertures de livres) : Cache first
  if (request.destination === "image" || url.pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
          }
          return response;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  // Pour le reste (HTML, JS, CSS) : Network first, Cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".html") || url.pathname === "/")) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return new Response("Hors connexion", { status: 503 });
        });
      })
  );
});
