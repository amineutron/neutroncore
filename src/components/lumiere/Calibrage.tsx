import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { setNavGuard } from '../../lib/navGuard'
import { isDirty, toPayload, toSvg, type Plan } from '../../lib/plan'
import { deplacees, lampesDuPlan, nomCanaux, phraseCalibrage, pointTouche, recaler, type LampeInfo } from '../../lib/spatialOutils'
import { Btn, Chip } from '../ui'
import './lumiere-outils.css'

type Reponse = { success: boolean; error?: string; huebeat?: boolean }
const MESSAGE_ATTENTE = 'La lampe est allumée pendant que tu la cherches ; elle est remise comme avant dès que tu passes à la suivante ou que tu arrêtes.'

/** Calibrage guidé : une lampe s'allume à la fois, l'utilisateur touche sur le plan l'endroit où elle se trouve.
 * Rien n'est écrit avant « enregistrer » (PUT /plan : refuse si HALO a modifié le plan entre-temps).
 * `onEnregistre` : appelé après un enregistrement réussi (pour recharger la position des canaux). */
export function Calibrage({ onEnregistre }: { onEnregistre?: () => void }) {
  const [saved, setSaved] = useState<Plan | null>(null)
  const [draft, setDraft] = useState<Plan | null>(null)
  const [lampes, setLampes] = useState<LampeInfo[]>([])
  const [rang, setRang] = useState<number | null>(null)       // lampe en cours (index dans les lampes du plan), null = pas commencé
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const actif = useRef(false)

  async function charger() {
    setErreur('')
    try {
      const [p, l] = await Promise.all([apiGet<Plan>('/plan'), apiGet<{ success: boolean; error?: string; lampes: LampeInfo[] }>('/spatial/outils/lampes')])
      if (!p.roomDims || !p.configs) throw new Error('plan HALO introuvable')
      setSaved(p); setDraft(p); setLampes(l.lampes ?? [])
      if (!l.success) setErreur(l.error ?? 'lampes illisibles')
    } catch (e) { setErreur((e as Error).message) }
  }
  useEffect(() => { void charger() }, [])
  // quitter l'écran avec une lampe allumée : on la remet
  useEffect(() => () => { if (actif.current) void apiPost('/spatial/outils/calibrage/arreter').catch(() => undefined) }, [])

  const dirty = saved !== null && draft !== null && isDirty(saved, draft)
  useEffect(() => {
    if (!dirty) return
    setNavGuard(() => confirmDialog({ title: 'quitter sans enregistrer ?', body: 'Des lampes ont été recalées mais pas enregistrées.', ok: 'quitter', cancel: 'rester', danger: true }))
    return () => setNavGuard(null)
  }, [dirty])

  const { placables, absentes } = draft ? lampesDuPlan(lampes, draft) : { placables: [], absentes: [] }
  const courante = rang !== null ? placables[rang] : undefined

  async function allumer(i: number) {
    const cible = placables[i]
    if (!cible) return
    setOccupe(true)
    try {
      const r = await apiPost<Reponse>('/spatial/outils/calibrage/allumer', { lampe: cible.id })
      if (!r.success) { actif.current = false; setRang(null); toast(r.error ?? 'la lampe ne s’allume pas', 'crit'); return }
      actif.current = true
      setRang(i)
    } catch (e) { toast(`échec : ${(e as Error).message}`, 'crit') } finally { setOccupe(false) }
  }
  async function arreter() {
    setOccupe(true)
    try { await apiPost('/spatial/outils/calibrage/arreter'); actif.current = false; setRang(null) }
    catch (e) { toast(`la lampe n’a peut-être pas été remise : ${(e as Error).message}`, 'crit') } finally { setOccupe(false) }
  }
  function toucher(e: React.PointerEvent<SVGSVGElement>) {
    if (!draft || !courante || !svg.current) return
    const xy = pointTouche(e.clientX, e.clientY, svg.current.getBoundingClientRect(), draft.roomDims)
    if (xy) setDraft(recaler(draft, courante.id, xy))
  }
  async function enregistrer() {
    if (!draft || !saved) return
    setOccupe(true)
    try {
      const r = await apiPut<{ success: boolean; error?: string; stale?: boolean; rev?: string }>('/plan', toPayload(draft, saved))
      if (!r.success) {
        setErreur(r.stale ? 'Le plan a changé dans HALO depuis son ouverture ici : recharge-le (tes repositionnements non enregistrés seront perdus).' : r.error ?? 'refusé')
        return
      }
      setSaved({ ...draft, rev: r.rev }); setDraft({ ...draft, rev: r.rev }); setErreur('')
      toast('positions enregistrées — HALO recharge le plan tout seul')
      onEnregistre?.()
    } catch (e) { setErreur((e as Error).message) } finally { setOccupe(false) }
  }

  if (!draft) return <div className="lu-outil">{erreur ? <><Chip tone="crit">{erreur}</Chip> <Btn sm onClick={charger}>réessayer</Btn></> : <p className="lite">lecture du plan…</p>}</div>
  const { w, h } = draft.roomDims
  const bougees = saved ? deplacees(saved, draft) : []
  return (
    <div className="lu-outil">
      <p className="lite">Une lampe s’allume à la fois. Touche sur le plan l’endroit où elle se trouve vraiment ; rien n’est modifié avant « enregistrer ».</p>
      {erreur && <div className="lu-outil-err"><Chip tone="crit">{erreur}</Chip> <Btn sm onClick={charger}>recharger le plan</Btn></div>}
      {courante && <p className="lu-outil-phrase" role="status">{phraseCalibrage(rang ?? 0, placables.length, courante.nom)}</p>}
      <svg ref={svg} className="lu-cal-plan" viewBox={`0 0 ${w} ${h}`} style={{ aspectRatio: `${w} / ${h}` }} onPointerDown={toucher} role="img" aria-label="plan de la pièce vu de dessus">
        <rect x="0" y="0" width={w} height={h} className="lu-cal-piece" />
        {Object.entries(draft.configs).map(([id, c]) => {
          const p = toSvg(c.pos, draft.roomDims), actuelle = id === courante?.id
          return (
            <g key={id} className={actuelle ? 'lu-cal-lampe on' : 'lu-cal-lampe'}>
              {actuelle && saved?.configs[id] && <circle {...rond(toSvg(saved.configs[id].pos, draft.roomDims))} r={Math.max(w, h) / 90} className="lu-cal-ancien" />}
              <circle {...rond(p)} r={Math.max(w, h) / (actuelle ? 40 : 70)} />
              <text x={p.x} y={p.y - Math.max(w, h) / 32} textAnchor="middle" fontSize={Math.max(w, h) / 40}>{c.name}</text>
            </g>
          )
        })}
      </svg>
      <div className="lu-outil-barre">
        {rang === null
          ? <Btn solid disabled={occupe || placables.length === 0} onClick={() => void allumer(0)}>{placables.length ? 'commencer par la première lampe' : 'aucune lampe dans le plan'}</Btn>
          : <>
            <Btn sm disabled={occupe || rang === 0} onClick={() => void allumer(rang - 1)}>précédente</Btn>
            <Btn sm solid disabled={occupe || rang >= placables.length - 1} onClick={() => void allumer(rang + 1)}>lampe suivante</Btn>
            <Btn sm disabled={occupe} onClick={arreter}>arrêter (remet la lampe)</Btn>
          </>}
        <Btn solid disabled={!dirty || occupe} onClick={enregistrer}>enregistrer{bougees.length ? ` (${bougees.length})` : ''}</Btn>
      </div>
      {rang !== null && <p className="lite">{MESSAGE_ATTENTE}</p>}
      {bougees.length > 0 && <ul className="lu-outil-liste">{bougees.map((d) => <li key={d.id}>{d.nom} : déplacée de {d.ecart} cm</li>)}</ul>}
      {absentes.length > 0 && <p className="lite">Pas dans le plan, donc impossibles à recaler ici ({absentes.map((l) => l.nom + (l.canaux.length ? ` — ${nomCanaux(l.canaux)}` : '')).join(', ')}) : ajoute-les d’abord dans HALO.</p>}
    </div>
  )
}

const rond = (p: { x: number; y: number }) => ({ cx: p.x, cy: p.y })
