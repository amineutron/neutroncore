import { useEffect, useMemo, useRef, useState } from 'react'
import { mergeEtats, type Etats, type Jeu, type Piece } from '../../lib/atelier'
import { camForDir } from '../../lib/atelierFilm'
import { boiteDeBase, dirDuGeste, montageEtats, montageSteps, slideOffsets, type Boites } from '../../lib/atelierMontage'
import type { ViewerHandle } from './Viewer'

const CYCLE_MS = 2800      // une boucle de l'animation à vitesse 1 (même durée que dans la scène)

// État du montage pas à pas : les gestes, celui qu'on regarde, sa lecture en boucle et les vignettes.
export function useMontage({ data, pieces, boites, haut, etats, setEtats, setSelection, viewer, visible }: {
  data: Jeu | null; pieces: Piece[]; boites: Boites; haut: string; etats: Etats
  setEtats: (e: Etats) => void; setSelection: (s: string[]) => void
  viewer: React.RefObject<ViewerHandle | null>; visible: boolean
}) {
  // la fiche est relue à chaque relevé : les gestes ne sont recalculés que si son contenu change
  const fiche = JSON.stringify([data?.resume?.montage ?? [], data?.resume?.nomenclature ?? []])
  const steps = useMemo(() => montageSteps(data?.resume?.montage ?? [], pieces, data?.resume?.nomenclature ?? [], boites), [fiche, pieces, boites]) // eslint-disable-line react-hooks/exhaustive-deps
  const base = useMemo(() => boiteDeBase(pieces, boites), [pieces, boites])
  const [step, setStep] = useState(-1)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fantome, setFantomeState] = useState(false)
  const [enchainer, setEnchainer] = useState(false)
  const [thumbs, setThumbs] = useState<{ key: string; images: string[] }>({ key: '', images: [] })
  const saved = useRef<Etats | null>(null)       // états d'avant le montage, rendus en le quittant

  const mobiles = (i: number) => [...steps[i].nouvelles, ...steps[i].reprises]
  const camOf = (i: number) => camForDir(dirDuGeste(mobiles(i), boites, base))
  const go = (i: number, voirATravers = fantome) => {
    if (i < 0 || i >= steps.length) return
    if (step < 0) saved.current = etats
    setStep(i); setEtats(montageEtats(pieces, steps[i], voirATravers)); setSelection([])
    viewer.current?.orbit(camOf(i))
  }
  // les pièces ont pu changer pendant le montage (nouvelle itération) : on rend les réglages d'avant, complétés
  const quit = () => { setStep(-1); setPaused(false); if (saved.current) setEtats(mergeEtats(saved.current, pieces)); saved.current = null }
  const setFantome = (f: boolean) => { setFantomeState(f); if (step >= 0) go(step, f) }

  // minuteur et effets appellent toujours le `go` du dernier rendu (réglages et pièces à jour)
  const goRef = useRef(go)
  goRef.current = go
  // les gestes ont changé (autre itération, fiche réécrite, géométrie arrivée) : on recale la vue sur le
  // geste affiché, ou on sort du montage s'il n'existe plus
  useEffect(() => { if (step >= steps.length) quit(); else if (step >= 0) goRef.current(step) }, [steps]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enchainer || paused || step < 0 || step >= steps.length - 1) return
    const t = window.setTimeout(() => goRef.current(step + 1), (CYCLE_MS * 2) / speed)
    return () => window.clearTimeout(t)
  }, [enchainer, paused, step, speed, steps.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useMemo(() => (step >= 0 && steps[step] ? slideOffsets(mobiles(step), boites, base) : null), [step, steps, boites, base])

  // vignettes des gestes : calculées une fois par jeu de pièces, quand l'onglet montage est ouvert
  const key = data && steps.length > 0 && Object.keys(boites).length > 0 ? `${data.nom}|${data.iteration}|${data.maj}|${haut}|${steps.length}` : ''
  useEffect(() => {
    if (!visible || !key || (thumbs.key === key && thumbs.images.length > 0)) return
    const t = window.setTimeout(() => {
      const images = viewer.current?.thumbnails(steps.map((s, i) => ({ etats: montageEtats(pieces, s), cam: { ...camOf(i), k: 1 } }))) ?? []
      if (images.length > 0) setThumbs({ key, images })      // scène pas prête (chargement, tournage) : on réessaiera
    }, 80)
    return () => window.clearTimeout(t)
  }, [visible, key, boites]) // eslint-disable-line react-hooks/exhaustive-deps

  return { steps, base, step, go, quit, paused, setPaused, speed, setSpeed, fantome, setFantome, enchainer, setEnchainer, anim, thumbs: thumbs.key === key ? thumbs.images : [] }
}
