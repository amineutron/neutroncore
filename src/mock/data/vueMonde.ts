// Données de démo de la vue du monde. Le flux USGS est lu directement par le navigateur : en démo (aucune
// requête réseau) l'écran retombe sur ces séismes fictifs. Voir DEMO dans lib/api.ts.
import type { Seisme } from '../../lib/vueMonde'

const H = 3600_000
export function seismesDemo(maintenant = Date.now()): Seisme[] {
  return [
    { id: 'demo1', mag: 6.4, lieu: '120 km au sud de Honshu, Japon', lon: 142.1, lat: 37.4, prof: 38, t: maintenant - 2 * H },
    { id: 'demo2', mag: 5.1, lieu: 'dorsale du Chili', lon: -72.3, lat: -33.6, prof: 24, t: maintenant - 5 * H },
    { id: 'demo3', mag: 4.6, lieu: 'Grèce, mer Égée', lon: 25.8, lat: 36.9, prof: 10, t: maintenant - 9 * H },
    { id: 'demo4', mag: 3.2, lieu: 'Californie du Sud', lon: -117.4, lat: 34.1, prof: 6, t: maintenant - 11 * H },
    { id: 'demo5', mag: 5.6, lieu: 'îles Tonga', lon: -174.9, lat: -20.4, prof: 140, t: maintenant - 14 * H },
    { id: 'demo6', mag: 4.1, lieu: 'Indonésie, Sumatra', lon: 96.2, lat: 2.9, prof: 30, t: maintenant - 20 * H },
  ]
}
