/*
 * Service Worker for the Quran PWA.
 *
 * Three caches:
 *   - app-shell-v1: HTML / JS / CSS / fonts — precached on install.
 *   - offline-data-v1: API JSON responses (quran.com, hadith.ai, raw.githubusercontent,
 *     same-origin tafsir chunks). Network-first, fall back to cache.
 *   - offline-audio-v1: MP3 files for recitation. Cache-first.
 *
 * POST requests to hadith.ai are intercepted: the body is hashed and the
 * response is stored under a synthetic URL key. This lets the existing
 * pages run unchanged while still being served from cache when offline.
 *
 * The download manager (offline.html) drives the cache by simply issuing
 * the same fetch() calls the regular pages would; the SW transparently
 * persists the responses.
 */

const VERSION = 'v1';
const APP_SHELL_CACHE = 'app-shell-' + VERSION;
const DATA_CACHE = 'offline-data-' + VERSION;
const AUDIO_CACHE = 'offline-audio-' + VERSION;

const APP_SHELL_URLS = [
  './',
  './index.html',
  './simple.html',
  './hadith.html',
  './commentary.html',
  './offline.html',
  './list.html',
  './search.html',
  './stat.html',
  './favicon.svg',
  './fonts.css',
  './manifest.json',
  './js/sura-data.js',
  './js/sura-picker.js',
  './js/corpus.js',
  './js/buckwalter.js',
  './js/simple-minimap-charts.js',
  './js/search.js',
  './fonts/Sahel.woff',
  './fonts/sura_names.woff2',
  './fonts/sura_names.woff'
];

const HADITH_POST_HOSTS = ['hadith.ai'];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isAudioUrl(url) {
  if (url.hostname === 'verses.quran.com') return true;
  if (url.hostname === 'audio.qurancdn.com') return true;
  if (url.hostname === 'tanzil.net' && url.pathname.indexOf('/res/audio/') === 0) return true;
  if (/\.mp3($|\?)/i.test(url.pathname)) return true;
  return false;
}

function isDataUrl(url) {
  if (url.hostname === 'api.quran.com') return true;
  if (url.hostname === 'raw.githubusercontent.com') return true;
  if (isSameOrigin(url) && url.pathname.indexOf('/data/') !== -1) return true;
  return false;
}

function isFontUrl(url) {
  if (url.hostname === 'verses.quran.foundation') return true;
  if (url.hostname === 'fonts.googleapis.com') return true;
  if (url.hostname === 'fonts.gstatic.com') return true;
  if (isSameOrigin(url) && url.pathname.indexOf('/fonts/') !== -1) return true;
  return false;
}

function isAppShellUrl(url) {
  if (!isSameOrigin(url)) return false;
  if (url.pathname.indexOf('/data/') !== -1) return false;
  return true;
}

function isHadithPost(req, url) {
  return req.method === 'POST' && HADITH_POST_HOSTS.indexOf(url.hostname) !== -1;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    // Use individual add() so a single 404 does not abort install.
    await Promise.all(APP_SHELL_URLS.map(async (u) => {
      try { await cache.add(new Request(u, { cache: 'reload' })); }
      catch (e) { /* ignore: file may be optional */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([APP_SHELL_CACHE, DATA_CACHE, AUDIO_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.map((n) => keep.has(n) ? null : caches.delete(n)));
    await self.clients.claim();
  })());
});

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hash);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

async function postCacheKey(req) {
  const body = await req.clone().text();
  const hash = await sha256Hex(req.url + '|' + body);
  return new Request(req.url + '#body=' + hash, { method: 'GET' });
}

async function handleHadithPost(req) {
  const cache = await caches.open(DATA_CACHE);
  const key = await postCacheKey(req);
  try {
    const resp = await fetch(req.clone());
    if (resp && resp.ok) {
      cache.put(key, resp.clone()).catch(() => {});
    }
    return resp;
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: false });
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp && (resp.ok || resp.type === 'opaque')) {
      cache.put(req, resp.clone()).catch(() => {});
    }
    return resp;
  } catch (err) {
    const fallback = await cache.match(req, { ignoreSearch: true });
    if (fallback) return fallback;
    throw err;
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const resp = await fetch(req);
    if (resp && (resp.ok || resp.type === 'opaque')) {
      cache.put(req, resp.clone()).catch(() => {});
    }
    return resp;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (isHadithPost(req, url)) {
    event.respondWith(handleHadithPost(req));
    return;
  }

  if (req.method !== 'GET') return;

  // Navigation requests: try network, fall back to cached HTML so the app
  // can boot offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req);
        const cache = await caches.open(APP_SHELL_CACHE);
        cache.put(req, resp.clone()).catch(() => {});
        return resp;
      } catch (err) {
        const cache = await caches.open(APP_SHELL_CACHE);
        const cached = await cache.match(req) || await cache.match('./simple.html');
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  if (isAudioUrl(url)) {
    event.respondWith(cacheFirst(req, AUDIO_CACHE));
    return;
  }

  if (isFontUrl(url)) {
    event.respondWith(cacheFirst(req, APP_SHELL_CACHE));
    return;
  }

  if (isDataUrl(url)) {
    event.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  if (isAppShellUrl(url)) {
    event.respondWith(cacheFirst(req, APP_SHELL_CACHE));
    return;
  }
});

/*
 * Messaging API used by the download manager.
 *
 *   { type: 'PING' }                              -> { type: 'PONG', version: VERSION }
 *   { type: 'CLEAR_ALL' }                         -> wipe data + audio caches
 *   { type: 'LIST_KEYS', cache: '<name>' }        -> { type: 'KEYS', urls: [...] }
 *   { type: 'DELETE_BY_PREFIX', prefixes: [...] } -> deletes matching entries
 *   { type: 'HAS_POST', url, body }               -> { type: 'HAS_POST_RESULT', has: bool }
 */
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  const reply = (data) => {
    if (event.source && event.source.postMessage) event.source.postMessage(data);
    else if (event.ports && event.ports[0]) event.ports[0].postMessage(data);
  };

  if (msg.type === 'PING') {
    reply({ type: 'PONG', version: VERSION });
    return;
  }

  if (msg.type === 'CLEAR_ALL') {
    event.waitUntil((async () => {
      await caches.delete(DATA_CACHE);
      await caches.delete(AUDIO_CACHE);
      reply({ type: 'CLEAR_ALL_DONE' });
    })());
    return;
  }

  if (msg.type === 'LIST_KEYS') {
    event.waitUntil((async () => {
      const name = msg.cache === 'audio' ? AUDIO_CACHE : DATA_CACHE;
      const cache = await caches.open(name);
      const keys = await cache.keys();
      reply({ type: 'KEYS', urls: keys.map((k) => k.url) });
    })());
    return;
  }

  if (msg.type === 'DELETE_BY_PREFIX') {
    event.waitUntil((async () => {
      const prefixes = Array.isArray(msg.prefixes) ? msg.prefixes : [];
      const matchAny = (u) => prefixes.some((p) => u.indexOf(p) === 0 || u.indexOf(p) !== -1);
      let removed = 0;
      for (const name of [DATA_CACHE, AUDIO_CACHE]) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        await Promise.all(keys.map(async (k) => {
          if (matchAny(k.url)) {
            const ok = await cache.delete(k);
            if (ok) removed++;
          }
        }));
      }
      reply({ type: 'DELETE_DONE', removed: removed });
    })());
    return;
  }

  if (msg.type === 'HAS_POST') {
    event.waitUntil((async () => {
      try {
        const fakeReq = new Request(msg.url, { method: 'POST', body: msg.body });
        const key = await postCacheKey(fakeReq);
        const cache = await caches.open(DATA_CACHE);
        const hit = await cache.match(key);
        reply({ type: 'HAS_POST_RESULT', has: !!hit, requestId: msg.requestId });
      } catch (e) {
        reply({ type: 'HAS_POST_RESULT', has: false, requestId: msg.requestId });
      }
    })());
    return;
  }
});
