import { useEffect, useRef, type RefObject } from 'react'
import { aAvancer, cadreEtape, etapesJouables, indexSuivant, type Rotation, type ZoneVue } from '../../lib/godeye/rotation'
import type { VueHandle } from './vues'

const GESTES = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const

/**
 * Rotation automatique : toutes les `secondes`, la vue passe à l'étape suivante (monde entier ou zone surveillée).
 * Le moindre geste dans la scène, ou un objet sélectionné, met la rotation en pause (30 s au moins après le dernier geste).
 */
export function useRotationAuto(rotation: Rotation, zones: readonly ZoneVue[], scene: RefObject<HTMLElement | null>, vue: RefObject<VueHandle | null>, occupe: boolean): void {
  const dernierGeste = useRef(Date.now())
  const derniereEtape = useRef(Date.now())
  const index = useRef(-1)
  const lu = useRef({ rotation, zones, occupe })
  lu.current = { rotation, zones, occupe }

  useEffect(() => {
    const el = scene.current
    if (!rotation.actif || !el) return
    const geste = () => { dernierGeste.current = Date.now() }
    for (const g of GESTES) el.addEventListener(g, geste, { passive: true })
    derniereEtape.current = Date.now()
    const t = window.setInterval(() => {
      const { rotation: r, zones: z, occupe: o } = lu.current
      if (document.hidden) return
      if (o) { dernierGeste.current = Date.now(); return }
      const etapes = etapesJouables(r.etapes, z)
      if (!etapes.length) return
      if (!aAvancer({ maintenant: Date.now(), dernierGeste: dernierGeste.current, derniereEtape: derniereEtape.current, secondes: r.secondes })) return
      index.current = indexSuivant(index.current, etapes.length)
      const cadre = cadreEtape(etapes[index.current], z)
      derniereEtape.current = Date.now()
      if (cadre) vue.current?.appliquerVue(cadre)
    }, 1000)
    return () => { window.clearInterval(t); for (const g of GESTES) el.removeEventListener(g, geste) }
  }, [rotation.actif, scene, vue])
}
