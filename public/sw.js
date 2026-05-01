// Service Worker CarryBooks - Cache offline simple
const CACHE_NAME = "carrybooks-v2";
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
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

  // Stratégie: Network first, Cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Mettre en cache les ressources statiques de l'app
        if (response.ok && (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".html") || url.pathname === "/")) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
        }
        return response;
      })
      .catch(() => {
        // Hors connexion: chercher dans le cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback: renvoyer index.html pour les routes navigation
          if (request.mode === "navigate") {
            return caches.match("/index.html");
          }
          return new Response("Hors connexion", { status: 503 });
        });
      })
  );
});
