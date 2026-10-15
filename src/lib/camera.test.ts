import { describe, expect, it } from 'vitest'
import { degradeCss, etatCamera, mesures, motDurete, motMarge, motStabilite, refusFond, tailleLisible, type Moteur } from './camera'

const M = (m: Partial<Moteur>): Moteur => ({ actif: false, demarre: false, ...m })

describe('caméra', () => {
  it('état en un mot', () => {
    expect(etatCamera(undefined, false).texte).toBe('…')
    expect(etatCamera(M({}), false)).toEqual({ texte: 'éteinte', tone: 'off' })
    expect(etatCamera(M({ demarre: true }), false).texte).toBe('démarre…')
    expect(etatCamera(M({ actif: true }), false)).toEqual({ texte: 'allumée', tone: 'ok' })
    expect(etatCamera(M({ actif: true }), true).texte).toBe('en veille')
    expect(etatCamera(M({ erreur: 'la webcam ne s’ouvre pas' }), false).tone).toBe('crit')
    // une note de fond manquant ne met pas la caméra en erreur tant qu'elle tourne
    expect(etatCamera(M({ actif: true, erreur: 'fond : image illisible' }), false).tone).toBe('ok')
  })

  it('mesures du moteur', () => {
    expect(mesures(M({}))).toBe('')
    expect(mesures(M({ demarre: true, phase: 'chargement du modèle de détourage' }))).toBe('chargement du modèle de détourage')
    expect(mesures(M({ actif: true, fps: 29.9, ms_detourage: 11.4, modele: 'rvm', vram_mo: 310 }))).toBe('30 images/s · détourage 11 ms · modèle fin · 310 Mo de carte graphique')
    expect(mesures(M({ actif: true, fps: 30, modele: '' }))).toBe('30 images/s')
  })

  it('curseurs dits avec des mots', () => {
    expect([motDurete(0), motDurete(40), motDurete(60), motDurete(100)]).toEqual(['très doux', 'doux', 'net', 'très net'])
    expect([motMarge(0), motMarge(-3), motMarge(5)]).toEqual(['au ras', 'rogné de 3 px', 'élargi de 5 px'])
    expect([motStabilite(0), motStabilite(40), motStabilite(90)]).toEqual(['réactif', 'équilibré', 'très stable (traîne un peu)'])
  })

  it('fonds', () => {
    expect(degradeCss({ couleurs: ['#000000', '#ffffff'], angle: 135 })).toBe('linear-gradient(135deg, #000000, #ffffff)')
    expect([tailleLisible(500), tailleLisible(2_600_000), tailleLisible(48_000_000)]).toEqual(['1 Ko', '2,5 Mo', '46 Mo'])
    const limites = { taille_fond: 1000, formats: ['.png', '.mp4'] }
    expect(refusFond('Plage.PNG', 10, limites)).toBe('')
    expect(refusFond('script.sh', 10, limites)).toContain('format refusé')
    expect(refusFond('film.mp4', 2000, limites)).toContain('trop lourd')
  })
})
