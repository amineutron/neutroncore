import { describe, expect, it } from 'vitest'
import {
  comptes, dureeLisible, enregistrementEnCours, filtrer, nomLisible, patchDeScene, raisonBloquee, remplissage, resumeScene,
  type Prise, type Scene,
} from './cameraStudio'

const P = (nom: string, genre: Prise['genre']): Prise => ({ nom, genre, taille: 1, date: 0, duree: null })
const PRISES = [P('clip-20261020-100000-8s.mp4', 'video'), P('prise-20261020-090000.jpg', 'image'), P('prise-20261019-090000.jpg', 'image')]
const SCENE: Scene = { id: 'abcdef12', nom: 'visio', reglages: { fond: { mode: 'flou', nom: '', flou: 55 }, detourage: { durete: 60, marge: 0, stabilite: 40 }, cadence: 30 } }

describe('studio camera', () => {
  it('noms lisibles', () => {
    expect(nomLisible('prise-20261020-090507.jpg')).toBe('20 oct. 09:05:07')
    expect(nomLisible('clip-20260105-231500-12s.mp4')).toBe('5 janv. 23:15:00')
    expect(nomLisible('autre.txt')).toBe('autre.txt')
  })

  it('filtre et decomptes', () => {
    expect(filtrer(PRISES, 'tout')).toHaveLength(3)
    expect(filtrer(PRISES, 'photos').map((p) => p.genre)).toEqual(['image', 'image'])
    expect(filtrer(PRISES, 'clips')).toHaveLength(1)
    expect(comptes(PRISES)).toEqual({ tout: 3, photos: 2, clips: 1 })
  })

  it('remplissage du quota sur la contrainte la plus serree', () => {
    expect(remplissage({ utilise: 50, max: 100, n: 1, max_n: 100 })).toBe(0.5)
    expect(remplissage({ utilise: 1, max: 100, n: 90, max_n: 100 })).toBe(0.9)
    expect(remplissage({ utilise: 500, max: 100, n: 1, max_n: 100 })).toBe(1)
    expect(remplissage({ utilise: 5, max: 0, n: 0, max_n: 0 })).toBe(0)
  })

  it('durees', () => {
    expect(dureeLisible(null)).toBe('')
    expect(dureeLisible(8)).toBe('8 s')
    expect(dureeLisible(75)).toBe('1 min 15 s')
  })

  it('une scene ne porte que fond, detourage et cadence, et le patch est une copie', () => {
    const p = patchDeScene(SCENE)
    expect(Object.keys(p).sort()).toEqual(['cadence', 'detourage', 'fond'])
    p.fond.flou = 1
    expect(SCENE.reglages.fond.flou).toBe(55)
    expect(resumeScene(SCENE)).toBe('flou 55 %, durcissement 60, marge 0, stabilité 40, 30 images/s')
  })

  it('pourquoi on ne peut pas prendre de prise', () => {
    expect(raisonBloquee({ pret: true, message: '', enregistrement: null })).toBe('')
    expect(raisonBloquee({ pret: false, message: 'la caméra est éteinte', enregistrement: null })).toBe('la caméra est éteinte')
    expect(raisonBloquee({ pret: true, message: '', enregistrement: { debut: 0, duree: 10, ecoule: 1 } })).toBe('enregistrement en cours')
  })

  it('progression d un enregistrement', () => {
    expect(enregistrementEnCours(null)).toBeNull()
    expect(enregistrementEnCours({ debut: 0, duree: 10, ecoule: 2.5 })).toEqual({ reste: 8, part: 0.25 })
    expect(enregistrementEnCours({ debut: 0, duree: 10, ecoule: 12 })).toEqual({ reste: 0, part: 1 })
  })
})
