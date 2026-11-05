// DJ Light de démonstration : la configuration (profils de départ, sets) se modifie et reste en mémoire jusqu'au rechargement.
// Mêmes réponses que l'API : `{ config }` en lecture, `{ success, config }` en écriture.
import type { MockHandler } from '../router'
import { CONFIG_DEPART, type ConfigDj } from '../../lib/djCouches'

let config: ConfigDj = CONFIG_DEPART()

export const djlight: [string, string, MockHandler][] = [
  ['GET', '/djlight/etat', () => ({ moteur: 'ok', source: 'morceau simulé', spectateurs: 1, fps: 30 })],
  ['GET', '/djlight/config', () => ({ config })],
  ['PUT', '/djlight/config', ({ body }) => {
    const c = (body as { config?: ConfigDj })?.config
    if (c) config = c
    return { success: true, config }
  }],
]
