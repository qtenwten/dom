const CACHE_NAME = 'qsen-dom-react-v2'
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '')
const asset = (path = '') => `${BASE_PATH}/${path}`
const APP_SHELL = [
  asset(),
  asset('index.html'),
  asset('404.html'),
  asset('manifest.webmanifest'),
  asset('icon.svg'),
]

async function appShellFallback(response) {
  if (response?.ok) {
    const copy = response.clone()
    caches.open(CACHE_NAME).then((cache) => cache.put(asset('index.html'), copy))
    return response
  }

  return (await caches.match(asset('index.html'))) || response
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('qsen-dom-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(`${BASE_PATH}/`)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(appShellFallback)
        .catch(() => caches.match(asset('index.html'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    })),
  )
})
