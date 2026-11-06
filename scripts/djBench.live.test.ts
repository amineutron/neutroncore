// Banc d'essai DJ Light sur une capture réelle (hors typecheck de l'app : lit un fichier).
// DJ_BENCH_FILE=<images.jsonl> DJ_BENCH_OUT=<rapport.md> [DJ_BENCH_REGLAGES='{"cycle":{"actif":false}}'] npx vitest run scripts/djBench.live.test.ts
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { evaluerSuite, rapportEnTexte } from '../src/lib/djBench'
import { lireReglages } from '../src/lib/djReglages'
import type { ImageAudio } from '../src/lib/djSignaux'

const FICHIER = process.env.DJ_BENCH_FILE
describe.skipIf(!FICHIER || !existsSync(FICHIER))('banc d essai : capture réelle', () => {
  it('écrit le rapport', () => {
    const images = readFileSync(FICHIER!, 'utf8').split('\n').filter(Boolean).map((l: string) => JSON.parse(l)).filter((o: { type: string }) => o.type === 'frame') as ImageAudio[]
    const reglages = lireReglages(process.env.DJ_BENCH_REGLAGES ? JSON.parse(process.env.DJ_BENCH_REGLAGES) : {})
    const r = evaluerSuite({ images, fps: 30, reelle: true, reglages })
    if (process.env.DJ_BENCH_OUT) writeFileSync(process.env.DJ_BENCH_OUT, rapportEnTexte(r, `capture reelle ${FICHIER} reglages ${JSON.stringify(reglages)}`))
    expect(r.independantes.length).toBeGreaterThan(5)
  })
})
