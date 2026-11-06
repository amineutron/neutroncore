// Qualité de démonstration : historique de tests fictif (une batterie instable, une qui ralentit) et dette fictive.
// Non enregistré : à ajouter à ROUTES (voir INTEGRATION.md).
import type { MockHandler } from '../router'
import type { Comparaison, DetailSuite, ElementDette, LigneSuite, ReglagesSante, ReleveDette, RunSante } from '../../lib/qualite'

const T0 = 1_790_000_000
const run = (suite: string, label: string, i: number, ok: boolean, duree: number, echecs: string[] = []): RunSante => ({
  id: `runner:${suite}${i}`, suite, label, source: 'runner', started: T0 + i * 86400 / 2, duree, ok, rc: ok ? 0 : 1,
  commit: `c0de${String(100 + Math.floor(i / 2)).padStart(8, '0')}`, dirty: false, passed: ok ? 120 : 118, failed: ok ? 0 : echecs.length, errors: 0, skipped: 2,
  resume: ok ? '120 passed' : `${echecs.length} failed`, echecs,
})
const flaky = 'tests/test_automations.py::test_plafond_par_jour_applique'
const HISTO: RunSante[] = [
  ...[true, true, false, true, true, false, true, true, true, true].map((ok, i) => run('api', 'pytest lyra-control-api', i, ok, 38 + i * 0.4, ok ? [] : [flaky])),
  ...[10, 10.5, 10.2, 10.1, 10.4, 12.5, 13.1, 13.4, 13.8, 14.2].map((d, i) => run('pytest:unit', 'pytest lyra', i, true, d)),
  ...[true, true, true, false, false, false].map((ok, i) => run('mcp_node', 'MCP fedora-agents', i, ok, 4.1, ok ? [] : ['schema zod vm_start'])),
]
const REGLAGES: ReglagesSante = { fenetre: 10, seuil_tendance: 15, seuil_bench: 10, ignorer_dirty: false }

const pts = (r: RunSante[]) => r.filter((x) => x.ok).map((x) => x.duree)
const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
function tendance(r: RunSante[]) {
  const p = pts(r)
  if (p.length < 5) return { etat: 'insuffisant' as const, variation_pct: 0, mediane: med(p), derniere: p.at(-1) ?? 0, points: p }
  const v = Math.round((med(p.slice(-3)) - med(p.slice(0, -3))) / med(p.slice(0, -3)) * 1000) / 10
  return { etat: v >= 15 ? 'plus_lent' as const : v <= -15 ? 'plus_rapide' as const : 'stable' as const, variation_pct: v, mediane: med(p), derniere: p.at(-1) ?? 0, points: p }
}
const bascules = (r: RunSante[]) => r.slice(1).filter((x, i) => x.ok !== r[i].ok).length
const de = (suite: string) => HISTO.filter((r) => r.suite === suite)

function ligne(suite: string): LigneSuite {
  const r = de(suite), d = r.at(-1)!
  return { suite, label: d.label, runs: r.length, taux_reussite: Math.round(100 * r.filter((x) => x.ok).length / r.length), instable: bascules(r) >= 2, tendance: tendance(r),
    echecs_en_cours: d.ok ? [] : d.echecs, dernier: { id: d.id, started: d.started, duree: d.duree, ok: d.ok, commit: d.commit, dirty: false, passed: d.passed, failed: d.failed, errors: 0, skipped: 2, resume: d.resume } }
}

function detail(suite: string): DetailSuite {
  const r = de(suite)
  const commits = [...new Set(r.map((x) => x.commit))].reverse().map((c) => {
    const g = r.filter((x) => x.commit === c)
    return { commit: c, runs: g.length, ok: g.filter((x) => x.ok).length, dernier: g.at(-1)!.started, sale: false }
  })
  const echecs = r.filter((x) => !x.ok)
  return {
    suite, label: r[0].label, runs: [...r].reverse(), tendance: tendance(r),
    instabilite: { instable: bascules(r) >= 2, bascules: bascules(r), meme_commit: [], taux_reussite: Math.round(100 * r.filter((x) => x.ok).length / r.length), runs: r.length },
    instables: suite === 'api' ? [{ test: flaky, echecs: echecs.length, runs: r.length - 2, bascules: bascules(r), meme_commit: false, dernier_echec: echecs.at(-1)!.started }] : [],
    commits,
  }
}

function bench(a: RunSante, b: RunSante): Comparaison {
  const ecart = Math.round((b.duree - a.duree) * 100) / 100, pct = Math.round((b.duree - a.duree) / a.duree * 1000) / 10
  const cmp = (k: 'passed' | 'failed' | 'errors' | 'skipped') => ({ a: a[k], b: b[k], ecart: b[k] - a[k] })
  const ea = new Set(a.echecs), eb = new Set(b.echecs)
  return {
    suite: a.suite, resultat: a.ok && !b.ok ? 'regression' : !a.ok && b.ok ? 'corrige' : 'identique',
    a: { id: a.id, started: a.started, duree: a.duree, ok: a.ok, commit: a.commit, dirty: false }, b: { id: b.id, started: b.started, duree: b.duree, ok: b.ok, commit: b.commit, dirty: false },
    duree: { a: a.duree, b: b.duree, ecart_s: ecart, variation_pct: pct, verdict: Math.abs(ecart) < 1 || Math.abs(pct) < 10 ? 'equivalent' : pct > 0 ? 'plus_lent' : 'plus_rapide' },
    comptes: { passed: cmp('passed'), failed: cmp('failed'), errors: cmp('errors'), skipped: cmp('skipped') },
    nouveaux_echecs: [...eb].filter((x) => !ea.has(x)), corriges: [...ea].filter((x) => !eb.has(x)), toujours_en_echec: [...ea].filter((x) => eb.has(x)),
  }
}

const D = (i: number, depot: string, fichier: string, ligne: number, marqueur: ElementDette['marqueur'], texte: string, age: number | null, score: number, extra: Partial<ElementDette> = {}): ElementDette => ({
  id: String(i).padStart(12, '0'), depot, fichier, ligne, marqueur, source: marqueur === 'DETTE' ? 'claude' : 'code', texte, age_jours: age, score,
  niveau: score >= 6 ? 'haute' : score >= 3 ? 'moyenne' : 'basse', raisons: [`${marqueur} : +${marqueur === 'TODO' ? 1 : 3}`, ...(age && age >= 90 ? [`${age} jours : +${age >= 365 ? 3 : 2}`] : [])], ignore: false, ...extra,
})
let elements: ElementDette[] = [
  D(1, 'lyra', 'lyra/auth/tokens.py', 88, 'FIXME', 'le jeton n\'expire jamais en mode local', 410, 8),
  D(2, 'neutroncore', 'CLAUDE.md', 98, 'DETTE', 'test_plafond_par_jour_applique echoue dans les dix minutes apres minuit', 54, 4),
  D(3, 'lyra', 'lyra/rag_enhanced/feedback_loop.py', 313, 'TODO', 'ameliorer avec detection de langue', 158, 3),
  D(4, 'hue-mcp', 'hue_mcp/bridge.py', 41, 'HACK', 'reessai a la main tant que le pont ne repond pas', 230, 5),
  D(5, 'neutroncore', 'src/screens/Atelier.tsx', 12, 'TODO', 'decouper en sous-composants', 9, 1),
]

export const qualite: [string, string, MockHandler][] = [
  ['GET', '/tests/sante', () => ({ suites: ['api', 'pytest:unit', 'mcp_node'].map(ligne).sort((a, b) => Number(a.dernier.ok) - Number(b.dernier.ok)), reglages: REGLAGES, total_runs: HISTO.length })],
  ['GET', '/tests/sante/suite', ({ query }) => detail(query.get('suite') ?? 'api')],
  ['GET', '/tests/sante/bench', ({ query }) => {
    const r = de(query.get('suite') ?? 'api')
    const pick = (k: string, c: string) => r.find((x) => x.id === query.get(k)) ?? r.find((x) => x.commit.startsWith(query.get(c) ?? '~')) ?? r[0]
    return bench(pick('a', 'commit_a'), pick('b', 'commit_b'))
  }],
  ['PUT', '/tests/sante/reglages', ({ body }) => ({ success: true, reglages: { ...REGLAGES, ...(body as object) } })],
  ['DELETE', '/tests/sante/suite', () => ({ success: true, retires: 0 })],
  ['GET', '/dette', (): ReleveDette => ({
    elements, depots: [{ depot: 'lyra', nb: 2 }, { depot: 'neutroncore', nb: 2 }, { depot: 'hue-mcp', nb: 1 }], releve_le: new Date().toISOString(),
    resume: { total: elements.filter((e) => !e.ignore).length, ignores: elements.filter((e) => e.ignore).length, par_marqueur: { FIXME: 1, DETTE: 1, TODO: 2, HACK: 1 }, par_niveau: { haute: 1, moyenne: 2, basse: 2 }, par_depot: { lyra: 2, neutroncore: 2, 'hue-mcp': 1 }, plus_ancien_jours: 410, illisibles: 0 },
    reglages: { marqueurs: ['TODO', 'FIXME', 'HACK', 'XXX'], claude_md: true, depots: null, ignores: [], depots_effectifs: ['lyra', 'neutroncore', 'hue-mcp'] },
  })],
  ['POST', '/dette/ignorer', ({ body }) => {
    const { ident, ignorer } = body as { ident: string; ignorer: boolean }
    elements = elements.map((e) => (e.id === ident ? { ...e, ignore: ignorer } : e))
    return { success: true, ignores: elements.filter((e) => e.ignore).map((e) => e.id) }
  }],
  ['PUT', '/dette/reglages', () => ({ success: true })],
]
