import { describe, expect, it } from 'vitest'
import { absents, basculer, bilanVolumes, cartesDe, etatTon, niveauRetenu, nomsAppareils, phraseScene, pilotable, reglables, sceneAvec, volumesHabituels, type Appareil, type Zone } from './zonesAudio'

const liste: Appareil[] = [
  { id: 'denon', type: 'denon', nom: 'ampli denon', hote: '', etat: 'allume', detail: '', volume: 30, pilotable: true },
  { id: 'cast:1.2.3.4', type: 'chromecast', nom: 'cuisine', hote: '1.2.3.4', etat: 'en_ligne', detail: '', volume: null, pilotable: true },
]

const salon: Zone = { id: 'salon', nom: 'salon', appareil: '', groupe: false, volume_max: 40, volume: 20 }
const chambre: Zone = { id: 'chambre', nom: 'chambre', appareil: 'Groupe Chambre', groupe: true, volume_max: 25, volume: 10 }

describe('zones audio', () => {
  it('le volume retenu respecte la zone et le plafond (comme plan_volumes)', () => {
    expect([10, 40, 41, 100, 0, -5, 12.6].map((v) => niveauRetenu(salon, v, 60))).toEqual([10, 40, 40, 40, 0, 0, 13])
    expect(niveauRetenu({ ...salon, volume_max: 60 }, 99, 50)).toBe(50)
  })

  it('pilotable selon l’appareil et le réglage', () => {
    expect(pilotable(salon, false)).toBe(true)
    expect(pilotable(chambre, false)).toBe(false)
    expect(pilotable(chambre, true)).toBe(true)
  })

  it('bilan en une phrase', () => {
    const noms = { salon: 'salon', chambre: 'chambre' }
    expect(bilanVolumes({ success: false, resultats: [{ zone: 'salon', success: true, niveau: 40, plafonne: true, error: null }], refus: [{ zone: 'chambre', raison: 'pas pilotable' }] }, noms))
      .toBe('volume réglé : salon 40 (plafonné) · chambre : pas pilotable')
    expect(bilanVolumes({ success: false, resultats: [{ zone: 'salon', success: false, niveau: 5, plafonne: false, error: 'timeout' }], refus: [] }, noms)).toBe('salon : timeout')
  })

  it('volumes habituels', () => {
    expect(volumesHabituels([salon, chambre])).toEqual({ salon: 20, chambre: 10 })
  })

  it('cartes cochées : bascule, noms, absents, réglables', () => {
    expect(cartesDe(salon)).toEqual([])
    expect(basculer(['denon'], 'tv')).toEqual(['denon', 'tv'])
    expect(basculer(['denon', 'tv'], 'denon')).toEqual(['tv'])
    expect(nomsAppareils(['denon', 'x'], liste)).toEqual(['ampli denon', 'appareil absent'])
    expect(absents(['denon', 'pc:z'], liste)).toEqual(['pc:z'])
    expect(reglables(['denon', 'cast:1.2.3.4', 'tv'], liste, false)).toEqual(['denon'])
    expect(reglables(['denon', 'cast:1.2.3.4', 'tv'], liste, true)).toEqual(['denon', 'cast:1.2.3.4'])
  })

  it('phrase de scène et ajout d’une zone', () => {
    expect(phraseScene('ambiance soirée', { salon: 35, cuisine: 20 }, { salon: 'salon', cuisine: 'cuisine' })).toBe('ambiance soirée : salon 35 %, cuisine 20 %')
    expect(phraseScene('vide', {}, {})).toBe('vide : aucune zone choisie')
    expect(sceneAvec({ chambre: 5 }, salon, true)).toEqual({ chambre: 5, salon: 20 })
    expect(sceneAvec({ chambre: 5, salon: 9 }, salon, false)).toEqual({ chambre: 5 })
    expect(sceneAvec({}, { ...salon, volume: 50, volume_max: 40 }, true)).toEqual({ salon: 40 })
  })

  it('ton de l’état', () => {
    expect([etatTon('allume'), etatTon('absent'), etatTon('veille'), etatTon('?')]).toEqual(['ok', 'crit', undefined, 'warn'])
  })
})
