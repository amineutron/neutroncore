import { describe, expect, it } from 'vitest'
import {
  courbe, croissanceJour, etiquettes, FILTRES_DEFAUT, filtrer, fmtAge, fmtDuree, joursAvantPlein, lignes, lireFiltres,
  phraseTendance, tonAge, tonEspace, type Ligne, type Tableau,
} from './sauvegardes'

const L = (p: Partial<Ligne>): Ligne => ({ id: 'x', source: 'timeshift', ts: 1000, nom: 'n', etiquette: 'daily', taille: 1, neuf: 1, duree_s: 1, fichiers: 1, ...p })
const JOUR = 86400

describe('sauvegardes : formats', () => {
  it.each([[null, '-'], [42, '42 s'], [89.24, '1 min 29 s'], [3720, '1 h 02']])('durée %s', (s, attendu) => {
    expect(fmtDuree(s as number | null)).toBe(attendu)
  })
  it.each([[null, 'jamais'], [0.001, 'à l’instant'], [0.5, 'il y a 12 h'], [2.4, 'il y a 2 j']])('âge %s', (j, attendu) => {
    expect(fmtAge(j as number | null)).toBe(attendu)
  })
  it('tendance en mots', () => {
    expect(phraseTendance({ sens: 'hausse', pct: 12.5 })).toBe('plus gros (+12.5 %)')
    expect(phraseTendance({ sens: 'baisse', pct: -8 })).toBe('plus petit (-8 %)')
    expect(phraseTendance({ sens: 'stable', pct: 1 })).toBe('stable')
    expect(phraseTendance({ sens: 'inconnue', pct: null })).toBe('pas assez de points')
    expect(phraseTendance(undefined)).toBe('pas assez de points')
  })
})

describe('sauvegardes : teintes', () => {
  it('âge par rapport à la limite', () => {
    expect(tonAge(1, 2)).toBe('ok')
    expect(tonAge(3, 2)).toBe('warn')
    expect(tonAge(5, 2)).toBe('crit')
    expect(tonAge(null, 2)).toBe('crit')
  })
  it('espace libre', () => {
    expect(tonEspace(40)).toBe('ok')
    expect(tonEspace(9.4)).toBe('warn')
    expect(tonEspace(3)).toBe('crit')
    expect(tonEspace(null)).toBe('warn')
  })
  it('jours avant disque plein', () => {
    const e = { montage: '/', total: 100, utilise: 90, libre: 10e9, libre_pct: 10 }
    expect(joursAvantPlein(e, 1e9)).toBe(10)
    expect(joursAvantPlein(e, 0)).toBeNull()
    expect(joursAvantPlein(null, 1e9)).toBeNull()
  })
})

describe('sauvegardes : historique filtré', () => {
  const now = 100 * JOUR
  const base = [
    L({ id: '1', ts: now - 1 * JOUR, etiquette: 'daily', taille: 5, duree_s: 90 }),
    L({ id: '2', ts: now - 10 * JOUR, etiquette: 'ondemand', taille: 9, duree_s: 10 }),
    L({ id: '3', ts: now - 40 * JOUR, source: 'borg', etiquette: 'hebdo', taille: 7, duree_s: 50 }),
  ]
  it('période et source', () => {
    expect(filtrer(base, { ...FILTRES_DEFAUT, periode: '30' }, now).map((x) => x.id)).toEqual(['1', '2'])
    expect(filtrer(base, { ...FILTRES_DEFAUT, periode: 'tout' }, now)).toHaveLength(3)
    expect(filtrer(base, { ...FILTRES_DEFAUT, periode: 'tout', source: 'borg' }, now).map((x) => x.id)).toEqual(['3'])
  })
  it('l’étiquette ne touche que timeshift', () => {
    const r = filtrer(base, { ...FILTRES_DEFAUT, periode: 'tout', etiquette: 'daily' }, now)
    expect(r.map((x) => x.id)).toEqual(['1', '3'])
  })
  it('tris, sans modifier la liste d’origine', () => {
    const copie = [...base]
    expect(filtrer(base, { ...FILTRES_DEFAUT, periode: 'tout', tri: 'taille' }, now).map((x) => x.id)).toEqual(['2', '3', '1'])
    expect(filtrer(base, { ...FILTRES_DEFAUT, periode: 'tout', tri: 'duree' }, now).map((x) => x.id)).toEqual(['1', '3', '2'])
    expect(base).toEqual(copie)
  })
  it('étiquettes proposées', () => {
    expect(etiquettes(base)).toEqual(['toutes', 'daily', 'ondemand'])
  })
  it('fusion des deux sources en lignes', () => {
    const t = {
      timeshift: { liste: [{ nom: 'a', ts: 5, etiquette: '', commentaire: '', fichiers: 1, taille: 2, transfere: 3, duree_s: 4 }] },
      borg: { liste: [{ archive: 'b', debut: '2026-10-18T02:06:27', original: 9, nouveau: 1, duree_s: 3 }] },
    } as unknown as Pick<Tableau, 'timeshift' | 'borg'>
    const l = lignes(t)
    expect(l.map((x) => x.id)).toEqual(['t:a', 'b:b'])
    expect(l[0].etiquette).toBe('-')
    expect(l[1].ts).toBeGreaterThan(1.7e9)
  })
})

describe('sauvegardes : croissance', () => {
  it('octets neufs par jour', () => {
    const l = [L({ ts: 0, neuf: 100 }), L({ ts: 2 * JOUR, neuf: 100 }), L({ ts: JOUR, neuf: null })]
    expect(croissanceJour(l)).toBe(100)
    expect(croissanceJour([L({ ts: 0, neuf: 5 })])).toBeNull()
    expect(croissanceJour([L({ ts: 0, neuf: 5 }), L({ ts: 60, neuf: 5 })])).toBeNull()
  })
})

describe('sauvegardes : courbe et filtres retenus', () => {
  it('courbe', () => {
    expect(courbe([1], 100, 10)).toBe('')
    expect(courbe([1, null, 3], 100, 10)).toBe('0.0,10.0 100.0,0.0')
    expect(courbe([5, 5], 100, 10)).toBe('0.0,5.0 100.0,5.0')
  })
  it('filtres relus : valeurs inconnues ramenées au défaut', () => {
    expect(lireFiltres(null)).toEqual(FILTRES_DEFAUT)
    expect(lireFiltres('pas du json')).toEqual(FILTRES_DEFAUT)
    expect(lireFiltres(JSON.stringify({ source: 'borg', periode: '7', tri: 'taille', etiquette: 'daily' })))
      .toEqual({ source: 'borg', periode: '7', tri: 'taille', etiquette: 'daily' })
    expect(lireFiltres(JSON.stringify({ source: 'x', periode: 3, tri: {}, etiquette: 'e'.repeat(99) }))).toEqual(FILTRES_DEFAUT)
  })
})
