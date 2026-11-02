import { describe, expect, it } from 'vitest'
import {
  BROUILLON_VIDE, brouillonDepuis, corpsElement, erreursEtape, hoteLocal, phraseDate, phraseMode, phrasePlan, phraseProchaine, tonEtat, tonStatut,
  type Catalogue, type Element, type Suivi,
} from './rotation'

const CAT: Catalogue = { sondes: {}, adaptateurs: {}, consommateurs: {}, periode_min: 1, periode_max: 365 }
const J = 86400
const S = (p: Partial<Suivi>): Suivi => ({ derniere_reussite: null, dernier_echec: null, prochaine: null, etat: 'ok', sonde: null, ...p })
const ITEM = { id: 'i1', nom: 'NAS', identifiant: 'admin', dossier: 'maison', modifie: '', planifie: false, element: '' }

describe('rotation : vocabulaire', () => {
  it('prochaine rotation', () => {
    expect(phraseProchaine(S({ prochaine: 1000 + 5 * J }), 1000)).toBe('dans 5 j')
    expect(phraseProchaine(S({ prochaine: 1000 }), 1000)).toBe("due aujourd'hui")
    expect(phraseProchaine(S({ prochaine: 1000 - 3 * J }), 1000)).toBe('due depuis 3 j')
    expect(phraseProchaine(S({ prochaine: null, etat: 'manuelle' }), 1000)).toContain('à la demande')
    expect(phraseProchaine(S({ etat: 'en_attente' }), 1000)).toContain('prêt')
  })
  it('dates relatives', () => {
    expect(phraseDate(null, 5)).toBe('jamais')
    expect(phraseDate(100, 100 + J + 5)).toBe('hier')
    expect(phraseDate(100, 100 + 9 * J)).toBe('il y a 9 j')
  })
  it('tons', () => {
    expect(tonEtat('due')).toBe('crit')
    expect(tonEtat('echec')).toBe('crit')
    expect(tonEtat('bientot')).toBe('warn')
    expect(tonEtat('manuelle')).toBeUndefined()
    expect(tonStatut('echec_critique')).toBe('crit')
    expect(tonStatut('echec_annulee')).toBe('warn')
    expect(tonStatut('reussie')).toBe('ok')
  })
  it('mode et plan decrits sans rien cacher', () => {
    const el = { adaptateur: 'qbittorrent', gere_ailleurs: false, mode: 'planifiée', auto_reel: false, periode_jours: 30, consommateurs: [], sonde: null } as unknown as Element
    expect(phraseMode(el)).toContain('tous les 30 j')
    expect(phraseMode({ ...el, gere_ailleurs: true })).toContain('media-server')
    expect(phrasePlan(el)).toContain('ne relancer aucun service')
    expect(phrasePlan({ ...el, consommateurs: [{ type: 'unite', nom: 'x.service' }] })).toContain('relancer x.service')
    expect(phrasePlan({ ...el, adaptateur: 'assiste' })).toContain("tu l'appliques toi-même")
  })
})

describe('rotation : assistant', () => {
  it.each([
    ['http://127.0.0.1:8080/x', true], ['http://localhost/', true], ['https://192.168.0.31/', true], ['http://100.101.2.3/', true], // guard:allow adresse de test
    ['http://172.20.1.1/', true], ['http://172.40.1.1/', false], ['http://exemple.com/', false], ['ftp://127.0.0.1/', false],
    ['http://u:p@127.0.0.1/', false], ['pas une url', false], ['http://8.8.8.8/', false],
  ])('hote %s', (url, ok) => expect(hoteLocal(url)).toBe(ok))

  it('etape 1 : un element est requis', () => {
    expect(erreursEtape(1, BROUILLON_VIDE, CAT)).toHaveLength(1)
    expect(erreursEtape(1, brouillonDepuis(ITEM), CAT)).toEqual([])
  })

  it('etape 2 : sonde, unites et fichiers valides', () => {
    const b = { ...brouillonDepuis(ITEM) }
    expect(erreursEtape(2, b, CAT)).toEqual([])
    expect(erreursEtape(2, { ...b, sondeType: 'http_basic', sondeUrl: 'http://exemple.com', sondeUtilisateur: '' }, CAT)).toHaveLength(2)
    expect(erreursEtape(2, { ...b, sondeType: 'http_bearer', sondeUrl: 'http://127.0.0.1/api' }, CAT)).toEqual([])
    expect(erreursEtape(2, { ...b, unites: ['x; reboot.service'] }, CAT)).toHaveLength(1)
    expect(erreursEtape(2, { ...b, blobs: [{ chemin: '/a/b.txt', nom: 'x' }] }, CAT)).toHaveLength(1)
    expect(erreursEtape(2, { ...b, blobs: [{ chemin: '/a/b.cred', nom: 'x' }], unites: ['a.service'] }, CAT)).toEqual([])
  })

  it('etape 3 : nom et periodicite', () => {
    const b = { ...brouillonDepuis(ITEM), nom: '  ' }
    expect(erreursEtape(3, b, CAT)).toHaveLength(1)
    expect(erreursEtape(3, { ...b, nom: 'NAS', periode: 0 }, CAT)).toHaveLength(1)
    expect(erreursEtape(3, { ...b, nom: 'NAS', periode: 400 }, CAT)).toHaveLength(1)
    expect(erreursEtape(3, { ...b, nom: 'NAS', periodique: false, periode: 0 }, CAT)).toEqual([])
  })

  it('le corps envoye ne contient que des champs declares', () => {
    const b = { ...brouillonDepuis(ITEM), sondeType: 'http_basic' as const, sondeUrl: ' http://127.0.0.1/ ', sondeUtilisateur: 'u ', adaptateur: 'qbittorrent' as const,
      blobs: [{ chemin: ' /h/x.cred ', nom: 'x ' }], unites: ['a.service'], periodique: false }
    expect(corpsElement(b)).toEqual({
      nom: 'NAS', coffre: { id: 'i1', nom: 'NAS' }, adaptateur: 'qbittorrent', periode_jours: null,
      sonde: { type: 'http_basic', url: 'http://127.0.0.1/', attendu: 200, utilisateur: 'u' },
      consommateurs: [{ type: 'blob_cred', chemin: '/h/x.cred', nom: 'x' }, { type: 'unite', nom: 'a.service' }],
    })
    expect(corpsElement({ ...b, sondeType: 'http_bearer' }).sonde).toEqual({ type: 'http_bearer', url: 'http://127.0.0.1/', attendu: 200 })
    expect(corpsElement({ ...b, sondeType: '' }).sonde).toBeNull()
  })
})
