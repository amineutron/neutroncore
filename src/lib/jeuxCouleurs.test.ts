import { describe, expect, it } from 'vitest'
import { MAX_COULEURS } from './spatialPalette'
import { MAX_JEUX, ajouterJeu, charger, enregistrer, nettoyerCouleurs, retirerJeu, type JeuCouleurs } from './jeuxCouleurs'

const jeu = (nom: string, couleurs = ['#ff0000', '#00ff00']): JeuCouleurs => ({ id: nom.toLowerCase(), nom, couleurs })

describe('nettoyerCouleurs', () => {
  it('met en minuscules, ajoute le # manquant et développe #rgb', () => {
    expect(nettoyerCouleurs(['#FF0000', '00ff00', '#0af'])).toEqual(['#ff0000', '#00ff00', '#00aaff'])
  })
  it('écarte les valeurs qui ne sont pas des couleurs', () => {
    expect(nettoyerCouleurs(['#ff0000', 'rouge', '', '#12345', 42 as never, '#gggggg'])).toEqual(['#ff0000'])
  })
  it('plafonne au nombre de couleurs que les lampes savent jouer', () => {
    const beaucoup = Array.from({ length: MAX_COULEURS + 4 }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`)
    expect(nettoyerCouleurs(beaucoup)).toHaveLength(MAX_COULEURS)
  })
})

describe('ajouterJeu', () => {
  it('ajoute un jeu au bout, sans toucher à la liste d’origine', () => {
    const avant: JeuCouleurs[] = [jeu('Rouge')]
    const apres = ajouterJeu(avant, 'Bleu nuit', ['#001133', '#0044aa'])
    expect(apres).toHaveLength(2)
    expect(apres[1]).toMatchObject({ nom: 'Bleu nuit', couleurs: ['#001133', '#0044aa'] })
    expect(avant).toHaveLength(1)
  })
  it('rogne le nom et le borne à 24 caractères', () => {
    const [j] = ajouterJeu([], `   ${'x'.repeat(40)}   `, ['#ff0000'])
    expect(j.nom).toBe('x'.repeat(24))
  })
  it('remplace le jeu du même nom, casse et espaces ignorés, et garde sa place', () => {
    const avant = [jeu('Feu', ['#ff0000']), jeu('Glace', ['#00ffff'])]
    const apres = ajouterJeu(avant, '  feu ', ['#ff8800', '#ffee00'])
    expect(apres).toHaveLength(2)
    expect(apres[0].couleurs).toEqual(['#ff8800', '#ffee00'])
    expect(apres[0].id).toBe(avant[0].id)
  })
  it('refuse un nom vide ou sans aucune couleur valide', () => {
    expect(() => ajouterJeu([], '   ', ['#ff0000'])).toThrow(/nom/)
    expect(() => ajouterJeu([], 'Vide', ['rien'])).toThrow(/couleur/)
  })
  it('refuse d’aller au-delà de la limite, sauf pour remplacer un jeu existant', () => {
    const plein = Array.from({ length: MAX_JEUX }, (_, i) => jeu(`jeu ${i}`))
    expect(() => ajouterJeu(plein, 'de trop', ['#ff0000'])).toThrow(/limite|trop/)
    expect(ajouterJeu(plein, 'jeu 3', ['#123456'])).toHaveLength(MAX_JEUX)
  })
  it('donne des identifiants distincts même à deux noms qui se ressemblent', () => {
    const liste = ajouterJeu(ajouterJeu([], 'Été !', ['#ff0000']), 'Été ?', ['#00ff00'])
    expect(new Set(liste.map((j) => j.id)).size).toBe(2)
  })
})

describe('retirerJeu', () => {
  it('retire par identifiant et laisse l’original intact', () => {
    const avant = [jeu('A'), jeu('B')]
    expect(retirerJeu(avant, 'a').map((j) => j.nom)).toEqual(['B'])
    expect(avant).toHaveLength(2)
  })
  it('ne fait rien si l’identifiant est inconnu', () => {
    expect(retirerJeu([jeu('A')], 'zzz')).toHaveLength(1)
  })
})

describe('charger / enregistrer', () => {
  const memoire = (init?: string) => {
    const m = new Map<string, string>(init === undefined ? [] : [['k', init]])
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
  }

  it('relit ce qui a été enregistré', () => {
    const s = memoire()
    enregistrer('k', [jeu('Feu', ['#ff0000', '#ffaa00'])], s)
    expect(charger('k', s)).toEqual([{ id: 'feu', nom: 'Feu', couleurs: ['#ff0000', '#ffaa00'] }])
  })
  it('renvoie une liste vide si rien n’est stocké ou si le contenu est abîmé', () => {
    expect(charger('k', memoire())).toEqual([])
    expect(charger('k', memoire('{pas du json'))).toEqual([])
    expect(charger('k', memoire('[1,2]'))).toEqual([])
    expect(charger('k', memoire(JSON.stringify({ jeux: 'oups' })))).toEqual([])
  })
  it('ignore les entrées invalides sans perdre les bonnes', () => {
    const brut = JSON.stringify({ jeux: [jeu('Bon'), { id: 'x', nom: '', couleurs: ['#ff0000'] }, { nom: 'Sans couleur', couleurs: [] }, null, 'texte'] })
    expect(charger('k', memoire(brut)).map((j) => j.nom)).toEqual(['Bon'])
  })
  it('survit à un stockage indisponible', () => {
    const casse = { getItem: () => { throw new Error('bloqué') }, setItem: () => { throw new Error('bloqué') } }
    expect(charger('k', casse)).toEqual([])
    expect(() => enregistrer('k', [jeu('A')], casse)).not.toThrow()
  })
})
