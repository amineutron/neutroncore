// Résultats totaux : le même banc sur plusieurs sons, tout éteint (cycle, onde rapide, avance) puis avec les réglages de départ.
// DJ_BENCH_OUT=<table.md> [DJ_BENCH_FILES=a.jsonl,b.jsonl] npx vitest run scripts/djBench.totaux.test.ts
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { evaluerSuite, suiteRythmee, type Suite } from '../src/lib/djBench'
import { lireReglages, REGLAGES_DEFAUT } from '../src/lib/djReglages'
import { BPM_SIMU, Simulateur } from '../src/lib/djSimu'
import type { ImageAudio } from '../src/lib/djSignaux'

const ETEINT = lireReglages({ cycle: { actif: false }, onde: { actif: false }, avance: { actif: false } })

function simule(secondes: number): Suite {
  const simu = new Simulateur(1), images: ImageAudio[] = []
  for (let i = 0; i < secondes * 30; i++) images.push(simu.suivant(1 / 30))
  const boucle = (64 * 60) / BPM_SIMU, drops = Array.from({ length: Math.ceil(secondes / boucle) }, (_, k) => (32 * 60) / BPM_SIMU + k * boucle).filter((t) => t < secondes)
  return { images, fps: 30, reelle: false, verite: { drops, bpm: BPM_SIMU } }
}

describe.skipIf(!process.env.DJ_BENCH_OUT)('résultats totaux', () => {
  it('écrit la table', () => {
    const suites: [string, Suite][] = []
    for (const f of (process.env.DJ_BENCH_FILES ?? '').split(',').filter((x) => x && existsSync(x))) {
      const images = readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l: string) => JSON.parse(l)).filter((o: { type: string }) => o.type === 'frame') as ImageAudio[]
      suites.push([`musique reelle ${f.split('/').pop()}`, { images, fps: 30, reelle: true }])
    }
    suites.push(['morceau simule 124/4', simule(128)], ['rythme 128/4 regulier', suiteRythmee(128, 4, 40)], ['rythme 105/3 regulier', suiteRythmee(105, 3, 40)],
      ['rythme 140/4 irregulier', suiteRythmee(140, 4, 40, { oubli: 0.7, oubliUn: 0.3 })], ['rythme 92/4 irregulier', suiteRythmee(92, 4, 40, { oubli: 0.7, oubliUn: 0.3 })])
    const lignes = ['| son | reglages | fonctions seules | ensemble | tempo | cycle | retard lumiere (images / total estime) | synchro | lumiere qui vit |', '|---|---|---|---|---|---|---|---|---|']
    const somme: Record<string, { i: number; c: number; n: number }> = {}
    for (const [nom, s] of suites) for (const [cfg, reglages] of [['tout eteint', ETEINT], ['depart', REGLAGES_DEFAUT]] as const) {
      const r = evaluerSuite({ ...s, reglages })
      const note = (id: string) => [...r.independantes, ...r.collectives].find((n) => n.id === id)
      const lat = note('latence')!.mesures
      lignes.push(`| ${nom} | ${cfg} | ${r.globalIndependant} | ${r.globalCollectif} | ${note('tempo')!.score} | ${note('cycle')?.score ?? '-'} | ${lat.latence_sur_les_images_ms} ms / ${lat.total_estime_ms} ms | ${note('synchro')!.score} | ${note('dynamique')!.score} |`)
      const t = (somme[cfg] ??= { i: 0, c: 0, n: 0 })
      t.i += r.globalIndependant; t.c += r.globalCollectif; t.n++
    }
    const resume = Object.entries(somme).map(([k, t]) => `- ${k} : fonctions seules ${Math.round(t.i / t.n)}, ensemble ${Math.round(t.c / t.n)} (moyenne sur ${t.n} sons)`)
    writeFileSync(process.env.DJ_BENCH_OUT!, [...resume, '', ...lignes].join('\n'))
    expect(lignes.length).toBeGreaterThan(4)
  }, 600000)
})
