// Service Worker CarryBooks v5 - Cache offline + PDF
// ⚠️ Correction du splash infini sur mobile : le HTML (navigation) est TOUJOURS
// servi depuis le réseau en priorité, et on ne sert un index.html en cache QUE
// si le réseau est vraiment indisponible. On ne met plus les fichiers JS/CSS
// hashés dans le cache principal (ils changent de nom à chaque déploiement et
// un ancien index.html réclamant un vieux JS disparu bloquait React au démarrage).
const CACHE_NAME = "carrybooks-v5";
const PDF_CACHE = "carrybooks-pdfs";
const APP_SHELL = ["/index.html", "/manifest.json"];

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

  // 🟢 NAVIGATION (chargement d'une page HTML) : TOUJOURS le réseau d'abord.
  // On ne tombe sur le cache que si le réseau échoue vraiment (hors ligne).
  // Ça empêche de servir un vieux index.html qui réclame un JS disparu.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const respClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", respClone));
          }
          return response;
        })
        .catch(() => caches.match("/index.html").then((c) => c || new Response("Hors connexion", { status: 503 })))
    );
    return;
  }

  // 🟢 Fichiers JS / CSS (hashés par Vite) : réseau d'abord, SANS mise en cache
  // dans le cache principal (sinon on garde des versions périmées).
  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((c) => c || new Response("", { status: 503 })))
    );
    return;
  }

  // PDF : Cache first (priorité au cache)
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

  // Images (couvertures de livres) : Cache first
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

  // Reste : réseau d'abord, cache en secours
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((c) => c || new Response("Hors connexion", { status: 503 })))
  );
});
