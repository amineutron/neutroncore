import { describe, expect, it } from 'vitest'
import { estInconnu, libelleCategorie, courbe, ecrireFiltres, filtrer, fmtDebit, fmtMs, lireFiltres, phraseResume, titreAppareil, toneLatence, vuIl, FILTRES_DEFAUT, type Appareil } from './reseau'

const A = (p: Partial<Appareil>): Appareil => ({
  mac: 'aa:bb:cc:00:00:01', ip: '192.0.2.5', fabricant: '', present: true, etat: 'REACHABLE', connu: false, nom: '', etiquette: '',
  passerelle: false, premiere_vue: 0, derniere_vue: 0, aleatoire: false, ...p,
})

describe('réseau : formats', () => {
  it('débit', () => {
    expect(fmtDebit(null)).toBe('—')
    expect(fmtDebit(0)).toBe('0 o/s')
    expect(fmtDebit(1536)).toBe('1,5 Ko/s')
    expect(fmtDebit(5 * 1024 * 1024)).toBe('5,0 Mo/s')
    expect(fmtDebit(300 * 1024)).toBe('300 Ko/s')
  })
  it('latence et ton', () => {
    expect(fmtMs(null)).toBe('—')
    expect(fmtMs(7.95)).toBe('8,0 ms')
    expect(toneLatence({ moy: 8, perte: 0 })).toBe('ok')
    expect(toneLatence({ moy: 80, perte: 0 })).toBe('warn')
    expect(toneLatence({ moy: 8, perte: 33 })).toBe('warn')
    expect(toneLatence({ moy: null, perte: 100 })).toBe('crit')
    expect(toneLatence({})).toBe('warn')
  })
  it('dernière vue', () => {
    expect(vuIl(null)).toBe('jamais vu')
    expect(vuIl(1000, 1030)).toBe('à l’instant')
    expect(vuIl(1000, 1000 + 600)).toBe('il y a 10 min')
    expect(vuIl(1000, 1000 + 7200)).toBe('il y a 2 h')
    expect(vuIl(1000, 1000 + 3 * 86400)).toBe('il y a 3 j')
  })
  it('courbe : trous et échelle', () => {
    expect(courbe([1], 100, 10)).toBe('')
    expect(courbe([0, 10], 100, 10)).toBe('M0.0 10.0 L100.0 0.0')
    expect(courbe([5, null, 5], 100, 10, 10)).toBe('M0.0 5.0 M100.0 5.0')
  })
  it('phrase de résumé', () => {
    expect(phraseResume({ presents: 0, inconnus: 0, connus_absents: 0, total: 0 })).toMatch(/aucun/)
    expect(phraseResume({ presents: 5, inconnus: 2, connus_absents: 1, total: 8 })).toBe('5 en ligne, 2 inconnus')
  })
})

describe('réseau : filtres', () => {
  const liste = [
    A({ mac: 'm1', nom: 'tv salon', connu: true }),
    A({ mac: 'm2', fabricant: 'Acme' }),
    A({ mac: 'm3', aleatoire: true, present: false }),
    A({ mac: 'm4', connu: true, nom: 'nas', present: false, aleatoire: true }),
  ]
  it('chaque filtre', () => {
    expect(filtrer(liste, FILTRES_DEFAUT)).toHaveLength(4)
    expect(filtrer(liste, { ...FILTRES_DEFAUT, inconnus: true }).map((a) => a.mac)).toEqual(['m2', 'm3'])
    expect(filtrer(liste, { ...FILTRES_DEFAUT, presents: true }).map((a) => a.mac)).toEqual(['m1', 'm2'])
    // un appareil connu à adresse privée reste visible
    expect(filtrer(liste, { ...FILTRES_DEFAUT, masquerAleatoires: true }).map((a) => a.mac)).toEqual(['m1', 'm2', 'm4'])
    expect(filtrer(liste, { ...FILTRES_DEFAUT, recherche: ' ACME ' }).map((a) => a.mac)).toEqual(['m2'])
  })
  it('titre lisible', () => {
    expect(titreAppareil(A({ nom: 'tv' }))).toBe('tv')
    expect(titreAppareil(A({ fabricant: 'Acme' }))).toBe('Acme')
    expect(titreAppareil(A({ aleatoire: true }))).toBe('appareil (adresse privée)')
    expect(titreAppareil(A({}))).toBe('appareil inconnu')
  })
  it('mémorisation tolérante', () => {
    const mem: Record<string, string> = {}
    const st = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v } }
    ecrireFiltres(st, { ...FILTRES_DEFAUT, inconnus: true, recherche: 'tv' })
    expect(lireFiltres(st)).toEqual({ ...FILTRES_DEFAUT, inconnus: true, recherche: 'tv' })
    expect(lireFiltres(null)).toEqual(FILTRES_DEFAUT)
    expect(lireFiltres({ getItem: () => '{pas du json' })).toEqual(FILTRES_DEFAUT)
    expect(lireFiltres({ getItem: () => { throw new Error('bloqué') } })).toEqual(FILTRES_DEFAUT)
    expect(lireFiltres({ getItem: () => JSON.stringify({ inconnus: 'oui', recherche: 5 }) })).toEqual(FILTRES_DEFAUT)
    expect(() => ecrireFiltres({ setItem: () => { throw new Error('plein') } }, FILTRES_DEFAUT)).not.toThrow()
  })
})

describe('faux inconnus (releve reel anonymise)', () => {
  const base = { mac: 'm', ip: '', fabricant: '', present: true, etat: '', connu: false, nom: '', etiquette: '', passerelle: false, premiere_vue: 0, derniere_vue: 0, aleatoire: false } as Appareil
  it('la box, son interface soeur et un telephone en adresse privee ne sont pas inconnus', () => {
    expect(estInconnu({ ...base, categorie: 'passerelle_secondaire', inconnu: false })).toBe(false)
    expect(estInconnu({ ...base, categorie: 'prive', inconnu: false, aleatoire: true })).toBe(false)
    expect(estInconnu({ ...base, inconnu: true })).toBe(true)
    expect(estInconnu(base)).toBe(true)                       // vieille reponse
    expect(estInconnu({ ...base, connu: true })).toBe(false)
  })
  it('le filtre « inconnus seulement » suit ce champ', () => {
    const l = [{ ...base, mac: 'a', inconnu: false }, { ...base, mac: 'b', inconnu: true }]
    expect(filtrer(l, { ...FILTRES_DEFAUT, inconnus: true }).map((a) => a.mac)).toEqual(['b'])
  })
  it('nom resolu en titre, categorie en clair, resume avec les adresses privees', () => {
    expect(titreAppareil({ ...base, hote: 'imprimante', fabricant: 'Acme' })).toBe('imprimante')
    expect(libelleCategorie({ ...base, categorie: 'passerelle_secondaire' })).toBe('interface de la passerelle')
    expect(libelleCategorie(base)).toBe('')
    expect(phraseResume({ presents: 5, inconnus: 3, connus_absents: 0, total: 5, prives: 2 })).toBe('5 en ligne, 3 inconnus, 2 adresses privées')
  })
})
