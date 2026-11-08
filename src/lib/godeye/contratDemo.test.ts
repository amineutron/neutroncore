// God Eye : contrat front / back. Les réponses des routes de démo (qui reproduisent celles de l'API) doivent traverser
// les fonctions de lecture du front sans perte : si l'une change de forme sans l'autre, ce test le dit.
import { describe, expect, it } from 'vitest'
import { godeye } from '../../mock/data/godeye'
import { godeyeFiabilite } from '../../mock/data/godeyeFiabilite'
import { godeyeSuivis } from '../../mock/data/godeyeSuivis'
import { zonesRoutes } from '../../mock/data/godeyeZones'
import type { MockHandler } from '../../mock/router'
import { COUCHES } from './modele'
import { lireFraicheur } from './fraicheur'
import { lireHistorique } from './historique'
import { lireReglagesServeur } from './reglagesServeur'
import { lireRotation, lireZones as lireZonesVue } from './rotation'
import { lireResume, phrases } from './resume'
import { lireSuivis } from './suivi'
import { lireVues } from './vues'
import { lireZones } from './zones'

const toutes = [...godeye, ...godeyeFiabilite, ...godeyeSuivis, ...zonesRoutes]
const appeler = (methode: string, chemin: string, p: { params?: Record<string, string>; query?: string; body?: unknown } = {}): unknown => {
  const h: MockHandler | undefined = toutes.find(([m, c]) => m === methode && c === chemin)?.[2]
  if (!h) throw new Error(`route de démo absente : ${methode} ${chemin}`)
  return h({ params: p.params ?? {}, query: new URLSearchParams(p.query ?? ''), body: p.body })
}

describe('contrat démo : zones', () => {
  it('les deux zones de démo sont lues sans perte', () => {
    const brut = appeler('GET', '/godeye/zones') as { zones: unknown[] }
    const lues = lireZones(brut)
    expect(lues).toHaveLength(brut.zones.length)
    expect(lues).toEqual(brut.zones)
    expect(lues.map((z) => z.forme).sort()).toEqual(['cercle', 'rect'])
  })
  it('la lecture simplifiée de la rotation les reconnaît aussi', () => {
    const vues = lireZonesVue(appeler('GET', '/godeye/zones'))
    expect(vues).toHaveLength(2)
    expect(vues.every((z) => z.nom.length > 0 && Number.isFinite(z.rayonKm) && z.rayonKm > 0)).toBe(true)
  })
  it('créer une zone par la démo : la réponse est relue à l\'identique', () => {
    const corps = { nom: 'test contrat', forme: 'cercle', centre: { lat: 10, lon: 20 }, rayon_km: 50, objets: ['avion'], actif: true, notifier: true }
    const rep = appeler('PUT', '/godeye/zones/:id', { params: { id: 'new' }, body: corps })
    const z = lireZones({ zones: [rep] })[0]
    expect(z).toMatchObject(corps)
    expect(z.id).toMatch(/^demo/)
    appeler('DELETE', '/godeye/zones/:id', { params: { id: z.id } })
    expect(lireZones(appeler('GET', '/godeye/zones'))).toHaveLength(2)
  })
})

describe('contrat démo : réglages, fraîcheur, historique, résumé', () => {
  it('réglages : lus par lireReglagesServeur, rotation et historique conservés', () => {
    const brut = appeler('GET', '/godeye/reglages')
    const r = lireReglagesServeur(brut)
    expect(r).not.toBeNull()
    expect(r?.avance?.historique_heures).toBe(24)
    expect(r?.avance?.rotation).toEqual(lireRotation((brut as { rotation: unknown }).rotation))
    expect(r?.elements).toBeNull() // objets vides : le front garde sa version locale
    expect(r?.filtres).toBeNull()
  })
  it('fraîcheur : chaque couche annoncée est conservée avec un âge fini', () => {
    const brut = appeler('GET', '/godeye/fraicheur') as { couches: Record<string, { age_s: number; ok: boolean; perime: boolean }> }
    const lue = lireFraicheur(brut)
    expect(Object.keys(lue).sort()).toEqual(Object.keys(brut.couches).sort())
    for (const [id, c] of Object.entries(brut.couches)) {
      const l = lue[id as keyof typeof lue]
      expect(l?.age_s).toBe(c.age_s)
      expect(l?.ok).toBe(true)
      expect(l?.perime).toBe(false)
      expect(typeof l?.maj).toBe('string')
      expect(COUCHES.some((x) => x.id === id)).toBe(true)
    }
  })
  it('historique : tous les séismes de démo passent et les heures sont bornées', () => {
    const brut = appeler('GET', '/godeye/historique', { query: 'heures=48' }) as { seismes: unknown[] }
    const h = lireHistorique(brut)
    expect(h.seismes).toHaveLength(brut.seismes.length)
    expect(h.seismes.every((s) => Number.isFinite(s.mag) && Number.isFinite(s.t) && s.id.length > 0)).toBe(true)
    expect(lireHistorique(appeler('GET', '/godeye/historique', { query: 'heures=1' })).seismes.length).toBeLessThanOrEqual(h.seismes.length)
  })
  it('résumé : les cinq blocs sont relus et se traduisent en phrases', () => {
    const r = lireResume(appeler('GET', '/godeye/resume', { query: 'heures=12' }))
    expect(r).not.toBeNull()
    expect(r?.seismes).toEqual({ total: 14, max: { mag: 5.6, lieu: 'Îles Kouriles' } })
    expect(r?.evenements.total).toBe(6)
    expect(r?.evenements.parType.map((x) => x.type)).toEqual(['incendie', 'tempete', 'volcan'])
    expect(r?.suivis).toEqual([{ nom: 'ISS (ZARYA)', distanceKm: 18_240 }])
    expect(r?.zones).toEqual([{ nom: 'Baltique', entrees: 2 }])
    const l = phrases(r!, 12).join('\n')
    expect(l).toContain('14 séismes en 12 h')
    expect(l).toContain('magnitude 5.6')
    expect(l).toContain('zone Baltique : 2 entrées')
    expect(l).not.toMatch(/undefined|NaN/)
  })
})

describe('contrat démo : suivis et vues', () => {
  it('un suivi ajouté est relu avec son type, son nom et sa première position', () => {
    const rep = appeler('POST', '/godeye/suivis', { body: { id: 'abc123', type: 'avion', nom: 'TEST1', lat: 46, lon: 3 } })
    const s = lireSuivis(rep)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ id: 'abc123', type: 'avion', nom: 'TEST1' })
    expect(s[0].points).toHaveLength(1)
    expect(s[0].points[0]).toMatchObject({ lat: 46, lon: 3 })
    expect(Number.isFinite(s[0].depuis)).toBe(true)
    // chaque lecture ajoute une position fictive : aucune n'est perdue par la lecture
    const brut = appeler('GET', '/godeye/suivis') as { suivis: { points: unknown[] }[] }
    expect(lireSuivis(brut)[0].points).toHaveLength(brut.suivis[0].points.length)
    expect(lireSuivis(appeler('DELETE', '/godeye/suivis/:id', { params: { id: 'abc123' } }))).toEqual([])
  })
  it('vues enregistrées de démo : lues sans perte', () => {
    const brut = appeler('GET', '/godeye/vues') as { vues: { id: string; nom: string }[] }
    const v = lireVues(brut)
    expect(v).toHaveLength(brut.vues.length)
    expect(v[0].nom).toBe(brut.vues[0].nom)
    expect(v[0].camera).toEqual({ cx: 10, cy: 48, zoom: 4 })
    expect(v[0].filtres.couches.avions).toBe(true)
  })
})
