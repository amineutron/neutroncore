import { describe, expect, it } from 'vitest'
import { fakeStorage } from './fakeStorage'
import { createQueueStore, drain, enqueue, MAX_AGE_MS, MAX_ITEMS, pruneExpired, QUEUE_KEY, type QueueItem } from './queue'

const item = (id: string, over: Partial<QueueItem> = {}): QueueItem => ({
  id, method: 'PUT', path: '/launcher/favorites', body: { id }, key: `PUT /launcher/favorites ${id}`, queuedAt: 1000, ...over,
})

describe('enqueue', () => {
  it('remplace l\'element de meme cle (dernier gagne) sans muter l\'entree', () => {
    const a = [item('a', { key: 'k' })]
    const r = enqueue(a, { method: 'PUT', path: '/p', body: 2, key: 'k' }, 2000, 'b')
    expect(r.items.map((i) => i.id)).toEqual(['b'])
    expect(a.map((i) => i.id)).toEqual(['a'])
  })

  it('plafonne a MAX_ITEMS en jetant les plus anciens', () => {
    let items: QueueItem[] = []
    for (let n = 0; n < MAX_ITEMS + 3; n++) {
      items = enqueue(items, { method: 'POST', path: '/p', key: `k${n}` }, n, `i${n}`).items
    }
    expect(items).toHaveLength(MAX_ITEMS)
    expect(items[0].id).toBe('i3')
  })
})

describe('pruneExpired', () => {
  it('separe les actions trop anciennes', () => {
    const r = pruneExpired([item('old', { queuedAt: 0 }), item('new', { queuedAt: MAX_AGE_MS })], MAX_AGE_MS + 1)
    expect(r.expired.map((i) => i.id)).toEqual(['old'])
    expect(r.kept.map((i) => i.id)).toEqual(['new'])
  })
})

describe('drain', () => {
  const items = [item('a'), item('b'), item('c')]

  it('tout passe : file vide, ordre respecte', async () => {
    const order: string[] = []
    const r = await drain(items, async (i) => { order.push(i.id); return 200 }, 2000)
    expect(order).toEqual(['a', 'b', 'c'])
    expect(r).toMatchObject({ done: 3, remaining: [], rejected: [] })
  })

  it('erreur reseau : on s\'arrete, l\'element fautif et la suite restent', async () => {
    const r = await drain(items, async (i) => { if (i.id === 'b') throw new TypeError('x'); return 200 }, 2000)
    expect(r.done).toBe(1)
    expect(r.remaining.map((i) => i.id)).toEqual(['b', 'c'])
  })

  it.each([500, 503, 401, 403, 429, 408])('statut %i : on garde et on s\'arrete', async (st) => {
    const r = await drain(items, async (i) => (i.id === 'a' ? st : 200), 2000)
    expect(r.remaining).toHaveLength(3)
    expect(r.done).toBe(0)
  })

  it.each([400, 404, 409, 422])('statut %i : abandonne, la suite continue', async (st) => {
    const r = await drain(items, async (i) => (i.id === 'a' ? st : 200), 2000)
    expect(r.rejected.map((i) => i.id)).toEqual(['a'])
    expect(r.done).toBe(2)
    expect(r.remaining).toEqual([])
  })

  it('les actions expirees ne sont jamais envoyees', async () => {
    const sent: string[] = []
    const r = await drain([item('old', { queuedAt: 0 }), item('ok', { queuedAt: MAX_AGE_MS })], async (i) => { sent.push(i.id); return 200 }, MAX_AGE_MS + 5)
    expect(sent).toEqual(['ok'])
    expect(r.expired.map((i) => i.id)).toEqual(['old'])
  })
})

describe('createQueueStore', () => {
  it('aller-retour', () => {
    const st = createQueueStore(fakeStorage())
    const it1 = item('a', { key: 'PUT /launcher/favorites' })
    st.save([it1])
    expect(st.load()).toEqual([it1])
    st.save([])
    expect(st.load()).toEqual([])
  })

  it('revalide a la lecture : une action non eligible ou mal formee est ecartee', () => {
    const s = fakeStorage()
    s.setItem(QUEUE_KEY, JSON.stringify([
      { id: '1', method: 'POST', path: '/tv/power', queuedAt: 1 },
      { id: '2', method: 'DELETE', path: '/launcher/favorites', queuedAt: 1 },
      { id: '3', method: 'PUT', path: '/launcher/favorites', body: { a: 1 }, queuedAt: 1 },
      { method: 'PUT', path: '/launcher/favorites', queuedAt: 1 },
      null,
    ]))
    expect(createQueueStore(s).load().map((i) => i.id)).toEqual(['3'])
  })

  it('stockage corrompu ou plein : jamais d\'exception', () => {
    const s = fakeStorage(10)
    s.map.set(QUEUE_KEY, '{pas du json')
    const st = createQueueStore(s)
    expect(st.load()).toEqual([])
    expect(st.save([item('a')])).toBe(false)
  })
})
