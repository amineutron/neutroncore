import { describe, expect, it } from 'vitest'
import type { Controle } from './atelier'
import { demandeCorrection, lireControle } from './atelierControle'

const C = (nom: string, ok: boolean, mesure: number | null, limite: number | null, detail = '', nature = 'geometrie'): Controle => ({ nom, ok, mesure, limite, detail, nature })

describe('un contrôle dit avec des mots', () => {
  it('solidité : marge de sécurité, et ce que ça implique', () => {
    const l = lireControle(C('resistance:bequille_flexion', false, 2.0049, 3, '23.9 pour 48 admissible, coefficient 2.00 ; MPa ; 1932 N.mm sur 49.0 x 3.85 sous la gorge', 'calcul'))
    expect(l.titre).toBe('solidité — béquille flexion')
    expect(l.phrase).toBe('Ça tient, avec une marge de sécurité de × 2 ; il en faut × 3.')
    expect(l.consequence).toBe('La marge de sécurité est plus faible que celle demandée.')
    expect(l.ratio).toBeCloseTo(0.668, 2)
    expect(l.points).toEqual(['23.9 pour 48 admissible, coefficient 2.00', 'MPa', '1932 N.mm sur 49.0 x 3.85 sous la gorge'])
  })
  it('solidité sous 1 : on dit que ça casserait', () => {
    expect(lireControle(C('resistance:pivot_matage', false, 0.8, 3, '', 'calcul')).phrase).toMatch(/^Ça casserait/)
  })
  it('solidité en échec avec une mesure au-dessus de la limite : pas de « ça tient »', () => {
    expect(lireControle(C('resistance:pivot', false, 60, 48, '', 'calcul')).phrase).toBe('Mesuré 60 ; le maximum admis est 48.')
  })
  it('sens de la limite déduit des nombres : minimum à atteindre ou maximum dépassé', () => {
    expect(lireControle(C('paroi:corps_flanc', false, 0.8, 1.2)).phrase).toBe('Mesuré 0,8 ; il faut au moins 1,2.')
    expect(lireControle(C('enveloppe:x', false, 108, 107)).phrase).toBe('Mesuré 108 ; le maximum admis est 107.')
    expect(lireControle(C('gonflement:cellule', false, 379.33, 0.001)).phrase).toBe('Mesuré 379,33 ; le maximum admis est 0,001.')
    expect(lireControle(C('enveloppe:x', false, 108, 107)).ratio).toBeNull()
  })
  it('deux pièces : « corps/couvercle » se lit « corps et couvercle »', () => {
    const l = lireControle(C('interference:corps/couvercle', false, 12.5, 0.001))
    expect(l.titre).toBe('collision entre pièces — corps et couvercle')
    expect(l.consequence).toMatch(/se traversent/)
  })
  it('un contrôle qui passe n’a pas de conséquence', () => {
    expect(lireControle(C('jeu:axe_palier', true, 0.2, 0.15))).toMatchObject({ phrase: 'Conforme : 0,2 pour une limite de 0,15.', consequence: '' })
    expect(lireControle(C('assemblage:composants_presents', true, 0, 0)).phrase).toBe('Conforme.')
  })
  it('indicateur : une valeur, pas un verdict', () => {
    expect(lireControle(C('usage:masse_totale', true, 412.5, null, '', 'indicateur'))).toMatchObject({ phrase: 'Valeur relevée : 412,5.', consequence: '' })
  })
  it('famille inconnue ou nombres absents : on reste général, sans inventer', () => {
    const l = lireControle(C('truc_nouveau:piece_a', false, null, null))
    expect(l).toMatchObject({ titre: 'truc nouveau — pièce a', phrase: 'Non conforme.', consequence: 'Ce point n’est pas conforme à ce qui est demandé.', ratio: null, points: [] })
    expect(lireControle(C('seul', false, 1, 2)).titre).toBe('seul')
  })
  it('la famille peut venir après le nom de la pièce (rapport de la boîte LEGO)', () => {
    expect(lireControle(C('couvercle:jeu:pire_cas', false, 0.104, 0.2))).toMatchObject({
      titre: 'jeu entre pièces — couvercle pire cas', phrase: 'Mesuré 0,1 ; il faut au moins 0,2.',
      consequence: 'Pas assez de jeu : les pièces risquent de forcer ou de ne pas s’emboîter.',
    })
    expect(lireControle(C('regle:pilier_de_fenetre', false, 0.6, 0.8)).titre).toBe('règle de conception — pilier de fenêtre')
    expect(lireControle(C('paroi:bac:epaisseur_mini', false, 0.6, 0.8)).titre).toBe('épaisseur de paroi — bac épaisseur mini')
    expect(lireControle(C('empilement:jeu:pire_cas', false, 0.1, 0.2)).titre).toBe('empilement — jeu pire cas')
  })
  it('un nom qui existe dans le prototype des objets reste un mot ordinaire', () => {
    expect(lireControle(C('constructor:toString', false, 1, 2)).titre).toBe('constructor — toString')
  })
  it('prépare une demande de correction qui garde le nom exact du contrôle', () => {
    expect(demandeCorrection(C('paroi:corps_flanc', false, 0.8, 1.2))).toBe('Corriger le contrôle en échec « paroi:corps_flanc » (épaisseur de paroi — corps flanc). Mesuré 0,8 ; il faut au moins 1,2.')
  })
})
