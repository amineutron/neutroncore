import { useEffect, useRef, useState } from 'react'
import { VUE_ENTIERE, deplacer, zoomer, type VueImage } from '../lib/zoom'

// Image ouverte dans une fenêtre (« agrandir » pour le plein écran) : molette ou pincement pour zoomer, glisser pour se déplacer,
// double clic pour revenir à l'image entière. `outils` ajoute des boutons propres à l'appelant.
// Le texte qui va avec l'image reste lisible à côté.
export function ImageZoom({ url, titre, clair = false, outils, corps, texte, onClose }: {
  url: string; titre: string; clair?: boolean; outils?: React.ReactNode; onClose: () => void
  corps?: React.ReactNode       // remplace l'image (une vue 3D, qui a ses propres gestes)
  texte?: React.ReactNode       // ce que l'image illustre, affiché à côté tant que la fenêtre n'est pas en plein écran
}) {
  const cadre = useRef<HTMLDivElement>(null)
  const [vue, setVue] = useState<VueImage>(VUE_ENTIERE)
  const [plein, setPlein] = useState(false)       // fenêtre de taille moyenne d'abord ; « agrandir » prend tout l'écran
  const doigts = useRef(new Map<number, { x: number; y: number }>())
  const taille = () => { const r = cadre.current?.getBoundingClientRect(); return { w: r?.width ?? 1, h: r?.height ?? 1, cx: (r?.left ?? 0) + (r?.width ?? 0) / 2, cy: (r?.top ?? 0) + (r?.height ?? 0) / 2 } }
  const zoom = (facteur: number, clientX?: number, clientY?: number) => {
    const t = taille()
    setVue((v) => zoomer(v, facteur, clientX === undefined ? 0 : clientX - t.cx, clientY === undefined ? 0 : clientY - t.cy, t))
  }

  useEffect(() => { setVue(VUE_ENTIERE) }, [titre])       // autre image : on repart de l'image entière (pas au simple changement de contexte)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (corps) return
      else if (e.key === '+' || e.key === '=') zoom(1.4)
      else if (e.key === '-') zoom(1 / 1.4)
      else if (e.key === '0') setVue(VUE_ENTIERE)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  // la molette doit pouvoir empêcher le défilement de la page : écouteur non passif
  useEffect(() => {
    const el = cadre.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [Boolean(corps)]) // eslint-disable-line react-hooks/exhaustive-deps

  const down = (e: React.PointerEvent) => { try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointeur déjà relâché : le glisser marche quand même dans le cadre */ } doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }) }
  const up = (e: React.PointerEvent) => { doigts.current.delete(e.pointerId) }
  const move = (e: React.PointerEvent) => {
    const avant = doigts.current.get(e.pointerId)
    if (!avant) return
    const t = taille()
    if (doigts.current.size === 2) {
      // pincement : le rapport des écarts entre les deux doigts donne le zoom, autour de leur milieu
      const autre = [...doigts.current.entries()].find(([id]) => id !== e.pointerId)![1]
      const d0 = Math.hypot(avant.x - autre.x, avant.y - autre.y), d1 = Math.hypot(e.clientX - autre.x, e.clientY - autre.y)
      if (d0 > 0) zoom(d1 / d0, (e.clientX + autre.x) / 2, (e.clientY + autre.y) / 2)
    } else {
      setVue((v) => deplacer(v, e.clientX - avant.x, e.clientY - avant.y, t))
    }
    doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  return (
    <div className={`iz ${plein ? 'plein' : ''}`} role="dialog" aria-modal="true" aria-label={titre} onClick={onClose}>
      <div className="iz-fenetre" onClick={(e) => e.stopPropagation()}>
      <div className="iz-milieu">
        {corps ?? (
          <div className={`iz-cadre ${clair ? 'clair' : ''} ${vue.k > 1 ? 'zoome' : ''}`} ref={cadre}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={() => setVue(vue.k > 1 ? VUE_ENTIERE : zoomer(vue, 2.5, 0, 0, taille()))}>
            <img src={url} alt={titre} draggable={false} style={{ transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.k})` }} />
          </div>
        )}
        {texte && !plein && <aside className="iz-texte">{texte}</aside>}
      </div>
      <div className="iz-barre">
        <b>{titre}</b>
        {outils}
        {!corps && (
          <span className="iz-zoom">
            <button type="button" className="btn sm" aria-label="Dézoomer" disabled={vue.k <= 1} onClick={() => zoom(1 / 1.5)}>−</button>
            <em>{Math.round(vue.k * 100)} %</em>
            <button type="button" className="btn sm" aria-label="Zoomer" onClick={() => zoom(1.5)}>+</button>
            <button type="button" className="btn sm" disabled={vue.k === 1} onClick={() => setVue(VUE_ENTIERE)}>entière</button>
          </span>
        )}
        <button type="button" className="btn sm" aria-pressed={plein} onClick={() => { setPlein(!plein); setVue(VUE_ENTIERE) }}>{plein ? 'réduire' : 'agrandir'}</button>
        <button type="button" className="btn sm solid" onClick={onClose}>fermer</button>
      </div>
      </div>
    </div>
  )
}
