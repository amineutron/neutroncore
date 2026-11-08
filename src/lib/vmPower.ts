// Alimentation d'une VM : etat de vie et boutons proposes selon cet etat (logique pure, testee).
// Les libelles courts servent dans la rangee d'une machine ; les verbes et toasts sont dans vmHubApi.
import type { Power } from './vmHubApi'

export type Life = 'running' | 'paused' | 'stopped' | 'transition'

/** Etat vise par chaque action : la rangee attend de le voir pour dire « fait ». */
export const POWER_TARGET: Record<Power, Life> = { start: 'running', stop: 'stopped', force_stop: 'stopped', pause: 'paused', resume: 'running', reboot: 'running' }
export const POWER_BUSY: Record<Power, string> = { start: 'démarrage…', stop: 'arrêt…', force_stop: 'arrêt forcé…', pause: 'mise en pause…', resume: 'reprise…', reboot: 'redémarrage…' }
export const POWER_SHORT: Record<Power, string> = { start: 'démarrer', stop: 'arrêter', force_stop: 'forcer', pause: 'pause', resume: 'reprendre', reboot: 'redémarrer' }
export const LIFE_LABEL: Record<Life, string> = { running: 'en marche', paused: 'en pause', stopped: 'éteinte', transition: 'transition…' }
/** En marche : pause, redémarrer, arrêter, forcer ; en pause : reprendre, forcer ; éteinte : démarrer. */
export const POWER_ACTIONS: Record<Life, Power[]> = { running: ['pause', 'reboot', 'stop', 'force_stop'], paused: ['resume', 'force_stop'], stopped: ['start'], transition: [] }

/** Une action qui coupe ou interrompt le systeme invite est « dangereuse » (bouton rouge, confirmation). */
export const isDangerous = (a: Power): boolean => a === 'stop' || a === 'force_stop' || a === 'reboot'

export const FORCE_AFTER_MS = 60000  // arret propre ignore (pas d'OS invite, VM plantee) : proposer de forcer
export const REBOOT_MAX_MS = 45000   // redemarrage jamais vu passer par la transition (ACPI rapide) : considere fini

/** Ce qu'un releve periodique decide pendant une action en cours, d'apres le temps ecoule. */
export function pollVerdict(action: Power, elapsedMs: number): { canForce: boolean; done: boolean } {
  return { canForce: action === 'stop' && elapsedMs > FORCE_AFTER_MS, done: action === 'reboot' && elapsedMs > REBOOT_MAX_MS }
}

/** L'action est finie quand l'etat vise est atteint ; un redemarrage exige en plus d'avoir VU la machine quitter cet etat. */
export const reachedTarget = (action: Power, life: Life, left: boolean): boolean =>
  life === POWER_TARGET[action] && (action !== 'reboot' || left)

/** Etat de vie lu d'abord dans `extra.vm_state` (hub : running/paused/stopped/starting), sinon dans `status`
 *  (ecran des services : up/down). Tout inconnu vaut « éteinte ». */
export function lifeOf(vm: { status: string; extra?: Record<string, string> | null }): Life {
  const s = vm.extra?.vm_state ?? vm.status
  if (s === 'paused') return 'paused'
  if (s === 'starting') return 'transition'
  if (s === 'running' || vm.status === 'up') return 'running'
  return 'stopped'
}
