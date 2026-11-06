import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { djlightFlux } from '../../lib/api'
import type { DjMoteur } from '../../lib/djMoteur'
import { Simulateur } from '../../lib/djSimu'
import type { ImageAudio } from '../../lib/djSignaux'

export type SourceDj = 'direct' | 'simule'
export type EtatFlux = { moteur: 'attente' | 'demarrage' | 'ok' | 'erreur'; source: string; erreur: string }
const ATTENTE: EtatFlux = { moteur: 'attente', source: '', erreur: '' }
const PAUSE_REPRISE_MS = 3000

/** Alimente le moteur DJ Light : le flux audio de l'API (reconnexion toutes les 3 s) ou le morceau simulé. Les images arrivent
 * souvent (30 par seconde) : elles ne passent pas par l'état React, `image` en garde la dernière. */
export function useDjFlux(moteur: DjMoteur, source: SourceDj, surDrop: () => void, surImage?: () => void): { etat: EtatFlux; image: MutableRefObject<ImageAudio | null>; recu: MutableRefObject<number> } {
  const [etat, setEtat] = useState<EtatFlux>(ATTENTE)
  const image = useRef<ImageAudio | null>(null)
  const recu = useRef(0)                       // instant (ms) de la dernière image
  const drop = useRef(surDrop)
  drop.current = surDrop
  // appelé à CHAQUE image reçue, juste après son analyse : c'est ce qui cadence les vraies lampes (les écrans cachés
  // ne reçoivent plus d'image d'animation, mais les messages réseau continuent d'arriver)
  const surImageRef = useRef(surImage)
  surImageRef.current = surImage

  useEffect(() => {
    moteur.reinitialiser()
    image.current = null
    const pousser = (img: ImageAudio) => {
      image.current = img
      recu.current = performance.now()
      if (moteur.pousser(img, recu.current).drop) drop.current()
      surImageRef.current?.()
    }
    if (source === 'simule') {
      const simu = new Simulateur(1, 8)
      setEtat({ moteur: 'ok', source: 'morceau simulé', erreur: '' })
      const id = window.setInterval(() => pousser(simu.suivant(1 / 30)), 1000 / 30)
      return () => window.clearInterval(id)
    }
    let vivant = true
    const ctrl = new AbortController()
    void (async () => {
      while (vivant) {
        try {
          setEtat((e) => ({ ...e, moteur: 'demarrage', erreur: '' }))
          await djlightFlux((ev) => {
            if (!vivant) return
            if (ev.type === 'frame') { pousser(ev); setEtat((e) => (e.moteur === 'ok' ? e : { moteur: 'ok', source: e.source, erreur: '' })) }
            else setEtat((e) => ({ moteur: ev.moteur === 'ok' ? 'ok' : ev.moteur === 'erreur' ? 'erreur' : 'demarrage', source: ev.source ?? e.source, erreur: ev.erreur ?? '' }))
          }, ctrl.signal)
        } catch (e) {
          if (!vivant) return
          setEtat({ moteur: 'erreur', source: '', erreur: e instanceof Error ? e.message : 'flux audio interrompu' })
        }
        await new Promise((r) => window.setTimeout(r, PAUSE_REPRISE_MS))
      }
    })()
    return () => { vivant = false; ctrl.abort() }
  }, [moteur, source])

  return { etat, image, recu }
}
