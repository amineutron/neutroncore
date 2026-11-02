import { CRANS_DUREE, depuisCommun, MOTS_SIMPLE, patchCurseur, type CleSimple } from '../../lib/spatialSimple'
import type { Commun } from '../../lib/spatialFx'
import { toast } from '../../lib/dialog'

const CURSEURS: { cle: CleSimple; label: string; quoi: string }[] = [
  { cle: 'douceur', label: 'douceur', quoi: 'De sec (la lumière claque) à doux (elle monte et redescend en flottant).' },
  { cle: 'duree', label: 'durée des flashs', quoi: 'Combien de temps dure un flash : un temps, deux, une mesure ou deux.' },
  { cle: 'contraste', label: 'contraste', quoi: 'L’écart entre le flash et le creux : nul, la lumière reste continue ; total, elle retombe au noir.' },
]

/** Les trois curseurs parlants : ils calculent les vrais réglages communs (attaque, retombée, durée, profondeur,
 * plancher) et se replacent d'après ceux qui existent déjà. */
export function CurseursSimples({ commun, deuxD, onRegler }: { commun: Commun; deuxD: boolean; onRegler: (patch: Partial<Commun>) => void }) {
  const pos = depuisCommun(commun)
  return (
    <div className="lu-simples">
      {CURSEURS.map((c) => (
        <div key={c.cle} className="lu-curseur">
          <span><b>{c.label}</b><em>{MOTS_SIMPLE[c.cle](pos[c.cle])}</em></span>
          <input type="range" min={0} max={c.cle === 'duree' ? 3 : 100} step={1} value={c.cle === 'duree' ? CRANS_DUREE.indexOf(pos.duree) : pos[c.cle]} aria-label={c.label}
            onChange={(e) => {
              const brut = Number(e.target.value)
              const { patch, reveil } = patchCurseur(commun, c.cle, c.cle === 'duree' ? CRANS_DUREE[brut] : brut, deuxD)
              if (reveil) toast('contraste moyen enclenché pour que ce réglage se voie')
              onRegler(patch)
            }} />
          <p className="lu-legende">{c.quoi}</p>
        </div>
      ))}
    </div>
  )
}
