/* CRM service worker - lets the app open with no connection.
 *
 * It only stores the app itself (page + scripts + styles + images). Data never goes through it:
 * /api and /uploads are always left to the network so nothing private is kept here, and the app
 * saves its own offline copies and queued writes in IndexedDB (see src/offline).
 *
 * Bump VERSION to force every phone to drop old caches.
 */
const VERSION = 'v1';
const SHELL_CACHE = 'crm-shell-' + VERSION;
const ASSET_CACHE = 'crm-assets-' + VERSION;
const MAX_ASSETS = 250;

// Registered at <base>sw.js, so the scope (and the app root) is the folder this file lives in.
const SCOPE = self.registration.scope; // e.g. https://host/crm/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.add(new Request(SCOPE, { cache: 'reload' }))).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

// Page navigations: always try the network first (so a deploy shows up straight away), and fall
// back to the last good copy of the app when there is no connection.
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') cache.put(SCOPE, res.clone());
    return res;
  } catch (err) {
    const cached = (await cache.match(SCOPE)) || (await cache.match(SCOPE + 'index.html'));
    if (cached) return cached;
    throw err;
  }
}

// Built files have a content hash in their name, so a cached copy is always correct: serve it
// instantly, fetch only when missing.
async function handleAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    cache.put(request, res.clone());
    trim(cache);
  }
  return res;
}

// Icons, fonts and other static files: show the saved copy, refresh it in the background.
async function handleStatic(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => { if (res.ok && res.type === 'basic') cache.put(request, res.clone()); return res; })
    .catch(() => hit);
  return hit || refresh;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(SCOPE)) return; // never touch the public website or anything outside the CRM
  const path = url.pathname;
  if (path.includes('/api/') || path.includes('/uploads/')) return;
  if (path.endsWith('/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
  } else if (path.includes('/assets/')) {
    event.respondWith(handleAsset(request));
  } else {
    event.respondWith(handleStatic(request));
  }
});
