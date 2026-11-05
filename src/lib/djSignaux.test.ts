import { describe, expect, it } from 'vitest'
import {
  SIGNAUX, SIGNAUX_INFO, SIGNAUX_NULS, avancerSignaux, chaleurDepuisCentroide, largeurDepuisCorr, suivre, volumeDepuisLufs,
  type Analyse, type ImageAudio,
} from './djSignaux'

const image = (p: Partial<ImageAudio> = {}): ImageAudio => ({
  t: 0, spec: [], wave: [], pts: [], lufs: { m: -14, s: -14 }, bandes: { sub: 0, basses: 0, mediums: 0, aigus: 0 },
  kick: { on: false, v: 0 }, snare: { on: false, v: 0 }, hat: { on: false, v: 0 }, chroma: new Array(12).fill(0),
  centroide: 1000, corr: 1, pan: 0, silence: false, ...p,
})
const ANALYSE: Analyse = { mineur: null, tonique: null, confianceCle: 0, bpm: null, montee: 0, drop: false }

describe('conversions', () => {
  it('le volume perçu tient entre -40 et -6 LUFS', () => {
    expect(volumeDepuisLufs(-70)).toBe(0)
    expect(volumeDepuisLufs(-40)).toBe(0)
    expect(volumeDepuisLufs(-6)).toBe(1)
    expect(volumeDepuisLufs(0)).toBe(1)
    expect(volumeDepuisLufs(-23)).toBeCloseTo(0.5)
  })
  it('un son sombre est chaud, un son brillant est froid', () => {
    expect(chaleurDepuisCentroide(250)).toBe(1)
    expect(chaleurDepuisCentroide(4000)).toBe(0)
    expect(chaleurDepuisCentroide(1000)).toBeCloseTo(0.5)
    expect(chaleurDepuisCentroide(0)).toBe(0.5)
    expect(chaleurDepuisCentroide(NaN)).toBe(0.5)
  })
  it('la largeur vaut 0 en mono', () => {
    expect(largeurDepuisCorr(1)).toBe(0)
    expect(largeurDepuisCorr(0)).toBe(1)
    expect(largeurDepuisCorr(-0.5)).toBe(1)
  })
})

describe('suivre', () => {
  it('monte vite et descend lentement', () => {
    expect(suivre(0, 1, 0.1, 0.05, 1)).toBeGreaterThan(0.8)
    expect(suivre(1, 0, 0.1, 0.05, 1)).toBeGreaterThan(0.85)
  })
  it('sans constante de temps, suit d’un coup', () => {
    expect(suivre(0.2, 0.9, 0.03, 0, 0)).toBe(0.9)
  })
})

describe('signaux', () => {
  it('chaque signal a son libellé et sa légende', () => {
    for (const s of SIGNAUX) {
      expect(SIGNAUX_INFO[s].label.length).toBeGreaterThan(2)
      expect(SIGNAUX_INFO[s].quoi.length).toBeGreaterThan(15)
      expect(typeof SIGNAUX_NULS[s]).toBe('number')
    }
  })
  it('une grosse caisse fait un pic qui retombe', () => {
    let s = avancerSignaux(SIGNAUX_NULS, image({ kick: { on: true, v: 0.9 } }), 0.03, ANALYSE)
    expect(s.kick).toBeCloseTo(0.9)
    const apres = Array.from({ length: 10 }, () => (s = avancerSignaux(s, image(), 0.03, ANALYSE)).kick)
    expect(apres[0]).toBeLessThan(0.9)
    expect(apres[9]).toBeLessThan(0.25)
    expect(apres.every((v, i) => i === 0 || v <= apres[i - 1])).toBe(true)
  })
  it('le silence éteint tout', () => {
    let s = SIGNAUX_NULS
    for (let i = 0; i < 20; i++) s = avancerSignaux(s, image({ bandes: { sub: 1, basses: 1, mediums: 1, aigus: 1 }, lufs: { m: -8, s: -8 } }), 0.03, ANALYSE)
    expect(s.basses).toBeGreaterThan(0.9)
    for (let i = 0; i < 80; i++) s = avancerSignaux(s, image({ silence: true, bandes: { sub: 1, basses: 1, mediums: 1, aigus: 1 }, lufs: { m: -8, s: -8 } }), 0.03, ANALYSE)
    expect(s.basses).toBeLessThan(0.05)
    expect(s.volume).toBeLessThan(0.05)
  })
  it('le mode glisse vers majeur ou mineur, et reste au milieu tant qu’il est inconnu', () => {
    expect(avancerSignaux(SIGNAUX_NULS, image(), 0.03, ANALYSE).mode).toBe(0.5)
    let s = SIGNAUX_NULS
    for (let i = 0; i < 100; i++) s = avancerSignaux(s, image(), 0.03, { ...ANALYSE, mineur: false, tonique: 0 })
    expect(s.mode).toBeGreaterThan(0.9)
    for (let i = 0; i < 100; i++) s = avancerSignaux(s, image(), 0.03, { ...ANALYSE, mineur: true, tonique: 9 })
    expect(s.mode).toBeLessThan(0.1)
    expect(s.tonalite).toBeCloseTo(0.75)
  })
  it('le tempo et la position sont ramenés entre 0 et 1', () => {
    const s = avancerSignaux(SIGNAUX_NULS, image({ pan: 1 }), 1, { ...ANALYSE, bpm: 120 })
    expect(s.tempo).toBeCloseTo(0.5)
    expect(s.pan).toBeGreaterThan(0.8)
  })
  it('tolère des valeurs absurdes sans produire de NaN', () => {
    const s = avancerSignaux(SIGNAUX_NULS, image({ bandes: { sub: NaN, basses: Infinity, mediums: -5, aigus: 9 }, lufs: { m: NaN, s: NaN }, centroide: NaN, corr: NaN, pan: NaN }), 0.03, ANALYSE)
    for (const s2 of SIGNAUX) expect(Number.isFinite(s[s2])).toBe(true)
  })
})
