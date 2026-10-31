// Appareils audio de démonstration (GET /zones-audio/appareils) : aucune vraie enceinte ni ampli.
// À enregistrer dans src/mock/routes.ts à côté de reveilDemo : ...sonoDemo
import type { MockHandler } from '../router'
import type { Appareils } from '../../lib/zonesAudio'

const demo: Appareils = {
  vide: false, manques: [], reseau_lu: true,
  appareils: [
    { id: 'denon', type: 'denon', nom: 'ampli denon', hote: '192.168.0.50', etat: 'allume', detail: 'allumé, source TV', volume: 32, pilotable: true }, // guard:allow IP factice de demo
    { id: 'cast:192.168.0.40', type: 'chromecast', nom: 'salon', hote: '192.168.0.40', etat: 'en_ligne', detail: 'présente sur le réseau · rien ne joue', volume: null, pilotable: true }, // guard:allow IP factice de demo
    { id: 'cast:192.168.0.41', type: 'chromecast', nom: 'cuisine', hote: '192.168.0.41', etat: 'absent', detail: 'pas vue sur le réseau', volume: null, pilotable: false }, // guard:allow IP factice de demo
    { id: 'tv', type: 'tv', nom: 'télé philips', hote: '192.168.0.60', etat: 'veille', detail: 'en veille', volume: null, pilotable: false }, // guard:allow IP factice de demo
    { id: 'pc:alsa_output.hdmi', type: 'pc', nom: 'sortie HDMI', hote: 'ce pc', etat: 'disponible', detail: 'disponible · sortie par défaut', volume: 42, pilotable: false },
  ],
}

export const sonoDemo: [string, string, MockHandler][] = [
  ['GET', '/zones-audio/appareils', () => demo],
]
