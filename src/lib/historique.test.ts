import { describe, expect, it } from 'vitest'
import {
  FILTRES_DEFAUT, ajouterRegle, avertissementTarif, bornes, fmtCout, fmtTokens, graphique, lireFiltres, lireTaux,
  modifierRegle, phraseIndexation, remplirJours, retirerRegle, type Ligne, type RapportUsage, type Tarifs,
} from './historique'

const L = (cle: string, p: Partial<Ligne> = {}): Ligne => ({ cle, entree: 1, sortie: 2, lecture: 100, ecriture: 10, cout: 0.5, messages: 1, ...p })

describe('filtres memorises', () => {
  it('retombe sur le defaut si le stockage est vide ou illisible', () => {
    expect(lireFiltres(null)).toEqual(FILTRES_DEFAUT)
    expect(lireFiltres('{pas du json')).toEqual(FILTRES_DEFAUT)
  })
  it('garde les valeurs valides et ecarte les autres', () => {
    const f = lireFiltres(JSON.stringify({ onglet: 'cout', projet: 'lyra', jour: '2026-10-20', natures: ['cmd', 'bidon'], periode: '7', mode: 'x' }))
    expect(f).toMatchObject({ onglet: 'cout', projet: 'lyra', jour: '2026-10-20', natures: ['cmd'], periode: '7', mode: FILTRES_DEFAUT.mode })
    expect(lireFiltres(JSON.stringify({ jour: 'hier', natures: ['bidon'] }))).toMatchObject({ jour: '', natures: FILTRES_DEFAUT.natures })
  })
})

describe('periodes', () => {
  it('compte aujourd’hui dans la periode', () => {
    expect(bornes('7', new Date(2026, 9, 20))).toEqual({ debut: '2026-10-14', fin: '2026-10-20' })
    expect(bornes('30', new Date(2026, 9, 5))).toEqual({ debut: '2026-09-06', fin: '2026-10-05' })
    expect(bornes('tout', new Date(2026, 9, 20))).toEqual({ debut: '', fin: '2026-10-20' })
  })
})

describe('formats', () => {
  it.each([[999, '999'], [1500, '1.5 k'], [250000, '250 k'], [2_340_000, '2.34 M'], [3e9, '3.00 Md']])('tokens %s', (n, t) => {
    expect(fmtTokens(n)).toBe(t)
  })
  it('cout', () => {
    expect(fmtCout(1.234, 'USD')).toBe('1.23 USD')
    expect(fmtCout(45.64, 'EUR')).toBe('45.6 EUR')
  })
  it('phrase d’indexation', () => {
    const base = { en_cours: false, total: 0, faits: 0, duree_s: null, premiere_indexation_s: null, erreur: '' }
    expect(phraseIndexation({ ...base, en_cours: true, total: 290, faits: 12 })).toBe('indexation des transcripts : 12 / 290')
    expect(phraseIndexation({ ...base, duree_s: 7.1 })).toContain('7.1 s')
    expect(phraseIndexation({ ...base, erreur: 'boum' })).toContain('boum')
  })
})

describe('graphique', () => {
  it('complete les jours sans activite', () => {
    expect(remplirJours([L('2026-10-30'), L('2026-11-02')])).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(remplirJours([])).toEqual([])
  })
  it('empile selon le mode', () => {
    const lignes = [L('2026-10-19'), L('2026-10-21', { sortie: 7 })]
    const g = graphique(lignes, 'hors_cache')
    expect(g.jours).toHaveLength(3)
    expect(g.series.map((s) => s.cle)).toEqual(['entree', 'sortie'])
    expect(g.series[1].valeurs).toEqual([2, 0, 7])
    expect(g.max).toBe(8)
    expect(graphique(lignes, 'cout').series).toHaveLength(1)
    expect(graphique(lignes, 'tout').series).toHaveLength(4)
  })
})

describe('tarif', () => {
  const T: Tarifs = { devise: 'USD', regles: [], defaut: { entree: 0, sortie: 0, lecture: 0, ecriture: 0, ecriture_1h: 0 } }
  it('edite sans muter', () => {
    const a = ajouterRegle(T, 'opus')
    const b = modifierRegle(a, 0, { sortie: 25 })
    expect(T.regles).toHaveLength(0)
    expect(a.regles[0].sortie).toBe(0)
    expect(b.regles[0]).toMatchObject({ motif: 'opus', sortie: 25 })
    expect(retirerRegle(b, 0).regles).toHaveLength(0)
  })
  it.each([['5', 5], ['2,5', 2.5], ['-3', 0], ['abc', 0], ['', 0]])('lireTaux(%s)', (t, n) => expect(lireTaux(t)).toBe(n))
  it('avertit tant que le tarif est vide ou incomplet', () => {
    const r = { tarif_renseigne: false, modeles_sans_regle: [] } as unknown as RapportUsage
    expect(avertissementTarif(r)).toContain('aucun tarif')
    expect(avertissementTarif({ ...r, tarif_renseigne: true, modeles_sans_regle: ['m1'] })).toContain('m1')
    expect(avertissementTarif({ ...r, tarif_renseigne: true })).toBe('')
  })
})
