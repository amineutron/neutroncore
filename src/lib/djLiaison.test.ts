import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CODE_REFUS, CODE_REMPLACE, LiaisonLampes, type EtatLiaison, type ReponseReel, type SocketLike } from './djLiaison'

class FauxSocket implements SocketLike {
  readyState = 0
  bufferedAmount = 0
  envoyes: unknown[] = []
  ferme = false
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  send(d: unknown) { this.envoyes.push(d) }
  close() { this.ferme = true; this.readyState = 3 }
  // côté serveur
  ouvrir() { this.readyState = 1; this.onopen?.() }
  dire(o: unknown) { this.onmessage?.({ data: JSON.stringify(o) }) }
  tomber(code = 1006) { this.readyState = 3; this.onclose?.({ code }) }
}

const CANAUX = { 0: [-100, 0, 100], 1: [100, 0, 100] }
const OK: ReponseReel = { success: true, canaux: CANAUX, manquants: [] }

function banc(reponse: ReponseReel | Error = OK) {
  const sockets: FauxSocket[] = []
  const appels: boolean[] = []
  const etats: EtatLiaison[] = []
  const l = new LiaisonLampes({
    reel: async (actif) => { appels.push(actif); if (reponse instanceof Error) throw reponse; return actif ? reponse : { success: true } },
    ouvrir: () => { const s = new FauxSocket(); sockets.push(s); return s },
    cle: () => 'ma-cle',
    surEtat: (e) => etats.push(e),
    retardReconnexionMs: 100,
  })
  return { l, sockets, appels, etats, dernier: () => etats[etats.length - 1] }
}

/** Démarre et amène la liaison à l'état actif. */
async function actif(b: ReturnType<typeof banc>) {
  await b.l.demarrer()
  const s = b.sockets[0]
  s.ouvrir()
  s.dire({ type: 'pret' })
  return s
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('mise en route', () => {
  it('demande huebeat à l’API, ouvre le canal, s’annonce avec la clé et devient active au « pret »', async () => {
    const b = banc()
    await b.l.demarrer()
    expect(b.appels).toEqual([true])
    expect(b.dernier().phase).toBe('demarrage')
    const s = b.sockets[0]
    s.ouvrir()
    expect(JSON.parse(s.envoyes[0] as string)).toEqual({ cle: 'ma-cle' })
    expect(b.l.prete).toBe(false)                  // pas avant que l'API ait accepté la clé
    s.dire({ type: 'pret' })
    expect(b.dernier().phase).toBe('actif')
    expect(b.l.prete).toBe(true)
    expect(b.l.canaux.map((c) => c.id)).toEqual([0, 1])
  })
  it('dit pourquoi huebeat ne démarre pas, sans ouvrir de canal', async () => {
    const b = banc({ success: false, error: 'le pont refuse' })
    await b.l.demarrer()
    expect(b.dernier()).toMatchObject({ phase: 'erreur', message: 'le pont refuse' })
    expect(b.sockets).toHaveLength(0)
  })
  it('API injoignable : erreur lisible', async () => {
    const b = banc(new Error('réseau coupé'))
    await b.l.demarrer()
    expect(b.dernier()).toMatchObject({ phase: 'erreur', message: 'réseau coupé' })
  })
  it('aucun canal placé : erreur, pas de canal ouvert', async () => {
    const b = banc({ success: true, canaux: {} })
    await b.l.demarrer()
    expect(b.dernier().phase).toBe('erreur')
    expect(b.sockets).toHaveLength(0)
  })
  it('un second « démarrer » pendant que ça tourne ne relance rien', async () => {
    const b = banc()
    await actif(b)
    await b.l.demarrer()
    expect(b.appels).toEqual([true])
    expect(b.sockets).toHaveLength(1)
  })
  it('on peut relancer après une erreur', async () => {
    const b = banc({ success: false, error: 'non' })
    await b.l.demarrer()
    await b.l.demarrer()
    expect(b.appels).toEqual([true, true])
  })
})

describe('envoi des trames', () => {
  it('envoie la trame telle quelle quand la liaison est prête', async () => {
    const b = banc()
    const s = await actif(b)
    const t = new Uint8Array([1, 2, 3])
    expect(b.l.envoyer(t)).toBe(true)
    expect(s.envoyes[s.envoyes.length - 1]).toBe(t)
  })
  it('n’envoie rien avant que la liaison soit prête', async () => {
    const b = banc()
    await b.l.demarrer()
    b.sockets[0].ouvrir()
    expect(b.l.envoyer(new Uint8Array(7))).toBe(false)
    expect(b.sockets[0].envoyes).toHaveLength(1)           // seulement la clé
  })
  it('abandonne la trame si le canal a du retard, au lieu de la mettre en file', async () => {
    const b = banc()
    const s = await actif(b)
    s.bufferedAmount = 4096
    const avant = s.envoyes.length
    expect(b.l.envoyer(new Uint8Array(7))).toBe(false)
    expect(s.envoyes).toHaveLength(avant)
    s.bufferedAmount = 0
    expect(b.l.envoyer(new Uint8Array(7))).toBe(true)
  })
  it('signale que huebeat n’écoute pas quand rien ne lui arrive', async () => {
    const b = banc()
    const s = await actif(b)
    s.dire({ type: 'etat', envoyees: 0, perdues: 30 })
    expect(b.dernier().message).toContain('huebeat n’écoute pas')
    s.dire({ type: 'etat', envoyees: 30, perdues: 0 })
    expect(b.dernier().message).toBe('')
  })
  it('ignore ce que le canal dit de mal formé', async () => {
    const b = banc()
    const s = await actif(b)
    s.onmessage?.({ data: 'pas du json' })
    s.onmessage?.({ data: new ArrayBuffer(4) })
    expect(b.dernier().phase).toBe('actif')
  })
})

describe('liaison perdue', () => {
  it('se reconnecte toute seule et reprend', async () => {
    const b = banc()
    const s = await actif(b)
    s.tomber()
    expect(b.dernier()).toMatchObject({ phase: 'demarrage', message: 'liaison perdue, reconnexion…' })
    expect(b.l.envoyer(new Uint8Array(7))).toBe(false)
    vi.advanceTimersByTime(150)
    expect(b.sockets).toHaveLength(2)
    b.sockets[1].ouvrir()
    b.sockets[1].dire({ type: 'pret' })
    expect(b.dernier().phase).toBe('actif')
    expect(b.appels).toEqual([true])                       // huebeat n'est pas relancé
  })
  it('clé refusée : erreur définitive, pas de reconnexion en boucle', async () => {
    const b = banc()
    const s = await actif(b)
    s.tomber(CODE_REFUS)
    expect(b.dernier()).toMatchObject({ phase: 'erreur' })
    vi.advanceTimersByTime(10_000)
    expect(b.sockets).toHaveLength(1)
  })
  it('un autre onglet a repris les lampes : erreur définitive', async () => {
    const b = banc()
    const s = await actif(b)
    s.tomber(CODE_REMPLACE)
    expect(b.dernier()).toMatchObject({ phase: 'erreur', message: 'un autre onglet pilote les lampes' })
    vi.advanceTimersByTime(10_000)
    expect(b.sockets).toHaveLength(1)
  })
})

describe('arrêt', () => {
  it('ferme le canal et rend les lampes via l’API', async () => {
    const b = banc()
    const s = await actif(b)
    await b.l.arreter()
    expect(s.ferme).toBe(true)
    expect(b.appels).toEqual([true, false])
    expect(b.dernier().phase).toBe('arret')
    expect(b.l.envoyer(new Uint8Array(7))).toBe(false)
  })
  it('ne se reconnecte pas après un arrêt, même si la fermeture arrive en retard', async () => {
    const b = banc()
    const s = await actif(b)
    await b.l.arreter()
    s.tomber()
    vi.advanceTimersByTime(10_000)
    expect(b.sockets).toHaveLength(1)
  })
  it('arrêter pendant une reconnexion annule la reprise', async () => {
    const b = banc()
    const s = await actif(b)
    s.tomber()
    await b.l.arreter()
    vi.advanceTimersByTime(10_000)
    expect(b.sockets).toHaveLength(1)
  })
  it('arrêter sans rien avoir lancé ne touche pas à l’API', async () => {
    const b = banc()
    await b.l.arreter()
    expect(b.appels).toEqual([])
  })
  it('arrêter après une erreur rend quand même les lampes (huebeat a pu démarrer)', async () => {
    const b = banc({ success: true, canaux: {} })
    await b.l.demarrer()
    await b.l.arreter()
    expect(b.appels).toEqual([true, false])
  })
  it('arrêté pendant la mise en route : huebeat est rendu dès que l’API répond', async () => {
    const sockets: FauxSocket[] = []
    const appels: boolean[] = []
    let debloquer: (r: ReponseReel) => void = () => {}
    const l = new LiaisonLampes({
      reel: (actifOuiNon) => { appels.push(actifOuiNon); return actifOuiNon ? new Promise<ReponseReel>((r) => { debloquer = r }) : Promise.resolve({ success: true }) },
      ouvrir: () => { const s = new FauxSocket(); sockets.push(s); return s },
      cle: () => 'k', surEtat: () => {},
    })
    const demarrage = l.demarrer()
    await l.arreter()
    debloquer(OK)
    await demarrage
    expect(sockets).toHaveLength(0)
    expect(appels.filter((a) => !a).length).toBeGreaterThanOrEqual(1)
  })
})
