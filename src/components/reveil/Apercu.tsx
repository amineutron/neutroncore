import { useEffect, useRef, useState } from 'react'
import { couleurLampe, dureeLisible, evaluer, type Rampe } from '../../lib/rampes'
import type { Lecture } from '../../lib/reveil'
import './reveil.css'

const VITESSES = [1, 10, 60, 300]

/** Position de lecture : locale (aperçu à la vitesse choisie) ou celle du serveur quand CETTE rampe joue pour de vrai. */
export function useApercu(rampe: Rampe, lecture: Lecture | null) {
  const [t, setT] = useState(0)
  const [joue, setJoue] = useState(false)
  const [vitesse, setVitesse] = useState(60)
  const recu = useRef({ t: 0, a: 0 })
  const reel = Boolean(lecture?.en_cours && lecture.id === rampe.id)

  useEffect(() => { if (reel && lecture) recu.current = { t: lecture.t, a: performance.now() } }, [reel, lecture])
  useEffect(() => {
    if (!joue && !reel) return
    let id = 0, avant = performance.now()
    const boucle = (now: number) => {
      if (reel) setT(Math.min(recu.current.t + (now - recu.current.a) / 1000, rampe.duree_s))      // le serveur est la référence, on lisse entre deux relevés
      else {
        setT((x) => { const n = x + ((now - avant) / 1000) * vitesse; return n >= rampe.duree_s ? (rampe.boucle ? n % rampe.duree_s : rampe.duree_s) : n })
        avant = now
      }
      id = requestAnimationFrame(boucle)
    }
    id = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(id)
  }, [joue, reel, vitesse, rampe.duree_s, rampe.boucle])
  useEffect(() => { if (joue && !rampe.boucle && t >= rampe.duree_s) setJoue(false) }, [t, joue, rampe.duree_s, rampe.boucle])
  return { t, setT, joue, setJoue, vitesse, setVitesse, reel }
}

export function Apercu({ rampe, noms, lecture, selection, onSelect }: {
  rampe: Rampe; noms: Record<string, string>; lecture: Lecture | null; selection?: string | null; onSelect?: (id: string) => void
}) {
  const a = useApercu(rampe, lecture)
  const etat = evaluer(rampe, a.t)
  const ids = rampe.pistes.flatMap((p) => p.lampes)
  return (
    <div>
      <div className="rv-lampes" aria-live="off">
        {ids.map((id) => {
          const e = etat[id]
          const bulle = <i style={{ background: couleurLampe(e), boxShadow: e?.on ? `0 0 ${8 + (e.bri ?? 254) / 12}px ${couleurLampe(e)}` : 'none' }} />
          const nom = <b title={noms[id]}>{noms[id] ?? `lampe ${id}`}</b>
          return onSelect
            ? <button key={id} type="button" className="rv-lampe" aria-pressed={selection === id} onClick={() => onSelect(id)}>{bulle}{nom}<span>{e?.bri ?? '-'}{e?.kelvin ? ` · ${e.kelvin}K` : ''}</span></button>
            : <div key={id} className="rv-lampe">{bulle}{nom}<span>{e?.bri ?? '-'}{e?.kelvin ? ` · ${e.kelvin}K` : ''}</span></div>
        })}
      </div>
      <div className="rv-ctl">
        <button type="button" className="btn sm" disabled={a.reel} onClick={() => { if (!a.joue && a.t >= rampe.duree_s) a.setT(0); a.setJoue(!a.joue) }}>{a.joue ? 'pause' : 'aperçu'}</button>
        <input type="range" aria-label="position dans la rampe" min={0} max={rampe.duree_s} step={1} value={Math.min(a.t, rampe.duree_s)} disabled={a.reel}
          onChange={(e) => { a.setJoue(false); a.setT(Number(e.target.value)) }} />
        <span className="rv-heure">{dureeLisible(a.t)} / {dureeLisible(rampe.duree_s)}</span>
        {a.reel
          ? <span className="chip ok">en direct sur les lampes</span>
          : <select aria-label="vitesse de l'aperçu" value={a.vitesse} onChange={(e) => a.setVitesse(Number(e.target.value))}>{VITESSES.map((v) => <option key={v} value={v}>x{v}</option>)}</select>}
      </div>
    </div>
  )
}
