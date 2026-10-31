import { useEffect, useMemo, useRef, useState } from 'react'
import { couleurObjet } from '../../lib/godeye/couleurs'
import { placerEtiquettes, type Place } from '../../lib/godeye/globe'
import { THEMES, type Objet } from '../../lib/godeye/modele'
import { interet } from '../../lib/godeye/une'
import { ageTexte } from '../../lib/vueMonde'

export const LARGEUR_ETIQ = 200
export const HAUTEUR_ETIQ = 46

type Props = {
  /** Candidats déjà triés ou non : les plus intéressants sont servis d'abord, l'objet choisi est toujours proposé en premier. */
  candidats: readonly Objet[]
  projeter: (lon: number, lat: number) => { x: number; y: number } | null
  taille: () => { w: number; h: number }
  max: number
  choisi: string | null
  onChoisir: (id: string) => void
  actif: boolean
  /** Rectangles (px, repère de la scène) que les étiquettes doivent éviter : fiche ouverte, commandes. */
  bloques?: () => { x: number; y: number; w: number; h: number }[]
}

const glyphe = (o: Objet): string => (o.couche === 'infos' ? (THEMES.find((t) => t.id === o.sorte)?.lettre ?? '.') : o.couche === 'seismes' ? 'M' : o.couche === 'avions' ? 'A' : o.couche === 'satellites' ? 'S' : o.couche === 'navires' ? 'N' : o.couche === 'evenements' ? '!' : '*')

function ancreLigne(p: Place): [number, number] {
  return p.cote === 'd' ? [p.x, p.y + HAUTEUR_ETIQ / 2] : p.cote === 'g' ? [p.x + LARGEUR_ETIQ, p.y + HAUTEUR_ETIQ / 2]
    : p.cote === 'h' ? [p.x + LARGEUR_ETIQ / 2, p.y + HAUTEUR_ETIQ] : [p.x + LARGEUR_ETIQ / 2, p.y]
}

/** Étiquettes flottantes à côté des éléments importants : placées sans recouvrement, reliées au point par un trait, rafraîchies ~8 fois par seconde. */
export function Etiquettes({ candidats, projeter, taille, max, choisi, onChoisir, actif, bloques }: Props) {
  const [places, setPlaces] = useState<(Place & { o: Objet })[]>([])
  const reference = useRef({ candidats, projeter, taille, max, choisi, bloques })
  reference.current = { candidats, projeter, taille, max, choisi, bloques }

  useEffect(() => {
    if (!actif) { setPlaces([]); return }
    const calculer = () => {
      const { candidats: pool, projeter: proj, taille: tl, max: m, choisi: sel, bloques: bl } = reference.current
      const { w, h } = tl()
      if (w < 200 || h < 150) { setPlaces([]); return }
      const vus: { o: Objet; x: number; y: number; poids: number }[] = []
      for (const o of pool) {
        const p = proj(o.lon, o.lat)
        if (p && p.x > 0 && p.y > 0 && p.x < w && p.y < h) vus.push({ o, x: p.x, y: p.y, poids: interet(o) + (o.id === sel ? 100_000 : 0) })
      }
      const res = placerEtiquettes(vus.map((v) => ({ id: v.o.id, x: v.x, y: v.y, w: LARGEUR_ETIQ, h: HAUTEUR_ETIQ, poids: v.poids })), w, h, m, bl ? bl() : [])
      const parId = new Map(vus.map((v) => [v.o.id, v.o]))
      setPlaces(res.map((p) => ({ ...p, o: parId.get(p.id)! })))
    }
    calculer()
    const t = window.setInterval(() => { if (!document.hidden) calculer() }, 130)
    return () => window.clearInterval(t)
  }, [actif])

  const maintenant = useMemo(() => Date.now(), [places])
  if (!actif || places.length === 0) return null
  return (
    <div className="ge-etiq" aria-label="informations à proximité des éléments">
      <svg className="ge-etiq-traits" aria-hidden="true">
        {places.map((p) => {
          const [x2, y2] = ancreLigne(p)
          return <line key={p.id} x1={p.ancre[0]} y1={p.ancre[1]} x2={x2} y2={y2} stroke={couleurObjet(p.o)} strokeOpacity={0.7} strokeWidth={1.2} />
        })}
      </svg>
      {places.map((p) => (
        <button key={p.id} type="button" className={`ge-etiq-c${p.id === choisi ? ' on' : ''} ${p.o.ton}`} title={`${p.o.titre} - ${p.o.detail}`}
          style={{ transform: `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`, '--c': couleurObjet(p.o) } as React.CSSProperties}
          onClick={() => onChoisir(p.id)}>
          <span className="ge-etiq-ico" aria-hidden="true">{glyphe(p.o)}</span>
          <span className="ge-etiq-t">{p.o.titre}</span>
          <span className="ge-etiq-m">{p.o.t ? `${ageTexte(p.o.t, maintenant)} - ` : ''}{p.o.detail}</span>
        </button>
      ))}
    </div>
  )
}
