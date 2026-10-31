/* Service worker de la coque neutroncore (sert /app/ uniquement).
 *
 * Il ne touche JAMAIS a l'API : seules les requetes sous sa portee (/app/...) sont
 * traitees, tout le reste (API a la racine de l'origine) passe sans lui. Le cache des
 * donnees est fait par la page (src/lib/offline) : il a besoin de l'horodatage, de
 * l'etat reseau et marche aussi hors contexte securise (coque Android en http).
 *
 * Version : sw.js?v=<BUILD_ID>, ecrit par la page qui l'enregistre. Page, bundle et
 * cache de la coque portent donc toujours le meme numero.
 *   - navigation (index.html) : reseau d'abord, repli sur la derniere copie ;
 *   - assets (hashes, polices, icones) : stale-while-revalidate ;
 *   - mise a jour : skipWaiting + claim (aucun ecart possible page/version) ; on garde le
 *     cache de la version PRECEDENTE pour qu'un onglet reste sur l'ancien bundle puisse
 *     encore charger ses morceaux (three.js) jusqu'a son rechargement.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'unknown'
const PREFIX = 'nc-shell-'
const CACHE = PREFIX + VERSION
const SCOPE = self.registration.scope // se termine par « / »
const META = SCOPE + '__installed'
const NAV_TIMEOUT_MS = 8000

async function precache() {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(SCOPE, { cache: 'reload' })
    if (res.ok) {
      await cache.put(SCOPE, res.clone())
      const html = await res.text()
      const urls = new Set()
      for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        const u = new URL(m[1], SCOPE)
        if (u.origin === self.location.origin && u.href.startsWith(SCOPE) && !u.pathname.endsWith('.html')) {
          urls.add(u.href)
        }
      }
      await Promise.allSettled([...urls].map((u) => cache.add(u)))
    }
  } catch (e) {
    /* hors ligne a l'installation : les assets se rempliront a l'usage */
  }
  await cache.put(META, new Response(String(Date.now())))
}

async function prune() {
  const names = (await caches.keys()).filter((n) => n.startsWith(PREFIX) && n !== CACHE)
  const dated = await Promise.all(names.map(async (n) => {
    const r = await (await caches.open(n)).match(META)
    return { n, t: r ? Number(await r.text()) || 0 : 0 }
  }))
  dated.sort((a, b) => b.t - a.t)
  await Promise.all(dated.slice(1).map((d) => caches.delete(d.n))) // garde la precedente
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(prune().then(() => self.clients.claim()))
})

function timeout(ms) {
  return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await Promise.race([fetch(req), timeout(NAV_TIMEOUT_MS)])
    if (res.ok) await cache.put(SCOPE, res.clone()) // une seule page : l'index
    return res
  } catch (e) {
    const old = (await cache.match(SCOPE)) || (await matchAnyVersion(SCOPE))
    return old || new Response('hors ligne, et aucune copie de la page n’est gardée', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function matchAnyVersion(url) {
  for (const n of await caches.keys()) {
    if (!n.startsWith(PREFIX)) continue
    const hit = await (await caches.open(n)).match(url)
    if (hit) return hit
  }
  return undefined
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE)
  const hit = (await cache.match(event.request)) || (await matchAnyVersion(event.request.url))
  const refresh = fetch(event.request).then(async (res) => {
    if (res.ok && res.type === 'basic') await cache.put(event.request, res.clone())
    return res
  })
  if (hit) {
    event.waitUntil(refresh.catch(() => undefined))
    return hit
  }
  return refresh
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.headers.has('range')) return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return // API : hors portee
  if (url.href === self.location.href.split('?')[0]) return // sw.js lui-meme
  if (req.mode === 'navigate') event.respondWith(networkFirst(req))
  else event.respondWith(staleWhileRevalidate(event))
})
