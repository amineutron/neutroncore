import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FILTRES_DEFAUT, ecrireFiltres, filtrer, lienAvis, lireFiltres, phraseResume, retardPhrase, type Item, type Tableau } from './mises'

const I = (p: Partial<Item>): Item => ({
  id: 'x', source: 'dnf', portee: 'systeme', nom: 'x', installe: '1', disponible: '2', ecart: 'correctif', retard_jours: null,
  securite: { niveau: 'aucune', avis: [], cves: [] },
  integrite: { signature: 'verifiee', detail: '', depot: '', origine: '', digest: '' },
  proposition: { commande: '', action: null }, note: '', a_jour: false, en_retard: false, ...p,
})
const tout = { ...FILTRES_DEFAUT, apropos: false }

describe('filtres du tableau des mises à jour', () => {
  const items = [
    I({ id: 'a', portee: 'systeme' }),
    I({ id: 'b', portee: 'ordinateur', source: 'flatpak', en_retard: true }),
    I({ id: 'c', portee: 'systeme', securite: { niveau: 'haute', avis: ['A'], cves: [] }, en_retard: true }),
    I({ id: 'd', portee: 'ordinateur', source: 'docker', disponible: null, a_jour: true }),
  ]
  const ids = (f: Partial<typeof tout>) => filtrer(items, { ...tout, ...f }).map((i) => i.id)
  it('sans filtre : tout, avec « à mettre à jour » : ce qui a une mise à jour', () => {
    expect(ids({})).toEqual(['a', 'b', 'c', 'd'])
    expect(ids({ apropos: true })).toEqual(['a', 'b', 'c'])
  })
  it('système seulement, sécurité seulement, en retard : se cumulent', () => {
    expect(ids({ portee: 'systeme' })).toEqual(['a', 'c'])
    expect(ids({ securite: true })).toEqual(['c'])
    expect(ids({ retard: true })).toEqual(['b', 'c'])
    expect(ids({ retard: true, portee: 'systeme' })).toEqual(['c'])
  })
})

describe('filtres mémorisés', () => {
  // vitest tourne sous node : un stockage minimal remplace celui du navigateur
  beforeEach(() => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('relit ce qui a été écrit', () => {
    ecrireFiltres({ portee: 'systeme', securite: true, retard: false, apropos: false })
    expect(lireFiltres()).toEqual({ portee: 'systeme', securite: true, retard: false, apropos: false })
  })
  it('valeurs par défaut si rien ou si abîmé', () => {
    expect(lireFiltres()).toEqual(FILTRES_DEFAUT)
    localStorage.setItem('neutroncore_mises_filtres', '{pas du json')
    expect(lireFiltres()).toEqual(FILTRES_DEFAUT)
    localStorage.setItem('neutroncore_mises_filtres', '{"portee":"n importe quoi","securite":"oui"}')
    expect(lireFiltres()).toEqual(FILTRES_DEFAUT)
  })
})

describe('phrases', () => {
  it('retard', () => {
    expect(retardPhrase(I({ disponible: null }))).toBe('à jour')
    expect(retardPhrase(I({ retard_jours: 81 }))).toBe('avis publié il y a 81 j')
    expect(retardPhrase(I({ ecart: 'majeur' }))).toBe('saut de version majeur')
  })
  it('résumé', () => {
    const t = (r: Partial<Tableau['resume']>, releve: number | null = 1) =>
      ({ releve_le: releve, resume: { a_mettre_a_jour: 0, securite: 0, critiques: 0, redemarrage: false, en_retard: 0, ...r } }) as Tableau
    expect(phraseResume(t({}, null))).toBe('aucun relevé : lance-en un')
    expect(phraseResume(t({}))).toBe('tout est à jour')
    expect(phraseResume(t({ a_mettre_a_jour: 5, critiques: 1, redemarrage: true }))).toBe('5 à mettre à jour · 1 alerte sécurité haute · redémarrage à prévoir')
  })
  it('liens d\'avis : seulement des identifiants reconnus', () => {
    expect(lienAvis('CVE-2026-62268')).toBe('https://nvd.nist.gov/vuln/detail/CVE-2026-62268')
    expect(lienAvis('FEDORA-2026-056196047a')).toContain('bodhi.fedoraproject.org')
    expect(lienAvis('javascript:alert(1)')).toBeNull()
    expect(lienAvis('CVE-2026-1')).toBeNull()
  })
})
