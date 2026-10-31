import { useEffect, useRef, useState } from 'react'
import { coucheDe, evaluer, rangs, sourceMobile, type FxId, type FxParams } from '../../lib/spatialFx'
import type { Venue } from '../../lib/spatialVenues'
import type { SpatialScene } from '../../lib/spatialScene'
import { sortieMix, type CoucheJouee } from '../../lib/spatialMix'

/** Un mix de scènes : pour chaque couche (la plus prioritaire d'abord), ses effets et réglages, les appareils qu'elle
 * concerne (`membres`) et le rang de chacun dans ce groupe (`rangs`, pour l'alternance 2d). Voir spatialMix.ts. */
export type InstantMix = { couches: { effets: FxId[]; params: FxParams; membres: boolean[]; rangs: number[] }[] }
/** `presence` (0..1) : part de lumière que laisse le silence, avec le fondu de retour de huebeat (voir spatialPresence.ts) ; absent = 1.
 * `mix` : plusieurs scènes jouées ensemble ; `effets` et `params` sont alors ceux de la couche du dessus (point source, lyres). */
export type Instant = { effets: FxId[]; params: FxParams; beat: number; presence?: number; mix?: InstantMix }

// La scène 3D : elle demande à chaque image ce qu'il faut montrer (`instant`) et le dessine.
// Aucun réglage ici ; three.js n'est chargé qu'à l'ouverture de l'écran.
export function SceneView({ venue, instant, onPlace }: { venue: Venue; instant: (venue: Venue) => Instant; onPlace?: (xPct: number | null, yPct: number | null, zPct: number | null) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<SpatialScene | null>(null)
  const [erreur, setErreur] = useState('')
  const courant = useRef({ venue, instant, onPlace })
  courant.current = { venue, instant, onPlace }

  useEffect(() => {
    let dead = false
    let cree: SpatialScene | null = null
    let raf = 0
    void import('../../lib/spatialScene').then(({ SpatialScene: Scene }) => {
      if (dead || !host.current) return
      try { cree = new Scene(host.current) } catch { setErreur('WebGL indisponible sur cet appareil : la scène ne peut pas s’afficher.'); return }
      scene.current = cree
      cree.onPlace = (x, y, z) => courant.current.onPlace?.(x, y, z)
      cree.setVenue(courant.current.venue)
      let rg: { venue: Venue | null; liste: number[] } = { venue: null, liste: [] }
      const tour = () => {
        const { venue: v, instant: lire } = courant.current as { venue: Venue; instant: (venue: Venue) => Instant }
        if (!document.hidden) {
          const { effets, params, beat, presence = 1, mix } = lire(v)
          if (rg.venue !== v) rg = { venue: v, liste: rangs(v.fixtures.map((f) => f.pos)) }
          const orbite = effets.includes('orbite') ? coucheDe(params, 'orbite') : null      // la source mobile a peut-être son propre tempo
          const sortie = (f: (typeof v.fixtures)[number], i: number) => {
            const s = mix
              ? sortieMix(mix.couches.flatMap((c): CoucheJouee[] => (c.membres[i] ? [{ effets: c.effets, params: c.params, rang: c.rangs[i] }] : [])), f, v.dims, beat)
              : evaluer(effets, f, v.dims, params, beat, rg.liste[i])
            return presence < 1 ? { ...s, niveau: s.niveau * presence } : s
          }
          cree?.frame(v.fixtures.map(sortie), params.source, orbite ? sourceMobile(v.dims, orbite.p, beat * orbite.k) : null)
        }
        raf = requestAnimationFrame(tour)
      }
      raf = requestAnimationFrame(tour)
    }).catch(() => { if (!dead) setErreur('La scène n’a pas pu être chargée : l’app a sans doute été mise à jour, recharge la page.') })
    return () => { dead = true; cancelAnimationFrame(raf); cree?.dispose(); scene.current = null }
  }, [])
  useEffect(() => { scene.current?.setVenue(venue) }, [venue])

  return <div className="lu-scene" ref={host}>{erreur && <p className="chip crit">{erreur}</p>}</div>
}
