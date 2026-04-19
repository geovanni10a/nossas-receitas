var VERSION = "nr-v2-supabase";
var APP_SHELL_CACHE = VERSION + "-shell";
var RUNTIME_CACHE = VERSION + "-runtime";
var RECIPE_CACHE = VERSION + "-recipes";
var APP_SHELL_URLS = [
  "./",
  "./index.html",
  "./livro.html",
  "./admin.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/livro.css",
  "./css/categorias.css",
  "./css/receita.css",
  "./css/admin.css",
  "./js/utils.js",
  "./js/supabase-client.js",
  "./js/storage.js",
  "./js/sync-status.js",
  "./js/busca.js",
  "./js/dom.js",
  "./js/categorias.js",
  "./js/receita.js",
  "./js/livro.js",
  "./js/validation.js",
  "./js/admin.js",
  "./js/pwa.js",
  "./assets/capa.jpg",
  "./assets/favicon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/og.png",
  "./assets/sem-foto.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL_URLS.map(function (url) {
        return new Request(url, { cache: "reload" });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if ([APP_SHELL_CACHE, RUNTIME_CACHE, RECIPE_CACHE].indexOf(key) === -1) {
          return caches.delete(key);
        }

        return Promise.resolve();
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

function isRecipeRequest(url) {
  return url.origin === self.location.origin && /\/data\/receitas\.json$/i.test(url.pathname);
}

function isRuntimeAsset(url, request) {
  var runtimeHosts = [
    self.location.origin,
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
    "https://unpkg.com"
  ];
  var destination = request.destination;

  return runtimeHosts.indexOf(url.origin) !== -1
    && ["style", "script", "image", "font"].indexOf(destination) !== -1;
}

function buildRecipeCacheKey(requestUrl) {
  var url = new URL(requestUrl);

  url.searchParams.delete("t");

  return url.toString();
}

function buildNavigationCacheKey(requestUrl) {
  var url = new URL(requestUrl);

  if (url.origin !== self.location.origin) {
    return requestUrl;
  }

  if (url.pathname === "/" || !url.pathname) {
    return "./index.html";
  }

  return "." + url.pathname;
}

function buildStaticCacheKey(requestUrl) {
  var url = new URL(requestUrl);

  if (url.origin !== self.location.origin) {
    return requestUrl;
  }

  if (url.pathname === "/" || !url.pathname) {
    return "./index.html";
  }

  return "." + url.pathname;
}

async function networkFirstPage(request) {
  var cache = await caches.open(APP_SHELL_CACHE);
  var cacheKey = buildNavigationCacheKey(request.url);

  try {
    var fresh = await fetch(request);

    if (fresh && fresh.ok) {
      cache.put(cacheKey, fresh.clone());
    }

    return fresh;
  } catch (error) {
    return (await cache.match(cacheKey))
      || (await cache.match("./offline.html"))
      || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  var runtimeCache = await caches.open(RUNTIME_CACHE);
  var shellCache = await caches.open(APP_SHELL_CACHE);
  var staticKey = buildStaticCacheKey(request.url);
  var cached = (await runtimeCache.match(request))
    || (await runtimeCache.match(staticKey))
    || (await shellCache.match(staticKey))
    || (await shellCache.match(request));
  var networkPromise = fetch(request).then(function (response) {
    if (response && response.ok) {
      runtimeCache.put(staticKey, response.clone());
    }

    return response;
  }).catch(function () {
    return null;
  });

  if (cached) {
    return cached;
  }

  return (await networkPromise) || Response.error();
}

async function networkFirstRecipe(request) {
  var cache = await caches.open(RECIPE_CACHE);
  var cacheKey = buildRecipeCacheKey(request.url);

  try {
    var fresh = await fetch(request);

    if (fresh && fresh.ok) {
      cache.put(cacheKey, fresh.clone());
    }

    return fresh;
  } catch (error) {
    return (await cache.match(cacheKey)) || Response.error();
  }
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (isRecipeRequest(url)) {
    event.respondWith(networkFirstRecipe(request));
    return;
  }

  if (isRuntimeAsset(url, request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
