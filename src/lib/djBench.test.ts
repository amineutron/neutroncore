import { describe, expect, it, vi } from 'vitest'
import { evaluerSuite, suiteRythmee, type Suite } from './djBench'
import { lireReglages } from './djReglages'
import { BPM_SIMU, Simulateur } from './djSimu'
import type { ImageAudio } from './djSignaux'

/** Morceau simulé, éventuellement joué plus bas (décalage du volume en LU) pour voir si les détecteurs dépendent du niveau d'écoute. */
function simule(secondes: number, decalageLu = 0): Suite {
  const simu = new Simulateur(1), images: ImageAudio[] = []
  for (let i = 0; i < secondes * 30; i++) {
    const im = simu.suivant(1 / 30)
    images.push(decalageLu ? { ...im, lufs: { m: im.lufs.m + decalageLu, s: im.lufs.s + decalageLu } } : im)
  }
  // le morceau simulé dure 64 pulsations (30,97 s) et son drop tombe à la pulsation 32
  const boucle = (64 * 60) / BPM_SIMU, drops = Array.from({ length: Math.ceil(secondes / boucle) }, (_, k) => (32 * 60) / BPM_SIMU + k * boucle).filter((t) => t < secondes)
  return { images, fps: 30, reelle: false, verite: { drops, bpm: BPM_SIMU } }
}
const note = (r: ReturnType<typeof evaluerSuite>, id: string): number => [...r.independantes, ...r.collectives].find((n) => n.id === id)!.score

// La capture réelle se rejoue avec scripts/djBench.live.test.ts.
// Ces tests rejouent plusieurs morceaux complets : ils frôlent les 5 s par défaut sur une machine de CI lente.
vi.setConfig({ testTimeout: 60_000 })

describe('banc d essai : morceau simulé (garde-fou de non-régression)', () => {
  it('note chaque fonction sur le morceau simulé joué normalement', () => {
    const r = evaluerSuite(simule(128))
    expect(note(r, 'kick')).toBeGreaterThanOrEqual(60)
    expect(note(r, 'tempo')).toBeGreaterThanOrEqual(70)
    expect(note(r, 'cle')).toBeGreaterThanOrEqual(50)
    expect(note(r, 'drop')).toBeGreaterThanOrEqual(50)
    expect(note(r, 'stabilite')).toBeGreaterThanOrEqual(70)
    expect(r.globalCollectif).toBeGreaterThanOrEqual(60)
  })

  it('note le cycle et le retard sur des rythmes connus, réguliers puis irréguliers', () => {
    for (const [bpm, m, opts] of [[128, 4, {}], [105, 3, {}], [140, 4, { oubli: 0.7, oubliUn: 0.3 }]] as const) {
      const r = evaluerSuite(suiteRythmee(bpm, m, 40, opts))
      expect(note(r, 'cycle')).toBeGreaterThanOrEqual(80)
      expect(note(r, 'tempo')).toBeGreaterThanOrEqual(90)
      expect(note(r, 'latence')).toBeGreaterThanOrEqual(70)
    }
  })
  it('sans le cycle, la note de cycle n existe pas et le tempo reste noté', () => {
    const s = suiteRythmee(128, 4, 40)
    const r = evaluerSuite({ ...s, reglages: lireReglages({ cycle: { actif: false } }) })
    expect(r.independantes.some((n) => n.id === 'cycle')).toBe(false)
    expect(note(r, 'tempo')).toBeGreaterThanOrEqual(90)
  })
  it('l onde d origine fait un retard bien plus grand que l onde rapide', () => {
    const s = suiteRythmee(128, 4, 40)
    const origine = evaluerSuite({ ...s, reglages: lireReglages({ onde: { actif: false }, avance: { actif: false } }) })
    const rapide = evaluerSuite({ ...s, reglages: lireReglages({ onde: { actif: true, vitesse: 8 }, avance: { actif: false } }) })
    const retard = (r: typeof origine) => r.collectives.find((n) => n.id === 'synchro')!.mesures.latence_lumiere_ms as number
    expect(retard(rapide)).toBeLessThan(retard(origine) / 2)
  })
  it('le drop et le volume ne dépendent pas du niveau d écoute (15 LU plus bas)', () => {
    const fort = evaluerSuite(simule(128)), bas = evaluerSuite(simule(128, -15))
    expect(note(bas, 'drop')).toBeGreaterThanOrEqual(note(fort, 'drop') - 15)
    expect(note(bas, 'volume')).toBeGreaterThanOrEqual(note(fort, 'volume') - 15)
    expect(bas.globalCollectif).toBeGreaterThanOrEqual(fort.globalCollectif - 15)
  })
})
