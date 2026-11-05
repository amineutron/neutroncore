import { describe, expect, it, vi } from 'vitest'
import { CODE_REFUS, CODE_REMPLACE, type SocketLike } from './djLiaison'
import { LIAISON_AMBILIGHT_ARRETEE, LiaisonAmbilight, type EtatAmbilight } from './djLiaisonAmbilight'

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
  close() { this.ferme = true }
  ouvrir() { this.readyState = 1; this.onopen?.() }
  recevoir(o: unknown) { this.onmessage?.({ data: JSON.stringify(o) }) }
  couper(code: number) { this.readyState = 3; this.onclose?.({ code }) }
}

function monter(reponse: { success: boolean; error?: string | null } = { success: true }) {
  const sockets: FauxSocket[] = []
  const etats: EtatAmbilight[] = []
  const demarrer = vi.fn(async () => reponse)
  const arreter = vi.fn(async () => ({}))
  const liaison = new LiaisonAmbilight({
    demarrer, arreter, cle: () => 'CLE', surEtat: (e) => etats.push(e), retardReconnexionMs: 0,
    ouvrir: () => { const s = new FauxSocket(); sockets.push(s); return s },
  })
  return { liaison, sockets, etats, demarrer, arreter, dernier: () => etats[etats.length - 1] }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('LiaisonAmbilight', () => {
  it('démarre : demande à l’API, ouvre le canal, envoie la clé, devient active au « pret »', async () => {
    const m = monter()
    await m.liaison.demarrer('cached')
    expect(m.demarrer).toHaveBeenCalledWith('cached')
    expect(m.sockets).toHaveLength(1)
    m.sockets[0].ouvrir()
    expect(JSON.parse(m.sockets[0].envoyes[0] as string)).toEqual({ cle: 'CLE' })
    expect(m.liaison.prete).toBe(false)
    m.sockets[0].recevoir({ type: 'pret' })
    expect(m.liaison.prete).toBe(true)
    expect(m.dernier().phase).toBe('actif')
    expect(m.dernier().voie).toBe('cached')
  })
  it('un refus de l’API (Ambilight éteint…) est dit, sans ouvrir de canal', async () => {
    const m = monter({ success: false, error: 'Ambilight éteint' })
    await m.liaison.demarrer('lounge')
    expect(m.dernier().phase).toBe('erreur')
    expect(m.dernier().message).toContain('Ambilight éteint')
    expect(m.sockets).toHaveLength(0)
  })
  it('API injoignable : erreur lisible', async () => {
    const m = monter()
    m.demarrer.mockRejectedValueOnce(new Error('réseau'))
    await m.liaison.demarrer('cached')
    expect(m.dernier().phase).toBe('erreur')
    expect(m.dernier().message).toContain('réseau')
  })
  it('envoie « r,g,b » en texte, valeurs entières bornées à 0..255', async () => {
    const m = monter()
    await m.liaison.demarrer('cached')
    m.sockets[0].ouvrir(); m.sockets[0].recevoir({ type: 'pret' })
    expect(m.liaison.envoyer({ r: 255, g: 140.4, b: 40 })).toBe(true)
    expect(m.liaison.envoyer({ r: 999, g: -5, b: Number.NaN })).toBe(true)
    expect(m.sockets[0].envoyes.slice(1)).toEqual(['255,140,40', '255,0,0'])
  })
  it('n’envoie rien tant que la liaison n’est pas prête', async () => {
    const m = monter()
    expect(m.liaison.envoyer({ r: 1, g: 2, b: 3 })).toBe(false)
    await m.liaison.demarrer('cached')
    expect(m.liaison.envoyer({ r: 1, g: 2, b: 3 })).toBe(false)
  })
  it('abandonne une valeur plutôt que de la mettre en file quand le canal a du retard', async () => {
    const m = monter()
    await m.liaison.demarrer('cached')
    m.sockets[0].ouvrir(); m.sockets[0].recevoir({ type: 'pret' })
    m.sockets[0].bufferedAmount = 4096
    expect(m.liaison.envoyer({ r: 1, g: 2, b: 3 })).toBe(false)
    expect(m.sockets[0].envoyes).toHaveLength(1)           // seulement la clé
  })
  it('relaie les compteurs de l’API', async () => {
    const m = monter()
    await m.liaison.demarrer('cached')
    m.sockets[0].ouvrir(); m.sockets[0].recevoir({ type: 'pret' })
    m.sockets[0].recevoir({ type: 'etat', envoyees: 40, abandonnees: 12, erreurs: 1, ms: 31.5, ignorees: 0 })
    expect(m.dernier()).toMatchObject({ envoyees: 40, abandonnees: 12, erreurs: 1, ms: 31.5 })
  })
  it('une erreur de la TV remonte et arrête la liaison', async () => {
    const m = monter()
    await m.liaison.demarrer('cached')
    m.sockets[0].ouvrir(); m.sockets[0].recevoir({ type: 'pret' })
    m.sockets[0].recevoir({ type: 'erreur', message: 'la télé ne répond plus' })
    expect(m.dernier().phase).toBe('erreur')
    expect(m.dernier().message).toContain('la télé ne répond plus')
    expect(m.liaison.prete).toBe(false)
  })
  it('clé refusée ou autre onglet : erreur claire, pas de reconnexion', async () => {
    const m = monter()
    await m.liaison.demarrer('cached')
    m.sockets[0].ouvrir(); m.sockets[0].recevoir({ type: 'pret' })
    m.sockets[0].couper(CODE_REFUS)
    expect(m.dernier().phase).toBe('erreur')
    expect(m.dernier().message).toContain('clé')
    const n = monter()
    await n.liaison.demarrer('cached')
    n.sockets[0].ouvrir(); n.sockets[0].recevoir({ type: 'pret' })
    n.sockets[0].couper(CODE_REMPLACE)
    expect(n.dernier().message).toContain('autre onglet')
    await tick()
    expect(n.sockets).toHaveLength(1)
  })
  it('liaison perdue : se reconnecte', async () => {
    const m = monter()
    await m.liaison.demarrer('cached')
    m.sockets[0].ouvrir(); m.sockets[0].recevoir({ type: 'pret' })
    m.sockets[0].couper(1006)
    expect(m.dernier().phase).toBe('demarrage')
    await tick()
    expect(m.sockets).toHaveLength(2)
  })
  it('arrêter ferme le canal, demande à l’API de restaurer l’Ambilight, et remet l’état à zéro', async () => {
    const m = monter()
    await m.liaison.demarrer('cached')
    m.sockets[0].ouvrir(); m.sockets[0].recevoir({ type: 'pret' })
    await m.liaison.arreter()
    expect(m.sockets[0].ferme).toBe(true)
    expect(m.arreter).toHaveBeenCalledTimes(1)
    expect(m.dernier()).toEqual(LIAISON_AMBILIGHT_ARRETEE)
    expect(m.liaison.prete).toBe(false)
  })
  it('arrêter sans avoir rien lancé ne dérange pas l’API', async () => {
    const m = monter()
    await m.liaison.arreter()
    expect(m.arreter).not.toHaveBeenCalled()
  })
  it('arrêté pendant la mise en route : l’API est remise en état et aucun canal ne reste ouvert', async () => {
    const m = monter()
    let finir: (v: { success: boolean }) => void = () => {}
    m.demarrer.mockImplementationOnce(() => new Promise((r) => { finir = r }))
    const p = m.liaison.demarrer('cached')
    await m.liaison.arreter()
    finir({ success: true })
    await p
    expect(m.sockets).toHaveLength(0)
    expect(m.arreter).toHaveBeenCalled()
  })
  it('ne démarre pas deux fois', async () => {
    const m = monter()
    await m.liaison.demarrer('cached')
    await m.liaison.demarrer('cached')
    expect(m.demarrer).toHaveBeenCalledTimes(1)
  })
})
