import { describe, expect, it } from 'vitest'
import { avantLibelle, basculerMoyen, categoriesBanque, filtrerBanque, rappelVide, resultatsTexte, resume, versApi, type Sonnerie } from './rappels'

describe('rappels', () => {
  it('libellé du délai', () => {
    expect(avantLibelle(0)).toBe('à l’heure')
    expect(avantLibelle(15)).toBe('15 min avant')
    expect(avantLibelle(120)).toBe('2 h avant')
    expect(avantLibelle(1440)).toBe('1 jour avant')
  })

  it('cocher la télé fait sonner sur la télé, la décocher revient au défaut', () => {
    let r = { ...rappelVide(), sortie: 'defaut' }
    r = basculerMoyen(r, 'sonnerie', true)
    r = basculerMoyen(r, 'tele', true)
    expect(r.moyens).toEqual(['tele', 'sonnerie'])
    expect(r.sortie).toBe('tele')
    r = basculerMoyen(r, 'tele', false)
    expect(r.sortie).toBe('defaut')
    const casque = basculerMoyen({ ...r, sortie: 'alsa_output.casque' }, 'tele', true)
    expect(casque.sortie).toBe('alsa_output.casque')         // une sortie choisie à la main n'est pas écrasée
  })

  it('aucun moyen = pas de rappel envoyé', () => {
    expect(versApi(rappelVide())).toBeNull()
    expect(versApi(null)).toBeNull()
    expect(versApi(basculerMoyen(rappelVide(), 'app', true))?.moyens).toEqual(['app'])
  })

  it('résumés', () => {
    expect(resume(null)).toBe('')
    expect(resume({ ...rappelVide(), minutes_avant: 10, moyens: ['tele', 'sonnerie'] })).toBe('10 min avant · télé + sonnerie')
    expect(resultatsTexte({ tele: 'ok', sonnerie: 'sonnerie introuvable' })).toBe('télé : ok · sonnerie : sonnerie introuvable')
    expect(resultatsTexte({ volume: 'ampli éteint' })).toBe('volume : ampli éteint')
  })

  it('banque : catégories rangées, « mes sons » toujours proposé', () => {
    const b: Sonnerie[] = [
      { id: 'x', nom: 'x', categorie: 'énergiques', origine: 'neutroncore' },
      { id: 'a', nom: 'a', categorie: 'douces', origine: 'neutroncore' },
      { id: 'z', nom: 'z', categorie: 'bizarre', origine: 'neutroncore' },
    ]
    expect(categoriesBanque(b)).toEqual(['douces', 'énergiques', 'bizarre', 'mes sons'])
    expect(filtrerBanque(b, 'douces').map((s) => s.id)).toEqual(['a'])
    expect(filtrerBanque(b, 'toutes')).toHaveLength(3)
    expect(filtrerBanque(b, 'mes sons')).toEqual([])
  })
})
