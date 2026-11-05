// DJ Light : le moteur qui relie la musique aux couches (testé dans djMoteur.test.ts).
// `pousser` reçoit chaque image du moteur audio (une trentaine par seconde) et tient à jour signaux, tonalité, tempo,
// horloge et détection de drop. `lumiere` est appelée à chaque image de l'écran : elle lisse le signal de chaque rangée,
// déclenche les scènes, applique la pile et rend de quoi dessiner. Aucun réseau, aucune horloge cachée : le temps est passé.
import type { Commun, Dims, Scene } from './spatialFx'
import { TEMPS_PAR_MESURE } from './spatialFx'
import {
  DROP_VIDE, HORLOGE_DEPART, SUIVI_CLE_VIDE, avancerCle, avancerDrop, avancerHorloge, recalerSurAttaque, suivreTempo, tempoDepuisAttaques,
  type Cle, type EtatDrop, type Horloge, type PhaseDrop, type SuiviCle,
} from './djAnalyse'
import {
  ECART_CHALEUR_MINI, ECART_LARGEUR_MINI, ECART_VOLUME_MINI, ECHELLE_CHALEUR_DEPART, ECHELLE_LARGEUR_DEPART, ECHELLE_VIDE, ECHELLE_VOLUME_DEPART, SIGNAUX_NULS, avancerSignaux, bornesEchelle, pousserEchelle, suivre,
  type Echelle, type ImageAudio, type Signaux,
} from './djSignaux'
import { appliquer, versParams, type Couche, type Profil, type Sortie } from './djCouches'
import { HISTORIQUE_VIDE, ajouterFlux, estimerCycle, positionDansMesure, type CycleEstime, type HistoriqueFlux } from './djCycle'
import { REGLAGES_DEFAUT, avanceMs, vitesseOnde, type ReglagesDj } from './djReglages'

const modulo = (a: number, n: number): number => ((a % n) + n) % n

export type Lecture = {
  signaux: Signaux
  cle: Cle | null
  scoreCle: number
  bpm: number
  bpmSur: boolean                       // le tempo vient de la musique (ou de la main), pas du réglage de départ
  bpmMain: boolean                      // le tempo a été imposé à la main
  phase: PhaseDrop
  montee: number
  beat: number                          // temps musical, en pulsations
  source: 'cycle' | 'grosses caisses' | 'main' | null     // d'où vient le tempo
  cycle: { bpm: number; mesure: 3 | 4; confiance: number } | null     // le dernier cycle trouvé (même s'il n'a pas pris la main)
  enMain: boolean                       // le cycle mène le tempo
  temps: number | null                  // où l'on en est dans la mesure, de 1 à 3 ou 4 (null : premier temps pas encore trouvé)
}
export type Lumiere = { sortie: Sortie; beat: number; acts: Record<string, number>; declenches: Record<string, string>; valeurs: Record<string, number> }
export type Contexte = { profil: Profil; scene: Scene; scenes: Scene[]; commun: Commun; dims: Dims }

/** Constante de temps (s) d'une rangée selon son réglage de lissage (0..100) : 0 réagit d'un coup, 100 met 1,5 s à retomber. */
export const tauDeLissage = (lissage: number): number => (Math.min(100, Math.max(0, lissage)) / 100) * 1.5

export class DjMoteur {
  private signaux: Signaux = SIGNAUX_NULS
  private suiviCle: SuiviCle = SUIVI_CLE_VIDE
  private etatDrop: EtatDrop = DROP_VIDE
  private horloge: Horloge = HORLOGE_DEPART
  private bpmSur = false
  private bpmMain: number | null = null
  private desaccords = 0
  private kicks: number[] = []
  private montee = 0
  private derniereImage = -1
  private dernierPush = 0                // instant (ms) du dernier `pousser`, pour avancer l'horloge entre deux images
  private echVolume: Echelle = ECHELLE_VIDE
  private echChaleur: Echelle = ECHELLE_VIDE
  private echLargeur: Echelle = ECHELLE_VIDE
  private lisses = new Map<string, number>()
  private declenches = new Map<string, { scene: string; fin: number }>()
  private partis = new Set<string>()
  private derniereLecture = -1
  private beatVisuel = 0
  private beatMusPrecedent = 0
  private visuelCale = false
  private dette = 0                      // ce qu'il reste à rattraper d'un recalage de l'horloge (en temps des effets)
  private reglages: ReglagesDj = REGLAGES_DEFAUT
  private hist: HistoriqueFlux = HISTORIQUE_VIDE
  private cycle: CycleEstime | null = null
  private dernierCalcul = -1e9
  private desaccordsCycle = 0
  private barre = false                  // le premier temps de la mesure est connu : les multiples de la mesure sont ses « un »
  private dernierTempoKicks: number | null = null    // le dernier tempo sûr donné par les grosses caisses : un indice pour le cycle
  private dernierTemps1 = -1
  private source: Lecture['source'] = null

  /** Applique de nouveaux réglages d'analyse et de latence (à chaud). */
  regler(r: ReglagesDj): void {
    const cycleAvant = this.reglages.cycle
    this.reglages = r
    if (!r.cycle.actif || r.cycle.mesure !== cycleAvant.mesure) { this.cycle = null; this.barre = false; this.desaccordsCycle = 0 }
    if (!r.cycle.actif && this.source === 'cycle') this.source = this.bpmSur ? 'grosses caisses' : null
  }

  /** Le cycle mène-t-il le tempo ? Il le faut actif, sûr de lui (au-dessus du seuil) et le tempo non imposé à la main. */
  private cycleEnMain(): boolean {
    return this.reglages.cycle.actif && this.bpmMain === null && this.cycle !== null && this.cycle.confiance >= this.reglages.cycle.seuil
  }

  /** Une image de plus du moteur audio. Rend ce qui vient d'arriver, pour faire avancer un set. */
  pousser(img: ImageAudio, maintenantMs: number): { drop: boolean; kick: boolean } {
    const dt = this.derniereImage < 0 ? 1 / 30 : Math.min(0.2, Math.max(0.005, img.t - this.derniereImage))
    this.derniereImage = img.t
    this.dernierPush = maintenantMs
    if (img.kick.on) this.kicks = [...this.kicks.filter((t) => img.t - t < 20), img.t]
    const cycleActif = this.reglages.cycle.actif
    if (cycleActif) this.hist = ajouterFlux(this.hist, img.spec, img.t, this.reglages.cycle.fenetreS)
    const beatAvant = this.horloge.beat
    let h = avancerHorloge(this.horloge, dt)
    if (img.kick.on) {
      h = recalerSurAttaque(h)
      if (this.bpmMain === null) {
        const mesure = tempoDepuisAttaques(this.kicks)
        if (mesure && mesure.confiance >= 0.6) this.dernierTempoKicks = mesure.bpm
        if (!this.cycleEnMain() && mesure && mesure.confiance >= (this.bpmSur ? 0.5 : 0.4)) { h = this.accorderTempo(h, mesure); this.source = 'grosses caisses' }     // un premier calage se contente de moins
      }
    }
    if (cycleActif && this.bpmMain === null && img.t - this.dernierCalcul >= 0.5) { this.dernierCalcul = img.t; h = this.majCycle(h, img.t) }
    this.horloge = this.bpmMain !== null ? { ...h, bpm: this.bpmMain } : h
    const temps1 = this.premierTemps(beatAvant, this.horloge.beat)
    if (!img.silence) this.suiviCle = avancerCle(this.suiviCle, img.chroma, dt, img.t)
    const d = avancerDrop(this.etatDrop, { basses: this.signaux.basses, volume: this.signaux.volume, lufs: img.lufs.s, lufsM: img.lufs.m, kick: img.kick.on, snare: img.snare.on }, dt, img.t)
    this.etatDrop = d.etat
    this.montee = d.montee
    const cle = this.suiviCle.cle
    if (!img.silence) {
      this.echVolume = pousserEchelle(this.echVolume, img.lufs.s, img.t)
      if (img.centroide > 0) this.echChaleur = pousserEchelle(this.echChaleur, Math.log2(img.centroide), img.t)
      this.echLargeur = pousserEchelle(this.echLargeur, 1 - img.corr, img.t)
    }
    this.signaux = avancerSignaux(this.signaux, img, dt, {
      mineur: cle ? cle.mineur : null, tonique: cle ? cle.tonique : null, confianceCle: this.suiviCle.score,
      bpm: this.bpmSur ? this.horloge.bpm : null, montee: d.montee, drop: d.drop, temps1,
      echelles: { volume: bornesEchelle(this.echVolume, ECHELLE_VOLUME_DEPART, ECART_VOLUME_MINI), chaleur: bornesEchelle(this.echChaleur, ECHELLE_CHALEUR_DEPART, ECART_CHALEUR_MINI),
        largeur: bornesEchelle(this.echLargeur, ECHELLE_LARGEUR_DEPART, ECART_LARGEUR_MINI) },
    })
    return { drop: d.drop, kick: img.kick.on }
  }

  /** Un calcul du cycle. S'il est sûr de lui, il mène le tempo : pris d'un coup la première fois, suivi en douceur ensuite, et
   * un autre tempo ne l'emporte qu'après trois calculs d'affilée (1,5 s) pour ne pas sauter d'un tempo à son double. */
  private majCycle(h: Horloge, t: number): Horloge {
    const est = estimerCycle(this.hist, this.reglages.cycle, { indice: this.dernierTempoKicks, bpm: this.source === 'cycle' ? h.bpm : null, mesure: this.cycle?.mesure ?? null, kicksParS: this.kicks.filter((k) => t - k < 14).length / 14 })
    this.cycle = est
    if (!est || est.confiance < this.reglages.cycle.seuil) { this.desaccordsCycle = 0; return h }
    const ecart = Math.abs(est.bpm / h.bpm - 1)
    let bpm = h.bpm
    if (!this.bpmSur || this.source !== 'cycle') bpm = est.bpm
    else if (ecart <= 0.04) { this.desaccordsCycle = 0; bpm = h.bpm + (est.bpm - h.bpm) * 0.3 }
    else {
      // le double, la moitié ou les deux tiers ressemblent par construction : il faut 6 s d'affilée pour changer ; un autre tempo, 1,5 s
      const voisin = [0.5, 2, 2 / 3, 1.5].some((k) => Math.abs(est.bpm / h.bpm - k) < 0.04)
      if (++this.desaccordsCycle >= (voisin ? 12 : 3)) { this.desaccordsCycle = 0; bpm = est.bpm }
    }
    this.bpmSur = true
    this.source = 'cycle'
    return { bpm, beat: this.caler(est, h.beat, t) }
  }

  /** Cale l'horloge sur la grille de la mesure : ses temps entiers tombent sur les temps de la musique (et, si le « un » ressort,
   * ses multiples de la mesure sur les « un »). Un petit écart se rattrape en douceur, un grand d'un coup. */
  private caler(est: CycleEstime, beat: number, t: number): number {
    if (est.premierTemps === null) return beat
    const pos = positionDansMesure(est.premierTemps, est.bpm, est.mesure, t)
    const barre = est.forceTemps1 >= 1.12
    const pas = barre ? est.mesure : 1, base = barre ? pos : pos - Math.floor(pos)
    const cible = base + pas * Math.round((beat - base) / pas)
    const ecart = cible - beat
    this.barre = barre
    return Math.abs(ecart) > 0.5 ? cible : beat + ecart * 0.3
  }

  /** Vrai à l'image où l'horloge passe sur un premier temps de la mesure. */
  private premierTemps(avant: number, apres: number): boolean {
    if (!this.barre || !this.cycle || !this.cycleEnMain()) return false
    const b = Math.floor(apres)
    if (b <= Math.floor(avant) || b === this.dernierTemps1) return false
    if (modulo(b, this.cycle.mesure) !== 0) return false
    this.dernierTemps1 = b
    return true
  }

  /** Le premier tempo mesuré est pris tel quel (le 120 de départ n'est qu'une valeur par défaut) ; ensuite l'horloge le suit
   * en douceur, sauf si la mesure s'en écarte de plus de 10 % huit fois de suite : le morceau a changé, on saute. */
  private accorderTempo(h: Horloge, mesure: { bpm: number; confiance: number }): Horloge {
    if (!this.bpmSur) { this.bpmSur = true; this.desaccords = 0; return { ...h, bpm: mesure.bpm } }
    this.desaccords = mesure.confiance >= 0.6 && Math.abs(mesure.bpm / h.bpm - 1) > 0.1 ? this.desaccords + 1 : 0
    if (this.desaccords < 8) return suivreTempo(h, mesure)
    this.desaccords = 0
    return { ...h, bpm: mesure.bpm }
  }

  /** Impose un tempo (tape sur l'écran) ; null rend la main à la détection. */
  reglerTempo(bpm: number | null): void {
    this.bpmMain = bpm === null ? null : Math.min(240, Math.max(40, bpm))
    if (this.bpmMain !== null) { this.horloge = { ...this.horloge, bpm: this.bpmMain }; this.bpmSur = true; this.source = 'main' }
    else this.source = this.bpmSur ? 'grosses caisses' : null
  }

  /** Cale le temps en cours sur le temps entier le plus proche (on tape « maintenant, c'est un temps »). */
  recaler(): void {
    this.horloge = { ...this.horloge, beat: Math.round(this.horloge.beat) }
  }

  lecture(maintenantMs: number): Lecture {
    return {
      signaux: this.signaux, cle: this.suiviCle.cle, scoreCle: this.suiviCle.score, bpm: this.horloge.bpm, bpmSur: this.bpmSur, bpmMain: this.bpmMain !== null,
      phase: this.etatDrop.phase, montee: this.montee, beat: this.beatMusical(maintenantMs),
      source: this.source, cycle: this.cycle ? { bpm: this.cycle.bpm, mesure: this.cycle.mesure, confiance: this.cycle.confiance } : null,
      enMain: this.cycleEnMain(),
      temps: this.barre && this.cycle && this.cycleEnMain() ? modulo(Math.floor(this.horloge.beat), this.cycle.mesure) + 1 : null,
    }
  }

  /** Le temps musical à `maintenantMs` : l'horloge de la dernière image, prolongée au tempo jusqu'à maintenant. */
  private beatMusical(maintenantMs: number): number {
    const depuis = this.dernierPush ? Math.min(0.25, Math.max(0, (maintenantMs - this.dernierPush) / 1000)) : 0
    return this.horloge.beat + (depuis * this.horloge.bpm) / 60
  }

  /** Ce qu'il faut montrer à cet instant : la pile appliquée sur les signaux lissés. `scene` peut être absente (rien à jouer). */
  lumiere(maintenantMs: number, ctx: Contexte): Lumiere {
    const dt = this.derniereLecture < 0 ? 0.016 : Math.min(0.1, Math.max(0, (maintenantMs - this.derniereLecture) / 1000))
    this.derniereLecture = maintenantMs
    const beatMus = this.beatMusical(maintenantMs)
    const valeurs: Record<string, number> = {}
    for (const c of ctx.profil.couches) {
      if (!c.signal) continue
      const cible = this.signaux[c.signal]
      const tau = tauDeLissage(c.lissage)
      const avant = this.lisses.get(c.id) ?? cible
      const v = suivre(avant, cible, dt, tau * 0.3, tau)
      this.lisses.set(c.id, v)
      valeurs[c.id] = v
      if (c.genre === 'declencheur') this.surveiller(c, cible, beatMus)
    }
    // les déclencheurs finis ou retirés de la pile s'éteignent
    const ids = new Set(ctx.profil.couches.map((c) => c.id))
    for (const [id, d] of this.declenches) if (!ids.has(id) || beatMus >= d.fin) this.declenches.delete(id)
    const declenches = Object.fromEntries([...this.declenches].map(([id, d]) => [id, d.scene]))
    const { etat, acts } = appliquer({ profil: ctx.profil, valeurs, scene: ctx.scene, scenes: ctx.scenes, commun: ctx.commun, declenches, ondeBase: vitesseOnde(this.reglages) })
    const sortie = versParams(etat, ctx.dims, ctx.commun)
    // le temps des effets avance au rythme choisi par la pile : un changement de vitesse ne fait pas sauter l'animation
    if (!this.visuelCale) { this.visuelCale = true; this.beatVisuel = beatMus; this.beatMusPrecedent = beatMus }      // départ : sur l'horloge, pas sur 0
    // un recalage de l'horloge (le cycle trouve la mesure) peut sauter de plusieurs temps : on l'étale sur ~0,2 s au lieu de le subir d'un coup
    const attendu = (dt * this.horloge.bpm) / 60, delta = beatMus - this.beatMusPrecedent
    const saut = Math.abs(delta - attendu) > 0.5 ? delta - attendu : 0
    this.dette += saut * sortie.tempoK
    this.beatVisuel += (saut ? attendu : Math.max(0, delta)) * sortie.tempoK
    const pas = Math.max(-0.1, Math.min(0.1, this.dette))
    this.beatVisuel += pas
    this.dette -= pas
    // à vitesse normale, les temps entiers des effets restent ceux de l'horloge (donc des grosses caisses) : un rattrapage doux
    if (Math.abs(sortie.tempoK - 1) < 0.02) {
      const ecart = beatMus - this.beatVisuel
      this.beatVisuel += (ecart - Math.round(ecart)) * Math.min(1, dt * 2)
    }
    this.beatMusPrecedent = beatMus
    // l'avance : la lumière part un peu avant le temps de l'horloge, pour absorber capture, réseau et ampoules
    const avance = ((avanceMs(this.reglages) / 1000) * this.horloge.bpm) / 60 * sortie.tempoK
    return { sortie, beat: this.beatVisuel + avance, acts, declenches, valeurs }
  }

  /** Un déclencheur part quand son signal franchit le seuil vers le haut ; il peut repartir quand le signal retombe à moitié du seuil. */
  private surveiller(c: Couche, signal: number, beatMus: number): void {
    const seuil = Math.max(0.05, c.seuil / 100)
    if (signal >= seuil && !this.partis.has(c.id) && !this.declenches.has(c.id) && c.scene && c.force > 0 && c.actif) {
      this.partis.add(c.id)
      this.declenches.set(c.id, { scene: c.scene, fin: beatMus + Math.max(1, c.mesures) * TEMPS_PAR_MESURE })
    } else if (signal < seuil * 0.5) this.partis.delete(c.id)
  }

  /** Remet tout à zéro (changement de source, de morceau). Le tempo imposé à la main est gardé. */
  reinitialiser(): void {
    this.signaux = SIGNAUX_NULS
    this.suiviCle = SUIVI_CLE_VIDE
    this.etatDrop = DROP_VIDE
    this.kicks = []
    this.montee = 0
    this.derniereImage = -1
    this.echVolume = ECHELLE_VIDE
    this.echChaleur = ECHELLE_VIDE
    this.echLargeur = ECHELLE_VIDE
    this.desaccords = 0
    this.visuelCale = false
    this.dette = 0
    this.hist = HISTORIQUE_VIDE
    this.cycle = null
    this.dernierCalcul = -1e9
    this.desaccordsCycle = 0
    this.barre = false
    this.dernierTempoKicks = null
    this.dernierTemps1 = -1
    this.source = this.bpmMain !== null ? 'main' : null
    this.lisses = new Map()
    this.declenches = new Map()
    this.partis = new Set()
    this.bpmSur = this.bpmMain !== null
    this.horloge = { ...HORLOGE_DEPART, bpm: this.bpmMain ?? HORLOGE_DEPART.bpm }
  }
}
