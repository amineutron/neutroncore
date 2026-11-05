// Liaison de DJ Light avec les vraies lampes : met huebeat en route (API), ouvre le canal de trames (WebSocket) et y pousse
// une trame par image. Sans React, avec ses dépendances injectées, pour être testée avec de faux sockets.
//
// Latence : une trame en retard ne sert à rien, la suivante arrive dans 33 ms. Si le canal a du retard (tampon du socket
// non vidé), la trame est ABANDONNÉE plutôt que mise en file : la file est ce qui ferait glisser les lampes derrière le son.

import { lireCanaux, type Canal, type CanauxPlan } from './djLampes'

export type PhaseLiaison = 'arret' | 'demarrage' | 'actif' | 'erreur'
export type EtatLiaison = { phase: PhaseLiaison; message: string; canaux: Canal[]; envoyees: number; perdues: number; abandonnees: number }
export const LIAISON_ARRETEE: EtatLiaison = { phase: 'arret', message: '', canaux: [], envoyees: 0, perdues: 0, abandonnees: 0 }

export type ReponseReel = { success: boolean; error?: string | null; canaux?: CanauxPlan; manquants?: string[]; zone?: string }
export type SocketLike = {
  readyState: number
  bufferedAmount: number
  send: (donnees: string | ArrayBufferLike | ArrayBufferView) => void
  close: () => void
  onopen: (() => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev: { code: number }) => void) | null
  onerror: (() => void) | null
}
export type Dependances = {
  reel: (actif: boolean) => Promise<ReponseReel>
  ouvrir: () => SocketLike
  cle: () => string
  surEtat: (e: EtatLiaison) => void
  retardReconnexionMs?: number
}

export const CODE_REFUS = 4401
export const CODE_REMPLACE = 4000
const OUVERT = 1
const TAMPON_MAX = 512          // octets en attente : au-delà (soit ~70 canaux), le canal a du retard, on abandonne la trame

export class LiaisonLampes {
  private etat: EtatLiaison = LIAISON_ARRETEE
  private ws: SocketLike | null = null
  private voulu = false
  private pret = false
  private essai = 0
  private minuteur: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly d: Dependances) {}

  get phase(): PhaseLiaison { return this.etat.phase }
  get canaux(): Canal[] { return this.etat.canaux }
  /** Vrai quand une trame envoyée maintenant partirait vraiment. */
  get prete(): boolean { return this.pret && this.ws !== null && this.ws.readyState === OUVERT }

  private poser(p: Partial<EtatLiaison>): void {
    this.etat = { ...this.etat, ...p }
    this.d.surEtat(this.etat)
  }

  async demarrer(): Promise<void> {
    if (this.voulu) return
    this.voulu = true
    this.poser({ ...LIAISON_ARRETEE, phase: 'demarrage', message: 'mise en route de huebeat…' })
    let res: ReponseReel
    try { res = await this.d.reel(true) } catch (e) { return this.echec(e instanceof Error ? e.message : 'API injoignable') }
    if (!this.voulu) { void this.d.reel(false).catch(() => {}); return }      // arrêté pendant la mise en route
    if (!res.success) return this.echec(res.error || 'huebeat ne démarre pas')
    const canaux = lireCanaux(res.canaux)
    if (canaux.length === 0) return this.echec('aucun canal lumineux placé dans la pièce')
    this.poser({ canaux, message: 'ouverture du canal de trames…' })
    this.connecter()
  }

  private echec(message: string): void {
    this.voulu = false
    this.fermerSocket()
    this.poser({ phase: 'erreur', message })
  }

  private connecter(): void {
    if (!this.voulu) return
    this.pret = false
    let ws: SocketLike
    try { ws = this.d.ouvrir() } catch (e) { return this.echec(e instanceof Error ? e.message : 'canal de trames impossible à ouvrir') }
    this.ws = ws
    ws.onopen = () => ws.send(JSON.stringify({ cle: this.d.cle() }))
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return
      let m: { type?: string; envoyees?: number; perdues?: number }
      try { m = JSON.parse(ev.data) } catch { return }
      if (m.type === 'pret') {
        this.pret = true
        this.essai = 0
        this.poser({ phase: 'actif', message: '' })
      } else if (m.type === 'etat') {
        const perdues = Number(m.perdues) || 0, envoyees = Number(m.envoyees) || 0
        // rien n'est arrivé jusqu'à huebeat : il n'écoute pas (arrêté, ou version sans flux direct)
        this.poser({ envoyees, perdues, message: envoyees === 0 && perdues > 0 ? 'huebeat n’écoute pas le flux de DJ Light' : '' })
      }
    }
    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.ws = null
      this.pret = false
      if (!this.voulu) return
      if (ev.code === CODE_REFUS) return this.echec('clé API refusée par le canal de trames')
      if (ev.code === CODE_REMPLACE) return this.echec('un autre onglet pilote les lampes')
      // liaison perdue (API redémarrée, réseau) : on reprend, huebeat garde les lampes quelques secondes
      this.essai += 1
      this.poser({ phase: 'demarrage', message: 'liaison perdue, reconnexion…' })
      const retard = this.d.retardReconnexionMs ?? Math.min(5000, 500 * this.essai)
      this.minuteur = setTimeout(() => { this.minuteur = null; this.connecter() }, retard)
    }
    ws.onerror = () => { /* la fermeture qui suit dit pourquoi */ }
  }

  /** Pousse une trame. Faux si elle n'est pas partie (liaison pas prête, ou canal en retard). */
  envoyer(trame: Uint8Array): boolean {
    const ws = this.ws
    if (!this.pret || !ws || ws.readyState !== OUVERT) return false
    if (ws.bufferedAmount > TAMPON_MAX) { this.etat = { ...this.etat, abandonnees: this.etat.abandonnees + 1 }; return false }
    try { ws.send(trame) } catch { return false }
    return true
  }

  private fermerSocket(): void {
    if (this.minuteur !== null) { clearTimeout(this.minuteur); this.minuteur = null }
    const ws = this.ws
    this.ws = null
    this.pret = false
    if (ws) { ws.onclose = null; try { ws.close() } catch { /* déjà fermé */ } }
  }

  /** Rend les lampes : ferme le canal puis demande à l'API d'arrêter huebeat (les lampes reprennent leur état d'avant). */
  async arreter(): Promise<void> {
    const avant = this.etat.phase
    this.voulu = false
    this.fermerSocket()
    this.poser({ ...LIAISON_ARRETEE })
    if (avant === 'arret') return                  // rien n'avait été lancé
    try { await this.d.reel(false) } catch { /* l'API rendra les lampes d'elle-même au bout de quelques secondes */ }
  }
}
