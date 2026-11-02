// Libellés des boutons de lancement de l'écran tests : « tout » et « la sélection »
// ne se confondent plus, et une suite sans cibles se lance comme une seule unité.

export type LaunchButton = { key: 'all' | 'selection' | 'suite'; label: string; solid: boolean }

export function launchButtons(targetCount: number, chosen: number): LaunchButton[] {
  if (targetCount === 0) return [{ key: 'suite', label: 'lancer la suite', solid: true }]
  if (chosen === 0) return [{ key: 'all', label: 'lancer tout', solid: true }]
  return [
    { key: 'selection', label: `lancer la sélection (${chosen})`, solid: true },
    { key: 'all', label: 'lancer tout', solid: false },
  ]
}
