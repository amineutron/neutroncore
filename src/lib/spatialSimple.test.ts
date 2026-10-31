import { describe, expect, it } from 'vitest'
import { COMMUN_DEFAUT, tempsDeVie } from './spatialFx'
import { CLE_MODE, depuisCommun, ecrireMode, ligneEtat, lireMode, patchCurseur, versCommun, type EntreeEtat } from './spatialSimple'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }

describe('versCommun / depuisCommun', () => {
  it('reste dans les bornes de chaque réglage', () => {
    for (const d of [-20, 0, 50, 100, 300]) for (const c of [-5, 0, 100, 500]) {
      const r = versCommun({ douceur: d, duree: d, contraste: c })
      for (const v of [r.attaque, r.retombee, r.vie, r.profondeur]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100) }
      expect(r.plancher).toBeLessThanOrEqual(60)
    }
  })
  it('douceur plus haute = montée et retombée plus lentes', () => {
    const a = versCommun({ douceur: 10, duree: 0, contraste: 50 }), b = versCommun({ douceur: 90, duree: 0, contraste: 50 })
    expect(b.attaque).toBeGreaterThan(a.attaque); expect(b.retombee).toBeGreaterThan(a.retombee)
  })
  it('durée : quatre crans, de un à huit temps', () => {
    expect([0, 33, 67, 100].map((d) => tempsDeVie(versCommun({ douceur: 0, duree: d, contraste: 0 }).vie))).toEqual([1, 2, 4, 8])
  })
  it('contraste plus haut = creux plus profond, plancher plus bas', () => {
    const a = versCommun({ douceur: 0, duree: 0, contraste: 20 }), b = versCommun({ douceur: 0, duree: 0, contraste: 90 })
    expect(b.profondeur).toBeGreaterThan(a.profondeur); expect(b.plancher).toBeLessThan(a.plancher)
  })
  it.each([[0, 0, 0], [30, 33, 60], [100, 100, 100], [64, 67, 15]])('aller-retour %i %i %i', (douceur, duree, contraste) => {
    const r = depuisCommun(versCommun({ douceur, duree, contraste }))
    expect(Math.abs(r.douceur - douceur)).toBeLessThanOrEqual(1); expect(r.duree).toBe(duree); expect(r.contraste).toBe(contraste)
  })
  it('lit les réglages d’origine sans planter', () => { expect(depuisCommun(COMMUN_DEFAUT).contraste).toBe(0) })
})

describe('patchCurseur', () => {
  it('ne touche que ce que le curseur gouverne', () => {
    const { patch, reveil } = patchCurseur({ ...COMMUN_DEFAUT, profondeur: 60 }, 'duree', 67, false)
    expect(Object.keys(patch)).toEqual(['vie']); expect(reveil).toBe(false)
  })
  it('en 3d sans respiration, douceur enclenche un contraste moyen', () => {
    const { patch, reveil } = patchCurseur(COMMUN_DEFAUT, 'douceur', 80, false)
    expect(reveil).toBe(true); expect(patch.profondeur).toBe(70); expect(patch.attaque).toBe(64)
  })
  it('en 2d rien n’est enclenché', () => { expect(patchCurseur(COMMUN_DEFAUT, 'douceur', 80, true).reveil).toBe(false) })
})

describe('mode simple / avancé', () => {
  it('simple par défaut, retenu ensuite', () => {
    const s = mem(); expect(lireMode(s)).toBe('simple'); ecrireMode('avance', s); expect(lireMode(s)).toBe('avance'); expect(s.getItem(CLE_MODE)).toBe('avance')
  })
  it('survit à un stockage qui lève ou absent', () => {
    const casse = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(lireMode(casse)).toBe('simple'); expect(() => ecrireMode('avance', casse)).not.toThrow(); expect(lireMode(null)).toBe('simple')
  })
})

describe('ligneEtat', () => {
  const base: EntreeEtat = { huebeatActif: true, silence: false, bpm: 108.4, canaux: 7, manquants: [], enDirect: false, reelVoulu: false, apercu: false }
  it('dit les quatre choses', () => { expect(ligneEtat(base).phrase).toBe('7 lampes reliées, son entendu, tempo 108, rien ne joue') })
  it('en direct, nomme la scène', () => { expect(ligneEtat({ ...base, enDirect: true, scene: 'neutron' }).phrase).toContain('joue « neutron »') })
  it('avertit : huebeat arrêté, canaux sans place, silence', () => {
    const l = ligneEtat({ ...base, huebeatActif: false, reelVoulu: true, manquants: ['a', 'b'], canaux: 1 })
    expect(l.phrase).toContain('1 lampe reliée'); expect(l.phrase).toContain('son non écouté')
    expect(l.avertissements.map((a) => a.texte)).toEqual(['huebeat est arrêté : les lampes ne reçoivent rien', 'sans place dans le plan : a, b'])
    expect(ligneEtat({ ...base, silence: true }).pastilles[1]).toEqual({ texte: 'silence', ton: 'warn' })
  })
  it('aucune lampe = alerte', () => { expect(ligneEtat({ ...base, canaux: 0 }).pastilles[0].ton).toBe('warn') })
})
