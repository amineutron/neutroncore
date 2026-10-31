// Commandes de palette pour les minuteurs et les notes (à ajouter à buildCommands, voir INTEGRATION.md).
import { apiPost } from './api'
import { toast } from './dialog'
import { CLE_NOTE_RAPIDE } from './minuteurs'
import type { Command } from './palette'

type Aller = (ecran: 'minuteurs') => void

const RAPIDES: { id: string; label: string; phrase: string }[] = [
  { id: '1', label: 'minuteur : 1 min', phrase: 'minuteur 1 min' },
  { id: '5', label: 'minuteur : 5 min', phrase: 'minuteur 5 min' },
  { id: '10', label: 'minuteur : 10 min', phrase: 'minuteur 10 min' },
  { id: '15', label: 'minuteur : 15 min', phrase: 'minuteur 15 min' },
  { id: '30', label: 'minuteur : 30 min', phrase: 'minuteur 30 min' },
  { id: 'pomodoro', label: 'minuteur : pomodoro', phrase: 'pomodoro' },
]

export function commandesMinuteurs(go: Aller): Command[] {
  return [
    ...RAPIDES.map((r): Command => ({
      id: `minuteur:${r.id}`, label: r.label, group: 'minuteurs', keywords: 'timer compte a rebours cuisine chrono',
      run: async () => {
        await apiPost('/minuteurs/phrase', { texte: r.phrase })
        toast(`${r.label.replace('minuteur : ', 'minuteur ')} lancé`)
      },
    })),
    { id: 'minuteur:ecran', label: 'minuteurs en cours', group: 'minuteurs', keywords: 'timer pomodoro', nav: true, run: () => go('minuteurs') },
    { id: 'note:rapide', label: 'note rapide', group: 'notes', keywords: 'noter idee capture carnet memo', nav: true,
      run: () => {
        try { sessionStorage.setItem(CLE_NOTE_RAPIDE, '1') } catch { /* stockage indisponible */ }
        go('minuteurs')
      } },
  ]
}
