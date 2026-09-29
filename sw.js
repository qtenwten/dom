const CACHE_NAME = 'qsen-dom-react-v1'
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '')
const asset = (path = '') => `${BASE_PATH}/${path}`
const APP_SHELL = [asset(), asset('index.html'), asset('manifest.webmanifest'), asset('icon.svg')]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('qsen-dom-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(`${BASE_PATH}/`)) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(asset('index.html'), response.clone()))
      return response
    }).catch(() => caches.match(asset('index.html'))))
    return
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
    return response
  })))
})
