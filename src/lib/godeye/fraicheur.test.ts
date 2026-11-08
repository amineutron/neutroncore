import { describe, expect, it } from 'vitest'
import { aSignaler, libelleAge, lireFraicheur, pastille, pastilles, PERIODE_MS } from './fraicheur'
import type { EtatBrut } from './fraicheur'

const T = 1_000_000_000
const ok = (maj: number | null, erreur = ''): EtatBrut => ({ charge: false, erreur, maj })

describe('libelleAge', () => {
  it.each([[0, 'il y a 0 s'], [12, 'il y a 12 s'], [59.6, 'il y a 1 min'], [180, 'il y a 3 min'], [7300, 'il y a 2 h'], [200_000, 'il y a 2 j'], [-5, 'il y a 0 s']])('%s -> %s', (s, t) => {
    expect(libelleAge(s)).toBe(t)
  })
})

describe('pastille', () => {
  it('couche coupée : grise', () => {
    expect(pastille({ couche: 'avions', actif: false, etat: ok(null), maintenant: T }).ton).toBe('off')
  })
  it('frais : vert avec l\'âge', () => {
    const p = pastille({ couche: 'avions', actif: true, etat: ok(T - 12_000), maintenant: T })
    expect(p).toMatchObject({ ton: 'ok', texte: 'il y a 12 s', perime: false })
  })
  it('en retard : orange', () => {
    const p = pastille({ couche: 'avions', actif: true, etat: ok(T - PERIODE_MS.avions * 3), maintenant: T })
    expect(p.ton).toBe('warn')
    expect(p.perime).toBe(true)
  })
  it('erreur avec dernier état : rouge, âge conservé', () => {
    const p = pastille({ couche: 'seismes', actif: true, etat: ok(T - 600_000, 'panne'), maintenant: T })
    expect(p).toMatchObject({ ton: 'crit', perime: true })
    expect(p.texte).toContain('il y a 10 min')
  })
  it('erreur sans rien de connu : injoignable', () => {
    expect(pastille({ couche: 'seismes', actif: true, etat: ok(null, 'x'), maintenant: T })).toMatchObject({ ton: 'crit', texte: 'source injoignable' })
  })
  it('copie restaurée du cache : orange tant que rien de frais', () => {
    const p = pastille({ couche: 'infos', actif: true, etat: ok(null), maintenant: T, restaureA: T - 3_600_000 })
    expect(p).toMatchObject({ ton: 'warn', perime: true })
    expect(p.texte).toContain('copie gardée')
  })
  it('rien de chargé : en attente', () => {
    expect(pastille({ couche: 'infos', actif: true, etat: ok(null), maintenant: T }).texte).toBe('en attente')
  })
  it('le serveur dit périmé alors que rien de local : orange avec son âge', () => {
    const p = pastille({ couche: 'navires', actif: true, etat: ok(null), maintenant: T, serveur: { maj: null, age_s: 900, ok: true, perime: true } })
    expect(p).toMatchObject({ ton: 'warn', ageS: 900 })
  })
  it('le serveur dit en panne : rouge', () => {
    const p = pastille({ couche: 'navires', actif: true, etat: ok(null), maintenant: T, serveur: { maj: null, age_s: 30, ok: false, perime: true } })
    expect(p.ton).toBe('crit')
  })
  it('un chargement local récent l\'emporte sur l\'avis du serveur', () => {
    const p = pastille({ couche: 'navires', actif: true, etat: ok(T - 1000), maintenant: T, serveur: { maj: null, age_s: 900, ok: true, perime: true } })
    expect(p.ton).toBe('ok')
  })
})

describe('pastilles / lireFraicheur', () => {
  const couches = { seismes: true, avions: false, satellites: false, navires: false, evenements: false, infos: true, cyber: false }
  const etats = { seismes: ok(T - 1000), avions: ok(null), satellites: ok(null), navires: ok(null), evenements: ok(null), infos: ok(null, 'x'), cyber: ok(null) }
  it('une pastille par couche, signalement des anomalies', () => {
    const p = pastilles({ filtresCouches: couches, etats, maintenant: T })
    expect(p).toHaveLength(7)
    expect(aSignaler(p).map((x) => x.couche)).toEqual(['infos'])
  })
  it('lireFraicheur ignore le bruit', () => {
    expect(lireFraicheur(null)).toEqual({})
    expect(lireFraicheur({ couches: { avions: { maj: '2026-11-07T10:00:00Z', age_s: 5, ok: true, perime: false }, inconnue: {}, navires: 3 } }))
      .toEqual({ avions: { maj: '2026-11-07T10:00:00Z', age_s: 5, ok: true, perime: false, erreur: undefined } })
  })
})
