import { useEffect, type RefObject } from 'react'
import { setNavGuard } from './navGuard'

// Calque plein ecran (ecran VNC, terminal serie) : bouton retour, Echap, defilement du fond.
// Bouton retour Android / geste retour : App ecoute popstate et, avant de quitter l'ecran, interroge la garde de
// navigation (lib/navGuard) ; on s'y inscrit pour fermer le calque et refuser la sortie, App rend alors l'entree
// d'historique consommee. On ne pousse pas d'entree a nous : deux ecouteurs du meme popstate se disputeraient
// l'evenement (App quitterait l'ecran en meme temps que le calque se ferme).
// Echap ferme seulement si le clavier n'est pas tenu par la machine ou le terminal (la touche leur revient).
export function useFullscreenOverlay(open: boolean, stage: RefObject<HTMLElement | null>, close: () => void): void {
  useEffect(() => {
    if (!open) return
    setNavGuard(async () => { close(); return false })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !stage.current?.contains(document.activeElement)) close() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      setNavGuard(null)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, stage, close])
}
