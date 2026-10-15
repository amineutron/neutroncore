import { describe, expect, it } from 'vitest'
import { bouclesEnCours, sessionDuProjet, avancement, autresEnAttente, boucleAffichee, derniereRecente, etatBoucle, trierBoucles, type Boucle } from './atelierSessions'

const B = (sessionId: string, modele: string, startedAt: number, waiting = false, status = 'busy'): Boucle => ({ sessionId, modele, startedAt, waiting, status })
const TOUTES = [B('a', 'boite', 10), B('b', 'support', 30, true), B('c', 'boite', 20), B('d', '', 40)]

describe('sessions de boucle de l’atelier', () => {
  it('dit l’état en clair', () => {
    expect(etatBoucle(null)).toEqual({ texte: 'au repos', tone: '' })
    expect(etatBoucle(null, true).texte).toBe('démarre…')
    expect(etatBoucle(B('a', 'x', 1, true))).toEqual({ texte: 'attend ta réponse', tone: 'wait' })
    expect(etatBoucle(B('a', 'x', 1, false, 'idle')).texte).toBe('en pause')
    expect(etatBoucle(B('a', 'x', 1)).tone).toBe('busy')
  })
  it('range le projet affiché d’abord, puis ce qui attend, puis le plus récent', () => {
    expect(trierBoucles(TOUTES, 'boite').map((b) => b.sessionId)).toEqual(['c', 'a', 'b', 'd'])
    expect(trierBoucles(TOUTES, 'autre').map((b) => b.sessionId)).toEqual(['b', 'd', 'c', 'a'])
  })
  it('montre la session choisie si elle vit, sinon la plus récente du projet, sinon rien', () => {
    expect(boucleAffichee(TOUTES, 'boite', 'b')?.sessionId).toBe('b')
    expect(boucleAffichee(TOUTES, 'boite', null)?.sessionId).toBe('c')
    expect(boucleAffichee(TOUTES, 'boite', 'disparue')?.sessionId).toBe('c')
    expect(boucleAffichee(TOUTES, 'lampe', null)).toBeNull()
  })
  it('retrouve la dernière session terminée du projet', () => {
    const r = [{ sessionId: 'x', modele: 'boite', updatedAt: 5, title: '' }, { sessionId: 'y', modele: 'boite', updatedAt: 9, title: '' }, { sessionId: 'z', modele: 'support', updatedAt: 20, title: '' }]
    expect(derniereRecente(r, 'boite')?.sessionId).toBe('y')
    expect(derniereRecente(r, 'lampe')).toBeNull()
  })
  it('compte les autres projets qui attendent', () => {
    expect(autresEnAttente(TOUTES, 'boite')).toBe(1)
    expect(autresEnAttente(TOUTES, 'support')).toBe(0)
  })
  it('bandeau d’avancement : rien sans boucle, démarrage, travail, attente, fin', () => {
    const rien = { session: null, attendue: false, perdue: false, etape: -1 }
    expect(avancement(rien)).toBeNull()
    expect(avancement({ ...rien, attendue: true })).toEqual({ phase: 'demarre', etape: 0 })
    expect(avancement({ ...rien, perdue: true })).toEqual({ phase: 'perdue', etape: 0 })
    expect(avancement({ ...rien, session: B('a', 'x', 1), etape: 1 })).toEqual({ phase: 'travaille', etape: 1 })
    expect(avancement({ ...rien, session: B('a', 'x', 1), etape: -1 })).toEqual({ phase: 'travaille', etape: 0 })
    expect(avancement({ ...rien, session: B('a', 'x', 1, true), etape: 2 })).toEqual({ phase: 'attend', etape: 2 })
    expect(avancement({ ...rien, session: B('a', 'x', 1, false, 'idle'), etape: 4 })).toEqual({ phase: 'finie', etape: 4 })
    // régression : une session à l'arrêt (« shell » = il ne reste que la visionneuse) n'est pas « au travail »
    expect(avancement({ ...rien, session: B('a', 'x', 1, false, 'shell'), etape: 3 })).toEqual({ phase: 'pause', etape: 3 })
    expect(avancement({ ...rien, session: B('a', 'x', 1, false, 'idle'), etape: 1 })).toEqual({ phase: 'pause', etape: 1 })
    expect(etatBoucle(B('a', 'x', 1, false, 'shell')).texte).toBe('en pause')
  })
  it('après un lancement, la session d’une itération précédente n’est pas prise pour la nouvelle', () => {
    const ancienne = { ...B('vieille', 'x', 1000), startedAt: 1_000_000 }
    const neuve = { ...B('neuve', 'x', 1000), startedAt: 2_000_000 }
    expect(sessionDuProjet([ancienne], 'x', null)?.sessionId).toBe('vieille')
    expect(sessionDuProjet([ancienne], 'x', 2_000_000)).toBeNull()
    expect(sessionDuProjet([ancienne, neuve], 'x', 2_003_000)?.sessionId).toBe('neuve')
    expect(sessionDuProjet([neuve], 'autre', null)).toBeNull()
  })
})

describe('boucles en cours pour l’accueil', () => {
  const etapeDe = (e: string | undefined) => ['recherche', 'concept', 'test', 'controle', 'humain'].indexOf(e ?? '')
  const S = (sessionId: string, status: string, waiting = false, startedAt = 0) => ({ sessionId, status, waiting, startedAt, last_claude: '**Verdict** : `reboucler`', age_s: 90 })

  it('une ligne par projet, ceux qui attendent d’abord', () => {
    const lignes = bouclesEnCours({ a: 'boite', b: 'support', c: '', d: 'lampe' }, { boite: { numero: 2, etape: 'test' }, support: { numero: 6, etape: 'controle' } },
      [S('a', 'busy'), S('b', 'idle', true), S('c', 'busy'), S('d', 'shell'), S('x', 'busy')], etapeDe)
    expect(lignes.map((l) => [l.modele, l.phase, l.etape, l.numero])).toEqual([['support', 'attend', 3, 6], ['boite', 'travaille', 2, 2], ['lampe', 'pause', 0, null]])
    expect(lignes[0].dit).toBe('Verdict : reboucler')
    expect(lignes[0]).not.toHaveProperty('startedAt')
  })

  it('deux sessions sur le même projet font une seule ligne, la plus urgente', () => {
    const lignes = bouclesEnCours({ a: 'boite', b: 'boite' }, { boite: { numero: 2, etape: 'test' } }, [S('a', 'busy'), S('b', 'idle', true)], etapeDe)
    expect(lignes.map((l) => [l.sessionId, l.phase, l.sessions])).toEqual([['b', 'attend', 2]])
  })

  it('un verdict rendu se lit « terminé » même si la session vit encore', () => {
    expect(bouclesEnCours({ a: 'boite' }, { boite: { numero: 3, etape: 'humain' } }, [S('a', 'idle')], etapeDe)[0].phase).toBe('finie')
  })

  it('rien quand aucune session ne boucle', () => {
    expect(bouclesEnCours({}, {}, [S('a', 'busy')], etapeDe)).toEqual([])
  })
})
