// Liaison de DJ Light avec l'Ambilight de la télé : demande à l'API de préparer la télé, ouvre le canal de niveaux (WebSocket)
// et y pousse « r,g,b » en texte. Sans React, dépendances injectées, testée avec de faux sockets (djLiaisonAmbilight.test.ts).
//
// Comme pour les lampes, une valeur en retard ne sert à rien : si le canal a du retard elle est ABANDONNÉE, jamais mise en
// file. La télé, elle, ne reçoit que la dernière valeur (l'API garde une seule requête en vol).
import { CODE_REFUS, CODE_REMPLACE, type SocketLike } from './djLiaison'
import type { VoieAmbilight } from './djAmbilight'

export type PhaseAmbilight = 'arret' | 'demarrage' | 'actif' | 'erreur'
export type EtatAmbilight = {
  phase: PhaseAmbilight; message: string; voie: VoieAmbilight | null
  envoyees: number; abandonnees: number; erreurs: number; ms: number | null
}
export const LIAISON_AMBILIGHT_ARRETEE: EtatAmbilight = { phase: 'arret', message: '', voie: null, envoyees: 0, abandonnees: 0, erreurs: 0, ms: null }

export type ReponseAmbilight = { success: boolean; error?: string | null }
export type DependancesAmbilight = {
  demarrer: (voie: VoieAmbilight) => Promise<ReponseAmbilight>
  arreter: () => Promise<unknown>
  ouvrir: () => SocketLike
  cle: () => string
  surEtat: (e: EtatAmbilight) => void
  retardReconnexionMs?: number
}

const OUVERT = 1
const TAMPON_MAX = 64          // octets en attente : un message « r,g,b » en fait onze, au-delà le canal a du retard
const borne = (v: number): number => (Number.isFinite(v) ? Math.min(255, Math.max(0, Math.round(v))) : 0)

export class LiaisonAmbilight {
  private etat: EtatAmbilight = LIAISON_AMBILIGHT_ARRETEE
  private ws: SocketLike | null = null
  private voulu = false
  private pret = false
  private essai = 0
  private minuteur: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly d: DependancesAmbilight) {}

  get phase(): PhaseAmbilight { return this.etat.phase }
  /** Vrai quand une valeur envoyée maintenant partirait vraiment. */
  get prete(): boolean { return this.pret && this.ws !== null && this.ws.readyState === OUVERT }

  private poser(p: Partial<EtatAmbilight>): void {
    this.etat = { ...this.etat, ...p }
    this.d.surEtat(this.etat)
  }

  async demarrer(voie: VoieAmbilight): Promise<void> {
    if (this.voulu) return
    this.voulu = true
    this.poser({ ...LIAISON_AMBILIGHT_ARRETEE, phase: 'demarrage', message: 'mise en route de l’Ambilight…', voie })
    let res: ReponseAmbilight
    try { res = await this.d.demarrer(voie) } catch (e) { return this.echec(e instanceof Error ? e.message : 'API injoignable') }
    if (!this.voulu) { void this.d.arreter().catch(() => {}); return }      // arrêté pendant la mise en route
    if (!res.success) return this.echec(res.error || 'la télé n’a pas accepté le pilotage')
    this.poser({ message: 'ouverture du canal…' })
    this.connecter()
  }

  private echec(message: string): void {
    this.voulu = false
    this.fermerSocket()
    this.poser({ phase: 'erreur', message })
    void this.d.arreter().catch(() => {})            // rend à la télé son style d'avant, quoi qu'il se soit passé
  }

  private connecter(): void {
    if (!this.voulu) return
    this.pret = false
    let ws: SocketLike
    try { ws = this.d.ouvrir() } catch (e) { return this.echec(e instanceof Error ? e.message : 'canal impossible à ouvrir') }
    this.ws = ws
    ws.onopen = () => ws.send(JSON.stringify({ cle: this.d.cle() }))
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return
      let m: { type?: string; envoyees?: number; abandonnees?: number; erreurs?: number; ms?: number | null; message?: string }
      try { m = JSON.parse(ev.data) } catch { return }
      if (m.type === 'pret') {
        this.pret = true
        this.essai = 0
        this.poser({ phase: 'actif', message: '' })
      } else if (m.type === 'etat') {
        this.poser({ envoyees: Number(m.envoyees) || 0, abandonnees: Number(m.abandonnees) || 0, erreurs: Number(m.erreurs) || 0, ms: typeof m.ms === 'number' ? m.ms : null })
      } else if (m.type === 'erreur') {
        this.echec(m.message || 'la télé ne répond plus')
      }
    }
    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.ws = null
      this.pret = false
      if (!this.voulu) return
      if (ev.code === CODE_REFUS) return this.echec('clé API refusée par le canal de l’Ambilight')
      if (ev.code === CODE_REMPLACE) return this.echec('un autre onglet pilote l’Ambilight')
      this.essai += 1
      this.poser({ phase: 'demarrage', message: 'liaison perdue, reconnexion…' })
      const retard = this.d.retardReconnexionMs ?? Math.min(5000, 500 * this.essai)
      this.minuteur = setTimeout(() => { this.minuteur = null; this.connecter() }, retard)
    }
    ws.onerror = () => { /* la fermeture qui suit dit pourquoi */ }
  }

  /** Pousse une couleur. Faux si elle n'est pas partie (liaison pas prête, ou canal en retard). */
  envoyer(c: { r: number; g: number; b: number }): boolean {
    const ws = this.ws
    if (!this.pret || !ws || ws.readyState !== OUVERT) return false
    if (ws.bufferedAmount > TAMPON_MAX) { this.etat = { ...this.etat, abandonnees: this.etat.abandonnees + 1 }; return false }
    try { ws.send(`${borne(c.r)},${borne(c.g)},${borne(c.b)}`) } catch { return false }
    return true
  }

  private fermerSocket(): void {
    if (this.minuteur !== null) { clearTimeout(this.minuteur); this.minuteur = null }
    const ws = this.ws
    this.ws = null
    this.pret = false
    if (ws) { ws.onclose = null; try { ws.close() } catch { /* déjà fermé */ } }
  }

  /** Rend la télé : ferme le canal puis demande à l'API de restaurer le style d'Ambilight d'avant. */
  async arreter(): Promise<void> {
    const avant = this.etat.phase
    this.voulu = false
    this.fermerSocket()
    this.poser({ ...LIAISON_AMBILIGHT_ARRETEE })
    if (avant === 'arret') return
    try { await this.d.arreter() } catch { /* l'API rendra la télé d'elle-même au bout de quelques secondes */ }
  }
}
