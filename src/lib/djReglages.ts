// DJ Light : les réglages d'analyse et de latence (logique pure, testée dans djReglages.test.ts).
// Tout s'active et se règle : chaque bloc a son interrupteur, et un bloc éteint se comporte comme avant (tempo par les grosses
// caisses seules, onde d'origine, aucune avance). Gardés dans le navigateur (jamais envoyés à l'API : ce sont des goûts d'écran).
import { BORNES_CYCLE, CYCLE_DEFAUT, type ReglagesCycle } from './djCycle'

export type ReglagesDj = {
  cycle: ReglagesCycle                          // tempo et mesure par le cycle de la musique
  onde: { actif: boolean; vitesse: number }     // l'onde traverse la pièce `vitesse` fois plus vite (1 : une pulsation entière)
  avance: { actif: boolean; ms: number }        // l'horloge des effets prend de l'avance sur le son, pour absorber capture, réseau et lampes
}
export const BORNES = { ...BORNES_CYCLE, onde: [1, 8], avance: [0, 300] } as const
// onde x6 : à 128 par minute les lampes les plus éloignées s'allument moins de 80 ms après le temps (333 ms avec l'onde d'origine) ;
// avance 60 ms : environ la moitié de ce que coûtent capture, analyse et affichage (à régler à l'oreille : tout dépend de ta sortie audio)
export const REGLAGES_DEFAUT: ReglagesDj = { cycle: CYCLE_DEFAUT, onde: { actif: true, vitesse: 6 }, avance: { actif: true, ms: 60 } }

const borne = (v: unknown, [lo, hi]: readonly [number, number] | readonly number[], defaut: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : defaut
const bool = (v: unknown, defaut: boolean): boolean => (typeof v === 'boolean' ? v : defaut)

/** Réglages lus d'où qu'ils viennent (stockage du navigateur, fichier) : ce qui manque ou déraille reprend la valeur par défaut. */
export function lireReglages(brut: unknown): ReglagesDj {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, Record<string, unknown> | undefined>
  const c = o.cycle ?? {}, w = o.onde ?? {}, a = o.avance ?? {}
  const d = CYCLE_DEFAUT
  const bpmMin = borne(c.bpmMin, BORNES.bpm, d.bpmMin)
  const bpmMax = Math.max(bpmMin + 20, borne(c.bpmMax, BORNES.bpm, d.bpmMax))
  return {
    cycle: {
      actif: bool(c.actif, d.actif),
      mesure: c.mesure === 3 || c.mesure === 4 ? c.mesure : 'auto',
      fenetreS: borne(c.fenetreS, BORNES.fenetreS, d.fenetreS),
      bpmMin, bpmMax,
      centreBpm: borne(c.centreBpm, [bpmMin, bpmMax], Math.min(bpmMax, Math.max(bpmMin, d.centreBpm))),
      seuil: borne(c.seuil, BORNES.seuil, d.seuil),
    },
    onde: { actif: bool(w.actif, REGLAGES_DEFAUT.onde.actif), vitesse: borne(w.vitesse, BORNES.onde, REGLAGES_DEFAUT.onde.vitesse) },
    avance: { actif: bool(a.actif, REGLAGES_DEFAUT.avance.actif), ms: borne(a.ms, BORNES.avance, REGLAGES_DEFAUT.avance.ms) },
  }
}

/** La vitesse de l'onde réellement appliquée : 1 (comportement d'origine) quand le bloc est éteint. */
export const vitesseOnde = (r: ReglagesDj): number => (r.onde.actif ? r.onde.vitesse : 1)
/** L'avance réellement appliquée, en ms : 0 quand le bloc est éteint. */
export const avanceMs = (r: ReglagesDj): number => (r.avance.actif ? r.avance.ms : 0)
