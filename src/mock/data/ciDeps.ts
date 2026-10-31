// CI/PR et dépendances de démonstration : tout est inventé (dépôts, numéros, paquets).
import type { MockHandler } from '../router'
import type { Audit, DepotCi, EtatCiDeps, EtatRun, Pr, ProjetDeps, ReleveDeps, Run, Vuln, Workflow } from '../../lib/ciDeps'

const il = (jours: number) => new Date(Date.now() - jours * 86400000).toISOString()
const run = (id: number, workflow: string, etat: EtatRun, duree: number | null = 140): Run =>
  ({ id, workflow, titre: 'chore: mise à jour', branche: 'main', evenement: 'push', etat, url: 'https://github.com/demo/projet/actions/runs/' + id, le: il(0.2), duree_s: duree })
const wf = (nom: string, serie: EtatRun[], taux: number, id: number): Workflow =>
  ({ workflow: nom, dernier: run(id, nom, serie[0]), serie, taux_ok: taux, duree_moy_s: 150, echecs_ailleurs: 0 })
const pr = (numero: number, titre: string, p: Partial<Pr> = {}): Pr => ({
  numero, titre, branche: 'feat/demo', url: `https://github.com/demo/projet/pull/${numero}`, brouillon: false, conflit: false, maj: il(2),
  auteur: 'demo', revue: '', controles: 'ok', dependabot: false, ecosysteme: '', ...p,
})
const dependabot = pr(13, 'chore(deps-dev): bump the minor-and-patch group with 7 updates', { auteur: 'app/dependabot', dependabot: true, ecosysteme: 'npm_and_yarn', branche: 'dependabot/npm_and_yarn/minor-and-patch-1' })

const depots: DepotCi[] = [
  { depot: 'hub-demo', github: 'demo/hub-demo', principale: 'main', prs: [dependabot, pr(14, 'feat: atelier', { revue: 'approved' }), pr(15, 'fix: caméra', { controles: 'echec', conflit: true })],
    dependabot: [dependabot], workflows: [wf('ci', ['echec', 'ok', 'ok', 'echec', 'ok'], 60, 901), wf('deploy', ['ok', 'ok', 'ok'], 100, 902)],
    alertes: { total: 2, par_gravite: { haute: 1, basse: 1 }, alertes: [
      { paquet: 'vite', ecosysteme: 'npm', gravite: 'haute', resume: 'Server-side request forgery', corrige_en: '8.0.3', url: '' },
      { paquet: 'qs', ecosysteme: 'npm', gravite: 'basse', resume: 'Prototype pollution', corrige_en: '', url: '' }] } },
  { depot: 'api-demo', github: 'demo/api-demo', principale: 'main', prs: [], dependabot: [], workflows: [wf('tests', ['ok', 'ok', 'ok', 'ok'], 100, 903)], alertes: { total: 0, par_gravite: {}, alertes: [] } },
  { depot: 'sans-github', github: '', prs: null, dependabot: [], alertes: null, erreur: 'pas de depot GitHub (remote origin)' },
]

const v = (paquet: string, gravite: Vuln['gravite'], p: Partial<Vuln> = {}): Vuln => ({
  paquet, gravite, direct: true, titres: ['Avis de sécurité de démonstration'], via: [], intervalle: '<2.0.0', url: '',
  correctif: { disponible: true, version: '', majeur: false, via: '' }, ...p,
})
const audit = (vulns: Vuln[]): Audit => ({ erreur: '', vulns, par_gravite: vulns.reduce((a, x) => ({ ...a, [x.gravite]: (a[x.gravite] ?? 0) + 1 }), {} as Audit['par_gravite']) })
const projets: ProjetDeps[] = [
  { projet: 'hub-demo', pip: null, npm: audit([
    v('vite', 'critique', { direct: false, via: ['esbuild'], correctif: { disponible: true, version: '9.0.0', majeur: true, via: 'vite' } }),
    v('lodash', 'haute', { correctif: { disponible: true, version: '4.17.21', majeur: false, via: 'lodash' } }),
    v('ancien-paquet', 'basse', { correctif: { disponible: false, version: '', majeur: false, via: '' } })]) },
  { projet: 'api-demo', npm: null, pip: audit([
    v('cryptography', 'inconnue', { version: '44.0.0', identifiant: 'GHSA-demo-0001', correctif: { disponible: true, version: '46.0.1', majeur: false, via: '' } })]) },
  { projet: 'outil-demo', npm: { erreur: 'getaddrinfo ENOTFOUND registry.npmjs.org', vulns: [], par_gravite: {} }, pip: null },
]
const toutes = projets.flatMap((p) => [...(p.npm?.vulns ?? []), ...(p.pip?.vulns ?? [])])
const deps: ReleveDeps = {
  projets, decouverts: ['api-demo', 'hub-demo', 'outil-demo'], releve_le: il(0.05), duree_s: 48, erreur: '',
  resume: { projets: 3, vulns: toutes.length, par_gravite: { critique: 1, haute: 1, inconnue: 1, basse: 1 }, avec_correctif: 3, sans_correctif: 1, projets_touches: 2, illisibles: 1, pip_audit_absent: false },
}
let exclus: string[] = []

const etat = (): EtatCiDeps => ({
  ci: { depots, releve_le: il(0.02), duree_s: 12, resume: { depots: 3, prs: 3, prs_controles_en_echec: 1, prs_en_conflit: 1, dependabot_prs: 1, builds_en_echec: 1, builds_en_cours: 0, alertes: 2, alertes_graves: 1, illisibles: 1 } },
  deps, en_cours: {}, reglages: { exclus, depots_ci: depots.map((d) => d.depot) },
})

export const ciDeps: [string, string, MockHandler][] = [
  ['GET', '/ci-deps', () => etat()],
  ['POST', '/ci-deps/relancer', () => ({ success: true })],
  ['PUT', '/ci-deps/reglages', ({ body }) => { exclus = ((body as { exclus?: string[] })?.exclus ?? []).filter((e) => typeof e === 'string'); return { success: true, exclus } }],
]
