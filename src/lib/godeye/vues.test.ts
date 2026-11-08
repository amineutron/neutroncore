import { describe, expect, it } from 'vitest'
import { FILTRES_DEFAUT, VUES_INTEGREES } from './filtres'
import { PICTOS } from './pictos'
import { corpsVue, filtresCourants, ICONES_PROFIL, lireVues, NB_PROFILS, NOM_VUE_MAX, profilsPersonnels, toutesLesVues, vuesLibres } from './vues'

describe('vues enregistrées', () => {
  it('relit les filtres et écarte les lignes sans nom ni id', () => {
    const vues = lireVues({ vues: [
      { id: 'a', nom: 'Europe', filtres: { couches: { avions: true } }, camera: { cx: 10, cy: 48, zoom: 4 } },
      { id: 'b', nom: '  ', filtres: {} }, { nom: 'sans id' }, null, 5,
    ] })
    expect(vues).toHaveLength(1)
    expect(vues[0].filtres.couches.avions).toBe(true)
    expect(vues[0].filtres.seismes).toEqual(FILTRES_DEFAUT.seismes)
    expect(vues[0].camera).toEqual({ cx: 10, cy: 48, zoom: 4 })
  })
  it('une caméra hors bornes devient absente', () => {
    expect(lireVues({ vues: [{ id: 'a', nom: 'x', filtres: {}, camera: { cx: 999, cy: 0, zoom: 2 } }] })[0].camera).toBeNull()
  })
  it('réponse illisible = aucune vue', () => {
    for (const b of [null, {}, { vues: 'x' }, 'zzz']) expect(lireVues(b)).toEqual([])
  })
  it('corpsVue borne le nom et n\'ajoute l\'id que s\'il est donné', () => {
    expect(corpsVue('  ' + 'n'.repeat(80), FILTRES_DEFAUT, null).nom).toHaveLength(NOM_VUE_MAX)
    expect('id' in corpsVue('x', FILTRES_DEFAUT, null)).toBe(false)
    expect(corpsVue('x', FILTRES_DEFAUT, null, 'abc').id).toBe('abc')
  })
  it('intégrées en tête, perso triées sans modifier l\'entrée', () => {
    const perso = lireVues({ vues: [{ id: 'z', nom: 'Zèbre', filtres: {} }, { id: 'a', nom: 'abeille', filtres: {} }] })
    const copie = [...perso]
    const tout = toutesLesVues(perso)
    expect(tout.slice(0, VUES_INTEGREES.length)).toEqual(VUES_INTEGREES)
    expect(tout.slice(VUES_INTEGREES.length).map((v) => v.nom)).toEqual(['abeille', 'Zèbre'])
    expect(perso).toEqual(copie)
  })
  it('relit l\'emplacement et l\'icône, ignore ce qui est invalide', () => {
    const [a, b, c] = lireVues({ vues: [
      { id: 'a', nom: 'A', filtres: {}, slot: 2, icone: 'satellite' },
      { id: 'b', nom: 'B', filtres: {}, slot: 9, icone: '<x>' },
      { id: 'c', nom: 'C', filtres: {}, slot: '1' },
    ] })
    expect([a.slot, a.icone]).toEqual([2, 'satellite'])
    expect([b.slot, b.icone]).toEqual([null, null])
    expect(c.slot).toBeNull()
  })
  it('profilsPersonnels : trois emplacements, vides ou remplis, la vue libre est écartée', () => {
    const vues = lireVues({ vues: [
      { id: 'a', nom: 'Nuit', filtres: {}, slot: 3 }, { id: 'b', nom: 'Libre', filtres: {} }, { id: 'c', nom: 'Doublon', filtres: {}, slot: 3 },
    ] })
    const p = profilsPersonnels(vues)
    expect(p).toHaveLength(NB_PROFILS)
    expect(p[0]).toBeNull()
    expect(p[2]?.nom).toBe('Nuit')
    expect(vuesLibres(vues).map((v) => v.nom)).toEqual(['Libre'])
  })
  it('corpsVue porte l\'emplacement et l\'icône, et ignore une icône inconnue', () => {
    const c = corpsVue('Ma veille', FILTRES_DEFAUT, null, 'abc', { slot: 1, icone: 'cyber' })
    expect([c.slot, c.icone, c.id]).toEqual([1, 'cyber', 'abc'])
    expect(corpsVue('x', FILTRES_DEFAUT, null, undefined, { slot: 1, icone: 'nimporte' }).icone).toBeUndefined()
    expect('slot' in corpsVue('x', FILTRES_DEFAUT, null)).toBe(false)
  })
  it('chaque icône proposée a un tracé', () => {
    for (const i of ICONES_PROFIL) expect(PICTOS[i]).toBeDefined()
  })
  it('filtresCourants tolère un stockage vide ou cassé', () => {
    expect(filtresCourants(null)).toEqual(FILTRES_DEFAUT)
    expect(filtresCourants('{pas du json')).toEqual(FILTRES_DEFAUT)
    expect(filtresCourants(JSON.stringify({ texte: 'abc' })).texte).toBe('abc')
  })
})
