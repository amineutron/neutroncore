import { describe, expect, it } from 'vitest'
import { courbeGamma, courbeLineaire, evaluer } from './rampes'
import { changerDuree, heureDeFin, identifiant, instantTele, monteeReguliere, reveilDepuisModele, versRampe, type Reveil } from './reveil'

const reveil = (over: Partial<Reveil> = {}): Reveil => ({
  id: 'matin', nom: 'matin', enabled: true, duree_min: 30, lampes: ['3', '4'], plafond_bri: 254,
  courbe: { bri: courbeGamma(1800, 1, 254), kelvin: courbeLineaire(1800, 2200, 5000) },
  tele: { actif: true, ecran: 'tele', source: 'hdmi1', moment: 'fin', avant_fin_min: 5 }, ...over,
})

describe('réveil', () => {
  it('la rampe monte sans jamais redescendre et atteint le plafond', () => {
    const r = versRampe(reveil({ plafond_bri: 120 }))
    const bris = Array.from({ length: 31 }, (_, i) => evaluer(r, i * 60)['3'].bri as number)
    expect(bris[0]).toBe(1)
    expect(bris[30]).toBe(120)
    expect(bris.every((b, i) => i === 0 || b >= bris[i - 1])).toBe(true)
    expect(Math.max(...bris)).toBeLessThanOrEqual(120)
  })

  it('la température passe du chaud au clair', () => {
    const r = versRampe(reveil())
    expect(evaluer(r, 0)['3'].kelvin).toBe(2200)
    expect(evaluer(r, 1800)['3'].kelvin).toBe(5000)
  })

  it('changer la durée garde la forme', () => {
    const r = changerDuree(reveil(), 60)
    expect(r.duree_min).toBe(60)
    expect(r.courbe.bri[r.courbe.bri.length - 1].t).toBe(3600)
    expect(r.courbe.kelvin[0].t).toBe(0)
    expect(changerDuree(reveil(), 5).tele.avant_fin_min).toBe(5)
    expect(changerDuree(reveil(), 5).duree_min).toBe(5)
    expect(changerDuree(reveil({ tele: { actif: true, ecran: 'tele', source: 'hdmi1', moment: 'fin', avant_fin_min: 20 } }), 10).tele.avant_fin_min).toBe(10)
  })

  it('montée régulière : plafond respecté', () => {
    const r = monteeReguliere(reveil({ plafond_bri: 100 }))
    expect(r.courbe.bri[r.courbe.bri.length - 1].v).toBe(100)
  })

  it('instant de la télé', () => {
    expect(instantTele(reveil())).toBe(1500)
    expect(instantTele(reveil({ tele: { ...reveil().tele, moment: 'debut' } }))).toBe(0)
    expect(instantTele(reveil({ tele: { ...reveil().tele, actif: false } }))).toBeNull()
  })

  it('identifiants sûrs et uniques', () => {
    expect(identifiant('Réveil du matin !', [])).toBe('reveil-du-matin')
    expect(identifiant('matin', ['matin', 'matin-2'])).toBe('matin-3')
    expect(identifiant('???', [])).toBe('reveil')
  })

  it('heure d’arrivée', () => {
    expect(heureDeFin('06:30', 30)).toBe('07:00')
    expect(heureDeFin('23:50', 30)).toBe('00:20')
  })
})

describe('réveil depuis le modèle de l’API', () => {
  const tiennentDans = (r: Reveil) => [...r.courbe.bri, ...r.courbe.kelvin].every((p) => p.t >= 0 && p.t <= r.duree_min * 60)

  it('un gabarit plus court que le modèle (30 min) a ses deux courbes dans sa durée', () => {
    // bug : seul duree_min changeait, les courbes restaient à 1800 s et l'API refusait « un point sort de la durée »
    const r = reveilDepuisModele(reveil(), 'semaine', 'semaine', 20)
    expect(r.duree_min).toBe(20)
    expect(tiennentDans(r)).toBe(true)
    expect(r.courbe.bri[r.courbe.bri.length - 1].t).toBe(1200)
    expect(r.courbe.kelvin[r.courbe.kelvin.length - 1].t).toBe(1200)
  })

  it('un gabarit plus long reste cohérent aussi', () => {
    const r = reveilDepuisModele(reveil(), 'week-end', 'week-end tranquille', 40)
    expect(tiennentDans(r)).toBe(true)
    expect(r.courbe.kelvin[r.courbe.kelvin.length - 1].t).toBe(2400)
  })

  it('la durée du modèle laisse les courbes telles quelles ; identité et nom sont posés', () => {
    const m = reveil()
    const r = reveilDepuisModele(m, 'nouveau', 'nouveau réveil', 30)
    expect(r.courbe).toEqual(m.courbe)
    expect([r.id, r.nom]).toEqual(['nouveau', 'nouveau réveil'])
  })
})
