// Balayage : note les trois détecteurs d'attaque sur chaque fichier .jsonl d'un dossier (un fichier = un réglage x un extrait).
// DJ_BENCH_DIR=<dossier> DJ_BENCH_OUT=<table.md> npx vitest run scripts/djBench.sweep.test.ts
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { evaluerSuite } from '../src/lib/djBench'
import type { ImageAudio } from '../src/lib/djSignaux'

const DOSSIER = process.env.DJ_BENCH_DIR
describe.skipIf(!DOSSIER || !existsSync(DOSSIER))('balayage des détecteurs', () => {
  it('écrit la table', () => {
    const lignes = ['| fichier | kick | caisse claire | charleston | global |', '|---|---|---|---|---|']
    for (const f of readdirSync(DOSSIER!).filter((x: string) => x.endsWith('.jsonl')).sort()) {
      const images = readFileSync(`${DOSSIER}/${f}`, 'utf8').split('\n').filter(Boolean).map((l: string) => JSON.parse(l)).filter((o: { type: string }) => o.type === 'frame') as ImageAudio[]
      const r = evaluerSuite({ images, fps: 30, reelle: true })
      const n = (id: string) => r.independantes.find((x) => x.id === id)!
      const m = (id: string) => `${n(id).score} (p${n(id).mesures.precision} r${n(id).mesures.rappel})`
      lignes.push(`| ${f} | ${m('kick')} | ${m('snare')} | ${m('hat')} | ${r.globalIndependant} |`)
    }
    if (process.env.DJ_BENCH_OUT) writeFileSync(process.env.DJ_BENCH_OUT, lignes.join('\n'))
    expect(lignes.length).toBeGreaterThan(2)
  }, 600000)
})
