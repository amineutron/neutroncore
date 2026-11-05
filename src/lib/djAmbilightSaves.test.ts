import { describe, expect, it } from 'vitest'
import { REGLAGES_AMBILIGHT } from './djAmbilight'
import {
  NB_SAUVEGARDES, NOM_SAUVEGARDE_MAX, SAUVEGARDES_DEPART, charger, enregistrerDans, lireReglagesAmbilight, lireStockage, nommer, ecrireStockage,
} from './djAmbilightSaves'

describe('lireReglagesAmbilight : ce qui manque ou déraille reprend la valeur par défaut', () => {
  it('rend les défauts pour n’importe quoi', () => {
    for (const brut of [undefined, null, 42, 'x', [], {}]) expect(lireReglagesAmbilight(brut)).toEqual(REGLAGES_AMBILIGHT)
  })
  it('garde les valeurs valides', () => {
    const r = lireReglagesAmbilight({ min: 20, max: 70, lissage: 55, cadence: 6, couleur: '#00ff88', voie: 'lounge', signal: 'basses' })
    expect(r).toEqual({ min: 20, max: 70, lissage: 55, cadence: 6, couleur: '#00ff88', voie: 'lounge', signal: 'basses' })
  })
  it('borne les nombres', () => {
    const r = lireReglagesAmbilight({ min: -50, max: 900, lissage: 1000, cadence: 500 })
    expect([r.min, r.max, r.lissage, r.cadence]).toEqual([0, 100, 100, 15])
    expect(lireReglagesAmbilight({ cadence: 0 }).cadence).toBe(1)
  })
  it('remet un minimum supérieur au maximum dans l’ordre', () => {
    const r = lireReglagesAmbilight({ min: 80, max: 30 })
    expect(r.min).toBeLessThanOrEqual(r.max)
  })
  it('refuse une couleur, une voie ou un signal inconnus', () => {
    const r = lireReglagesAmbilight({ couleur: 'rouge', voie: 'autre', signal: 'inexistant' })
    expect([r.couleur, r.voie, r.signal]).toEqual([REGLAGES_AMBILIGHT.couleur, REGLAGES_AMBILIGHT.voie, REGLAGES_AMBILIGHT.signal])
  })
  it('refuse un signal qui est une impulsion (kick) : l’Ambilight suit un niveau continu', () => {
    expect(lireReglagesAmbilight({ signal: 'kick' }).signal).toBe(REGLAGES_AMBILIGHT.signal)
  })
  it('met la couleur en minuscules', () => {
    expect(lireReglagesAmbilight({ couleur: '#FF8C28' }).couleur).toBe('#ff8c28')
  })
})

describe('sauvegardes', () => {
  it('il y en a toujours exactement quatre, déjà nommées et utilisables', () => {
    expect(SAUVEGARDES_DEPART).toHaveLength(NB_SAUVEGARDES)
    for (const s of SAUVEGARDES_DEPART) {
      expect(s.nom.length).toBeGreaterThan(0)
      expect(lireReglagesAmbilight(s.reglages)).toEqual(s.reglages)
    }
    expect(new Set(SAUVEGARDES_DEPART.map((s) => s.nom)).size).toBe(NB_SAUVEGARDES)
  })
  it('enregistrerDans remplace les réglages de la case et garde son nom, sans toucher à l’original', () => {
    const r = { ...REGLAGES_AMBILIGHT, min: 33, max: 66 }
    const apres = enregistrerDans(SAUVEGARDES_DEPART, 2, r)
    expect(apres[2].reglages).toEqual(r)
    expect(apres[2].nom).toBe(SAUVEGARDES_DEPART[2].nom)
    expect(apres[0]).toEqual(SAUVEGARDES_DEPART[0])
    expect(SAUVEGARDES_DEPART[2].reglages).not.toEqual(r)
  })
  it('nommer rogne, borne à la longueur max et refuse un nom vide', () => {
    expect(nommer(SAUVEGARDES_DEPART, 1, '  ma soirée  ')[1].nom).toBe('ma soirée')
    expect(nommer(SAUVEGARDES_DEPART, 1, 'x'.repeat(60))[1].nom).toHaveLength(NOM_SAUVEGARDE_MAX)
    expect(nommer(SAUVEGARDES_DEPART, 1, '   ')[1].nom).toBe(SAUVEGARDES_DEPART[1].nom)
  })
  it('ignore un indice hors des quatre cases', () => {
    expect(enregistrerDans(SAUVEGARDES_DEPART, 7, REGLAGES_AMBILIGHT)).toEqual(SAUVEGARDES_DEPART)
    expect(nommer(SAUVEGARDES_DEPART, -1, 'x')).toEqual(SAUVEGARDES_DEPART)
    expect(charger(SAUVEGARDES_DEPART, 9)).toBeNull()
  })
  it('charger rend une copie des réglages de la case', () => {
    const r = charger(SAUVEGARDES_DEPART, 0)
    expect(r).toEqual(SAUVEGARDES_DEPART[0].reglages)
    expect(r).not.toBe(SAUVEGARDES_DEPART[0].reglages)
  })
})

describe('stockage du navigateur', () => {
  const memoire = (init?: string) => {
    const m = new Map<string, string>(init === undefined ? [] : [['k', init]])
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }
  it('relit ce qui a été écrit : réglages, quatre cases et case courante', () => {
    const s = memoire()
    const sauv = nommer(enregistrerDans(SAUVEGARDES_DEPART, 1, { ...REGLAGES_AMBILIGHT, min: 40 }), 1, 'mon réglage')
    ecrireStockage('k', { reglages: { ...REGLAGES_AMBILIGHT, max: 77 }, sauvegardes: sauv, courante: 1 }, s)
    const lu = lireStockage('k', s)
    expect(lu.reglages.max).toBe(77)
    expect(lu.sauvegardes[1].nom).toBe('mon réglage')
    expect(lu.sauvegardes[1].reglages.min).toBe(40)
    expect(lu.courante).toBe(1)
  })
  it('rend les défauts si rien n’est stocké ou si le contenu est abîmé', () => {
    for (const s of [memoire(), memoire('{pas du json'), memoire('[1]'), memoire(JSON.stringify({ sauvegardes: 'oups', reglages: 3 }))]) {
      const lu = lireStockage('k', s)
      expect(lu.reglages).toEqual(REGLAGES_AMBILIGHT)
      expect(lu.sauvegardes).toEqual(SAUVEGARDES_DEPART)
      expect(lu.courante).toBeNull()
    }
  })
  it('complète des cases manquantes et jette les cases en trop', () => {
    const brut = JSON.stringify({ sauvegardes: [{ nom: 'a', reglages: { min: 5 } }], reglages: {}, courante: 0 })
    const lu = lireStockage('k', memoire(brut))
    expect(lu.sauvegardes).toHaveLength(NB_SAUVEGARDES)
    expect(lu.sauvegardes[0].nom).toBe('a')
    expect(lu.sauvegardes[0].reglages.min).toBe(5)
    expect(lu.sauvegardes[1]).toEqual(SAUVEGARDES_DEPART[1])
    const trop = JSON.stringify({ sauvegardes: Array.from({ length: 9 }, (_, i) => ({ nom: `s${i}`, reglages: {} })), reglages: {}, courante: 0 })
    expect(lireStockage('k', memoire(trop)).sauvegardes).toHaveLength(NB_SAUVEGARDES)
  })
  it('ignore une case courante hors des quatre', () => {
    expect(lireStockage('k', memoire(JSON.stringify({ sauvegardes: [], reglages: {}, courante: 12 }))).courante).toBeNull()
  })
  it('survit à un stockage indisponible', () => {
    const casse = { getItem: () => { throw new Error('bloqué') }, setItem: () => { throw new Error('bloqué') } }
    expect(lireStockage('k', casse).reglages).toEqual(REGLAGES_AMBILIGHT)
    expect(() => ecrireStockage('k', { reglages: REGLAGES_AMBILIGHT, sauvegardes: SAUVEGARDES_DEPART, courante: null }, casse)).not.toThrow()
  })
})
