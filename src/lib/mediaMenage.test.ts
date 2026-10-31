import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FILTRES_DEFAUT, ecrireFiltres, filtrer, lireFiltres, origineRecos, phraseEspace, progressionScan, type Proposition, type ScanEtat } from './mediaMenage'

const prop = (id: number, over: Partial<Proposition> = {}): Proposition => ({
  cle: `movie:${id}`, kind: 'movie', id, title: `Film ${id}`, year: 2020, quality: 'WEBDL-1080p', added: '', path: '',
  motifs: [{ code: 'jamais_vu', detail: '' }], apparent: 100, libere: 100, retenu: 0, seme: 0, confiance: 'haute', ...over,
} as Proposition)

const fmt = (n: number) => `${n}o`

describe('filtrer', () => {
  const liste = [prop(1), prop(2, { motifs: [{ code: 'qualite', detail: '' }] }), prop(3, { kind: 'series', cle: 'series:3', title: 'Élan' }), prop(4, { libere: 0, retenu: 100 })]

  it('garde les éléments dont au moins un motif est actif', () => {
    expect(filtrer(liste, { ...FILTRES_DEFAUT, motifs: ['qualite'] }).map((p) => p.id)).toEqual([2])
  })
  it('filtre par type, par espace réellement libéré et par titre sans accent', () => {
    expect(filtrer(liste, { ...FILTRES_DEFAUT, kind: 'series' }).map((p) => p.id)).toEqual([3])
    expect(filtrer(liste, { ...FILTRES_DEFAUT, seulementLibere: true }).map((p) => p.id)).toEqual([1, 2, 3])
    expect(filtrer(liste, { ...FILTRES_DEFAUT, q: 'elan' }).map((p) => p.id)).toEqual([3])
  })
})

describe('filtres retenus', () => {
  beforeEach(() => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) })
  })
  it('aller-retour', () => {
    const f = { ...FILTRES_DEFAUT, kind: 'movie' as const, q: 'dune', seulementLibere: true }
    ecrireFiltres(f)
    expect(lireFiltres()).toEqual(f)
  })
  it.each(['pas du json', '{"motifs":"x","kind":"zzz","q":3}', 'null'])('valeur abîmée %s : défauts sûrs', (brut) => {
    localStorage.setItem('neutroncore_menage_filtres', brut)
    const f = lireFiltres()
    expect(f.kind).toBe('tous')
    expect(f.q).toBe('')
    expect(Array.isArray(f.motifs)).toBe(true)
  })
  it('motifs inconnus écartés', () => {
    localStorage.setItem('neutroncore_menage_filtres', JSON.stringify({ motifs: ['qualite', 'bidon'] }))
    expect(lireFiltres().motifs).toEqual(['qualite'])
  })
})

describe('espace', () => {
  it.each([
    [{ apparent: 100, libere: 100, retenu: 0, seme: 0 }, '100o libérés'],
    [{ apparent: 100, libere: 0, retenu: 100, seme: 100 }, 'rien de libéré : 100o encore semés par un torrent'],
    [{ apparent: 100, libere: 0, retenu: 100, seme: 0 }, 'rien de libéré : un autre lien garde le fichier'],
    [{ apparent: 100, libere: 60, retenu: 40, seme: 40 }, "60o libérés (40o gardés par d'autres liens)"],
  ])('phrase %#', (p, attendu) => expect(phraseEspace(p, fmt)).toBe(attendu))
})

describe('divers', () => {
  const scan = (fait: number, total: number): ScanEtat => ({ etat: 'en_cours', total, fait, saute: 0, erreurs: 0, debut: 0, fin: 0, courant: '' })
  it('progression bornée', () => {
    expect(progressionScan(scan(0, 0))).toBe(0)
    expect(progressionScan(scan(1, 3))).toBe(33)
    expect(progressionScan(scan(9, 3))).toBe(100)
  })
  it("origine des suggestions", () => {
    expect(origineRecos({ genere: 1, source: 'modele', modele: 'llama3.2:3b', suggestions: [] })).toBe('modèle local llama3.2:3b')
    expect(origineRecos({ genere: 1, source: 'repli', raison_repli: 'GPU occupé', suggestions: [] })).toBe('sans modèle (GPU occupé)')
  })
})
