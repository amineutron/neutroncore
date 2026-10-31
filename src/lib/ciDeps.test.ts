import { describe, expect, it } from 'vitest'
import {
  FILTRES_CI, FILTRES_DEPS, aplatir, commandeConseillee, depotSain, ecrireStocke, filtrerPrs, filtrerVulns, fmtDuree, lireStocke,
  phraseCorrectif, phraseResumeCi, prAttention, trierDepotsCi, type DepotCi, type Pr, type ProjetDeps, type Vuln,
} from './ciDeps'

const P = (p: Partial<Pr>): Pr => ({ numero: 1, titre: 't', branche: 'b', url: '', brouillon: false, conflit: false, maj: '', auteur: 'a', revue: '', controles: 'aucun', dependabot: false, ecosysteme: '', ...p })
const V = (p: Partial<Vuln>): Vuln => ({ paquet: 'x', gravite: 'haute', direct: true, titres: [], via: [], intervalle: '', url: '', correctif: { disponible: true, version: '1.0.1', majeur: false, via: '' }, ...p })
const D = (depot: string, p: Partial<DepotCi> = {}): DepotCi => ({ depot, github: 'a/b', prs: [], dependabot: [], alertes: null, workflows: [], ...p })

describe('PR', () => {
  it.each([
    [{ controles: 'echec' }, 'crit'], [{ conflit: true }, 'crit'], [{ controles: 'attente' }, 'warn'], [{ revue: 'changes_requested' }, 'warn'],
    [{ controles: 'ok', revue: 'approved' }, 'ok'], [{ controles: 'ok', dependabot: true }, 'ok'], [{ controles: 'ok', brouillon: true, revue: 'approved' }, ''], [{}, ''],
  ] as [Partial<Pr>, string][])('attention %j', (p, attendu) => expect(prAttention(P(p))).toBe(attendu))

  it('filtre brouillons, dependabot et problèmes', () => {
    const prs = [P({ numero: 1, brouillon: true }), P({ numero: 2, dependabot: true, controles: 'echec' }), P({ numero: 3, controles: 'ok', revue: 'approved' })]
    expect(filtrerPrs(prs, FILTRES_CI)).toHaveLength(3)
    expect(filtrerPrs(prs, { ...FILTRES_CI, sansBrouillons: true }).map((p) => p.numero)).toEqual([2, 3])
    expect(filtrerPrs(prs, { ...FILTRES_CI, dependabotSeul: true }).map((p) => p.numero)).toEqual([2])
    expect(filtrerPrs(prs, { ...FILTRES_CI, seulementProblemes: true }).map((p) => p.numero)).toEqual([2])
  })
})

describe('dépôts CI', () => {
  const run = (etat: 'ok' | 'echec') => ({ id: 1, workflow: 'ci', titre: '', branche: 'main', evenement: 'push', etat, url: '', le: '', duree_s: 1 })
  const wf = (etat: 'ok' | 'echec') => ({ workflow: 'ci', dernier: run(etat), serie: [etat], taux_ok: 100, duree_moy_s: 1, echecs_ailleurs: 0 })
  it('sain / pas sain', () => {
    expect(depotSain(D('a'))).toBe(true)
    expect(depotSain(D('a', { workflows: [wf('echec')] }))).toBe(false)
    expect(depotSain(D('a', { erreur: 'x' }))).toBe(false)
    expect(depotSain(D('a', { alertes: { total: 1, par_gravite: {}, alertes: [] } }))).toBe(false)
    expect(depotSain(D('a', { prs: [P({ conflit: true })] }))).toBe(false)
  })
  it('les dépôts en échec passent devant', () => {
    expect(trierDepotsCi([D('b'), D('c', { workflows: [wf('echec')] }), D('a')]).map((d) => d.depot)).toEqual(['c', 'a', 'b'])
  })
  it('durées et phrase de résumé', () => {
    expect(fmtDuree(null)).toBe('-'); expect(fmtDuree(42)).toBe('42 s'); expect(fmtDuree(125)).toBe('2 min 05'); expect(fmtDuree(3700)).toBe('1 h 01')
    const base = { depots: 1, prs: 0, prs_controles_en_echec: 0, prs_en_conflit: 0, dependabot_prs: 0, builds_en_echec: 0, builds_en_cours: 0, alertes: 0, alertes_graves: 0, illisibles: 0 }
    expect(phraseResumeCi(base)).toBe('tout est vert')
    expect(phraseResumeCi({ ...base, builds_en_echec: 1, prs_en_conflit: 2, alertes_graves: 1 })).toBe('1 build en échec, 2 PR en conflit, 1 alerte grave')
  })
})

describe('vulnérabilités', () => {
  const projets: ProjetDeps[] = [
    { projet: 'front', npm: { erreur: '', par_gravite: {}, vulns: [V({ paquet: 'b', gravite: 'basse' }), V({ paquet: 'a', gravite: 'critique', direct: false })] }, pip: null },
    { projet: 'api', npm: null, pip: { erreur: '', par_gravite: {}, vulns: [V({ paquet: 'c', gravite: 'inconnue', correctif: { disponible: false, version: '', majeur: false, via: '' } })] } },
  ]
  it('aplatit et trie du plus grave au moins grave', () => {
    const l = aplatir(projets)
    expect(l.map((v) => v.source)).toEqual(['npm', 'npm', 'pip'])
    expect(filtrerVulns(l, FILTRES_DEPS).map((v) => v.paquet)).toEqual(['a', 'c', 'b'])
  })
  it('filtres gravité, correctif, directes, projet', () => {
    const l = aplatir(projets)
    expect(filtrerVulns(l, { ...FILTRES_DEPS, gravites: ['critique', 'basse'] }).map((v) => v.paquet)).toEqual(['a', 'b'])
    expect(filtrerVulns(l, { ...FILTRES_DEPS, avecCorrectif: true }).map((v) => v.paquet)).toEqual(['a', 'b'])
    expect(filtrerVulns(l, { ...FILTRES_DEPS, directes: true }).map((v) => v.paquet)).toEqual(['c', 'b'])
    expect(filtrerVulns(l, { ...FILTRES_DEPS, projet: 'api' }).map((v) => v.paquet)).toEqual(['c'])
  })
  it('phrases de correctif et commandes à lancer à la main', () => {
    const c = (p: object) => ({ disponible: true, version: '', majeur: false, via: '', ...p })
    expect(phraseCorrectif(c({ disponible: false }))).toEqual({ texte: 'pas de correctif', tone: '' })
    expect(phraseCorrectif(c({ version: '2.0.0', majeur: true })).tone).toBe('warn')
    expect(phraseCorrectif(c({ version: '1.2.3' }))).toEqual({ texte: 'corrigé en 1.2.3', tone: 'ok' })
    expect(phraseCorrectif(c({}))).toEqual({ texte: 'correctif disponible', tone: 'ok' })
    expect(commandeConseillee('npm', V({}))).toBe('npm audit fix')
    expect(commandeConseillee('npm', V({ correctif: c({ majeur: true, version: '9.0.0', via: 'vite' }) }))).toBe('npm install vite@9.0.0')
    expect(commandeConseillee('pip', V({ paquet: 'cryptography', correctif: c({ version: '46.0.1' }) }))).toBe('pip install -U "cryptography>=46.0.1"')
    expect(commandeConseillee('pip', V({ correctif: c({ disponible: false }) }))).toBe('')
  })
})

describe('filtres mémorisés', () => {
  const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v } } }
  it('aller-retour, clés inconnues ou de mauvais type ignorées', () => {
    const s = mem()
    expect(lireStocke('k', FILTRES_DEPS, s)).toEqual(FILTRES_DEPS)
    ecrireStocke('k', { ...FILTRES_DEPS, gravites: ['haute'], directes: true }, s)
    expect(lireStocke('k', FILTRES_DEPS, s)).toEqual({ ...FILTRES_DEPS, gravites: ['haute'], directes: true })
    s.setItem('k', JSON.stringify({ directes: 'oui', gravites: 'x', intrus: 1, projet: 'api' }))
    expect(lireStocke('k', FILTRES_DEPS, s)).toEqual({ ...FILTRES_DEPS, projet: 'api' })
    s.setItem('k', 'pas du json')
    expect(lireStocke('k', FILTRES_DEPS, s)).toEqual(FILTRES_DEPS)
    s.setItem('k', '[1]')
    expect(lireStocke('k', FILTRES_DEPS, s)).toEqual(FILTRES_DEPS)
  })
  it('stockage qui lève : pas de plantage', () => {
    const casse = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(lireStocke('k', FILTRES_CI, casse)).toEqual(FILTRES_CI)
    expect(() => ecrireStocke('k', FILTRES_CI, casse)).not.toThrow()
  })
})
