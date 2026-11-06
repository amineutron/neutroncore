// DJ Light garde les vraies lampes quand on quitte son écran : l'écran reste monté (sans rien afficher) tant que les lampes
// tournent. Sans lampes prises, il se démonte comme avant (plus de flux audio ni de calcul pour rien).
import type { PhaseLiaison } from './djLiaison'

export const resterEnFond = (phase: PhaseLiaison): boolean => phase === 'actif' || phase === 'demarrage'
