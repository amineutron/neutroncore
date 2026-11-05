import { describe, expect, it } from 'vitest'
import { DjMoteur, tauDeLissage } from './djMoteur'
import { BPM_SIMU, Simulateur } from './djSimu'
import { nouvelleCouche, type Profil } from './djCouches'
import { COMMUN_DEFAUT, type Dims, type Scene } from './spatialFx'

const DIMS: Dims = { w: 400, h: 300, d: 250 }
const SCENE: Scene = { id: 'sc000001', nom: 'kick', effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 30, z: 35 }, intensite: 100 }
const TEMPETE: Scene = { id: 'sc000002', nom: 'tempête', effets: ['onde', 'phare'], palette: 'fire', axe: 'x', source: { x: 20, y: 60, z: 70 }, intensite: 100 }
const PROFIL_VIDE: Profil = { id: 'profil01', nom: 'test', couches: [nouvelleCouche('couleurs', { id: 'couleurs0' }), nouvelleCouche('scene', { id: 'scene000' })] }
const ctx = (profil: Profil = PROFIL_VIDE) => ({ profil, scene: SCENE, scenes: [SCENE, TEMPETE], commun: COMMUN_DEFAUT, dims: DIMS })

/** Fait jouer le morceau simulé pendant `s` secondes (30 images par seconde) et rend ce qui s'est passé. */
function jouer(moteur: DjMoteur, simu: Simulateur, s: number, profil?: Profil, depart = 0) {
  const evenements: { t: number; drop: boolean; kick: boolean }[] = []
  let maintenant = depart
  for (let i = 0; i < s * 30; i++) {
    maintenant += 1000 / 30
    const img = simu.suivant(1 / 30)
    const r = moteur.pousser(img, maintenant)
    evenements.push({ t: img.t, ...r })
    if (profil) moteur.lumiere(maintenant, ctx(profil))
  }
  return { evenements, maintenant }
}

describe('morceau simulé', () => {
  it('produit des images complètes et valides', () => {
    const simu = new Simulateur(1)
    for (let i = 0; i < 600; i++) {
      const img = simu.suivant(1 / 30)
      expect(img.spec).toHaveLength(96)
      expect(img.wave).toHaveLength(128)
      expect(img.pts).toHaveLength(48)
      expect(img.chroma).toHaveLength(12)
      expect(img.spec.every((v) => v >= 0 && v <= 255)).toBe(true)
      expect(Number.isFinite(img.lufs.m) && Number.isFinite(img.centroide) && Number.isFinite(img.corr)).toBe(true)
    }
  })
  it('est reproductible avec la même graine', () => {
    const a = new Simulateur(7), b = new Simulateur(7)
    for (let i = 0; i < 50; i++) expect(a.suivant(1 / 30)).toEqual(b.suivant(1 / 30))
  })
  it('marque la grosse caisse sur chaque temps de la montée (un coup toutes les 0,48 s)', () => {
    const simu = new Simulateur(1, (16 * 60) / BPM_SIMU)            // début de la montée
    let coups = 0
    for (let i = 0; i < 30 * 4; i++) if (simu.suivant(1 / 30).kick.on) coups++
    expect(coups).toBeGreaterThanOrEqual(8)
    expect(coups).toBeLessThanOrEqual(9)
  })
})

describe('moteur', () => {
  it('retrouve le tempo, la tonalité et le drop du morceau simulé', () => {
    const moteur = new DjMoteur(), simu = new Simulateur(1)
    const { evenements, maintenant } = jouer(moteur, simu, 22)     // jusqu avant le break : la mineur
    const l = moteur.lecture(maintenant)
    expect(l.bpmSur).toBe(true)
    expect(l.bpm).toBeGreaterThan(BPM_SIMU - 3)
    expect(l.bpm).toBeLessThan(BPM_SIMU + 3)
    expect(l.cle).toEqual({ tonique: 9, mineur: true })
    const drops = evenements.filter((e) => e.drop)
    expect(drops).toHaveLength(1)
    expect(drops[0].t).toBeGreaterThan((32 * 60) / BPM_SIMU - 0.2)       // vu au moment du coup, jamais avant
    expect(drops[0].t).toBeLessThan((32 * 60) / BPM_SIMU + 1.2)
  })
  it('le signal de grosse caisse pique sur le coup et retombe', () => {
    const moteur = new DjMoteur(), simu = new Simulateur(1, (16 * 60) / BPM_SIMU)
    let maxi = 0, mini = 1
    for (let i = 0; i < 60; i++) { moteur.pousser(simu.suivant(1 / 30), i * 33); const k = moteur.lecture(i * 33).signaux.kick; maxi = Math.max(maxi, k); if (i > 10) mini = Math.min(mini, k) }
    expect(maxi).toBeGreaterThan(0.8)
    expect(mini).toBeLessThan(0.4)
  })
  it('le tempo imposé à la main prime sur la détection', () => {
    const moteur = new DjMoteur()
    moteur.reglerTempo(90)
    jouer(moteur, new Simulateur(1), 8)
    expect(moteur.lecture(0).bpm).toBe(90)
    moteur.reglerTempo(null)
    jouer(moteur, new Simulateur(1), 8)
    expect(moteur.lecture(0).bpm).toBeGreaterThan(100)
  })
  it('remet tout à zéro sans perdre le tempo imposé', () => {
    const moteur = new DjMoteur()
    moteur.reglerTempo(100)
    jouer(moteur, new Simulateur(1), 8)
    moteur.reinitialiser()
    const l = moteur.lecture(0)
    expect(l.cle).toBeNull()
    expect(l.signaux.kick).toBe(0)
    expect(l.bpm).toBe(100)
  })
})

describe('lumière', () => {
  it('une rangée suit son signal, lissé selon son réglage', () => {
    const rapide = nouvelleCouche('modulation', { id: 'rapide', signal: 'kick', cible: 'profondeur', min: 0, max: 100, lissage: 0 })
    const lente = nouvelleCouche('modulation', { id: 'lente0', signal: 'kick', cible: 'plancher', min: 0, max: 100, lissage: 100 })
    const profil: Profil = { ...PROFIL_VIDE, couches: [rapide, lente, ...PROFIL_VIDE.couches] }
    const moteur = new DjMoteur(), simu = new Simulateur(1, (16 * 60) / BPM_SIMU)
    let nRapide = 0, nLente = 0, maxRapide = 0, maxLente = 0
    let now = 0
    for (let i = 0; i < 90; i++) {
      now += 33
      moteur.pousser(simu.suivant(1 / 30), now)
      const l = moteur.lumiere(now, ctx(profil))
      maxRapide = Math.max(maxRapide, l.valeurs.rapide); maxLente = Math.max(maxLente, l.valeurs.lente0)
      nRapide += l.valeurs.rapide; nLente += l.valeurs.lente0
    }
    expect(maxRapide).toBeGreaterThan(0.8)
    expect(maxLente).toBeLessThan(maxRapide)
    expect(Math.abs(nLente / 90 - nRapide / 90)).toBeLessThan(0.3)
    expect(tauDeLissage(0)).toBe(0)
    expect(tauDeLissage(100)).toBe(1.5)
  })
  it('le drop lance la scène du déclencheur pour le nombre de mesures voulu, puis la rend', () => {
    const decl = nouvelleCouche('declencheur', { id: 'decl000', signal: 'drop', scene: TEMPETE.id, mesures: 1, seuil: 30, lissage: 0 })
    const profil: Profil = { ...PROFIL_VIDE, couches: [decl, ...PROFIL_VIDE.couches] }
    const moteur = new DjMoteur(), simu = new Simulateur(1)
    let now = 0, avant = 0, pendant = 0, apres = 0
    for (let i = 0; i < 30 * 40; i++) {
      now += 1000 / 30
      const img = simu.suivant(1 / 30)
      moteur.pousser(img, now)
      const l = moteur.lumiere(now, ctx(profil))
      const joue = l.declenches.decl000 === TEMPETE.id
      if (img.t < 15.4) avant += joue ? 1 : 0                // le drop tombe à 15,48 s : rien avant
      else if (joue) pendant++
      else if (img.t > 20) apres++
    }
    expect(avant).toBe(0)
    expect(pendant).toBeGreaterThan(30 * 1.5)            // une mesure = 4 temps ~ 1,9 s
    expect(pendant).toBeLessThan(30 * 2.6)
    expect(apres).toBeGreaterThan(0)
  })
  it('la vitesse des effets change sans faire sauter le temps', () => {
    const vite = nouvelleCouche('modulation', { id: 'vite000', signal: 'montee', cible: 'tempo', min: 100, max: 200, lissage: 0 })
    const profil: Profil = { ...PROFIL_VIDE, couches: [vite, ...PROFIL_VIDE.couches] }
    const moteur = new DjMoteur(), simu = new Simulateur(1)
    let now = 0, precedent = 0, saut = 0
    for (let i = 0; i < 30 * 30; i++) {
      now += 1000 / 30
      moteur.pousser(simu.suivant(1 / 30), now)
      const l = moteur.lumiere(now, ctx(profil))
      saut = Math.max(saut, Math.abs(l.beat - precedent))
      precedent = l.beat
    }
    expect(saut).toBeLessThan(0.5)                        // jamais plus d'une demi-pulsation d'une image à l'autre
    expect(precedent).toBeGreaterThan(30 * (BPM_SIMU / 60) * 0.95)
  })
})

describe('tempo : le premier calage ne reste pas collé au 120 de départ', () => {
  /** Une grosse caisse sur chaque temps à `bpm`, sans autre musique. */
  function kicks(bpm: number, secondes: number): DjMoteur {
    const moteur = new DjMoteur(), base = new Simulateur(1).suivant(1 / 30), periode = 60 / bpm
    let prochain = 0
    for (let i = 0; i < secondes * 30; i++) {
      const t = i / 30
      const on = t >= prochain
      if (on) prochain += periode
      moteur.pousser({ ...base, t, kick: { on, v: on ? 1 : 0 } }, t * 1000)
    }
    return moteur
  }
  it.each([75, 90, 100, 140, 150, 172])('trouve %i par minute', (bpm) => {
    const l = kicks(bpm, 25).lecture(25000)
    expect(l.bpmSur).toBe(true)
    expect(Math.abs(l.bpm - bpm) / bpm).toBeLessThan(0.04)
  })
  it('suit un changement de morceau (100 puis 150 par minute)', () => {
    const moteur = new DjMoteur(), base = new Simulateur(1).suivant(1 / 30)
    let prochain = 0, t = 0
    for (const [bpm, secondes] of [[100, 25], [150, 25]] as const) {
      const fin = t + secondes
      for (; t < fin; t += 1 / 30) {
        const on = t >= prochain
        if (on) prochain += 60 / bpm
        moteur.pousser({ ...base, t, kick: { on, v: on ? 1 : 0 } }, t * 1000)
      }
      prochain = Math.max(prochain, t)
    }
    expect(Math.abs(moteur.lecture(t * 1000).bpm - 150) / 150).toBeLessThan(0.04)
  })
})
