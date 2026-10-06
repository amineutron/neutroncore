// Garde de navigation : un écran qui porte un brouillon non enregistré (plan de
// pièce) s'y inscrit ; App l'interroge avant de changer d'écran ou de revenir
// en arrière. beforeunload ne couvre ni la navigation interne ni la coque Android.

type Guard = () => Promise<boolean>   // true = on peut quitter
let guard: Guard | null = null

export function setNavGuard(g: Guard | null): void {
  guard = g
}

export async function canLeave(): Promise<boolean> {
  return guard ? guard() : true
}

export function hasNavGuard(): boolean {
  return guard !== null
}
