import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { toast } from '../../lib/dialog'
import { tailleLisible } from '../../lib/camera'
import {
  DUREES, dureeLisible, enregistrementEnCours, raisonBloquee, remplissage,
  type ReglagesStudio, type Studio as Etat,
} from '../../lib/cameraStudio'
import { Bar, Card, Chip, Loader } from '../ui'
import { NumField } from '../NumField'
import { StudioGalerie } from './StudioGalerie'
import { StudioScenes } from './StudioScenes'
import './studio.css'

type Res = { success: boolean; error?: string; nom?: string; avertissement?: string }

// Studio : prendre une photo ou un clip de l'image traitée, retrouver ses prises, rappeler une scène de réglages.
// Le studio ne touche jamais à la webcam : il lit ce que le moteur publie, et ne l'allume pas à ta place.
export function Studio({ onChange }: { onChange?: () => void }) {
  const [duree, setDuree] = useState<number | null>(null)
  const [vise, setVise] = useState(false)               // enregistrement demandé, pas encore visible
  const [busy, setBusy] = useState('')
  const [reglages, setReglages] = useState(false)
  const vu = useRef<number>(0)
  // plus vif pendant un enregistrement (compte à rebours), calme sinon
  const [rapide, setRapide] = useState(false)
  const etat = usePoll<Etat>(() => apiGet('/camera/studio'), rapide ? 1000 : 3000)
  const d = etat.data
  const enCours = enregistrementEnCours(d?.enregistrement ?? null)
  useEffect(() => { setRapide(Boolean(d?.enregistrement) || vise) }, [d?.enregistrement, vise])
  useEffect(() => { if (d?.enregistrement) setVise(false) }, [d?.enregistrement])
  // fin d'un enregistrement : on annonce l'issue une seule fois
  useEffect(() => {
    const f = d?.dernier
    if (!f || f.fin === vu.current || d?.enregistrement) return
    const premier = vu.current === 0
    vu.current = f.fin
    if (premier && Date.now() / 1000 - f.fin > 30) return          // issue ancienne, vue avant l'ouverture de l'écran
    if (f.ok && f.avertissement) toast(f.avertissement, 'warn')
    else if (f.ok) toast(f.note ? `clip gardé, plus court que prévu : ${f.note}` : 'clip enregistré', f.note ? 'warn' : 'ok')
    else toast(f.erreur ?? 'enregistrement raté', 'crit')
  }, [d?.dernier, d?.enregistrement])

  if (!d) return etat.error ? <p className="chip crit">API injoignable : {etat.error}</p> : <Loader label="lecture du studio…" />
  const bloque = raisonBloquee(d)
  const choisie = duree ?? d.reglages.duree
  const agir = async (cle: string, f: () => Promise<Res>, ok: string) => {
    setBusy(cle)
    try {
      const r = await f()
      if (!r.success) toast(r.error ?? 'refusé', 'crit')
      else if (r.avertissement) toast(r.avertissement, 'warn')
      else if (ok) toast(ok, 'ok')
      etat.refresh()
      return r.success
    } catch (err) { toast((err as Error).message, 'crit'); return false } finally { setBusy('') }
  }
  const photo = () => void agir('photo', () => apiPost<Res>('/camera/studio/photo'), 'photo prise')
  const clip = async () => {
    setVise(true)
    if (!(await agir('clip', () => apiPost<Res>('/camera/studio/clip', { duree: choisie }), ''))) setVise(false)
  }
  const arreter = () => void agir('arret', () => apiPost<Res>('/camera/studio/clip/arreter'), '')
  const regler = (patch: Partial<ReglagesStudio>) => void agir('reglages', () => apiPut<Res>('/camera/studio/reglages', { reglages: patch }), '')
  const part = remplissage(d.quota)

  return (
    <div className="stu">
      {bloque && !d.enregistrement && (
        <p className={`chip ${d.moteur_actif ? 'warn' : 'crit'}`} role="status">{bloque}</p>
      )}
      <Card title="prise">
        <p className="cam-note">Photo ou clip de l’image que voient les autres, avec ton fond. Le studio lit l’image que la caméra publie en pleine taille (1280 x 720) le temps d’une prise, sans la ralentir ; il ne l’allume pas.</p>
        <div className="at-row stu-actions">
          <button type="button" className="btn solid" disabled={Boolean(bloque) || busy === 'photo'} aria-busy={busy === 'photo'} title={bloque || 'Garde l’image affichée'} onClick={photo}>
            {busy === 'photo' && <i className="tourne" aria-hidden />}photo</button>
          {d.enregistrement || vise
            ? <button type="button" className="btn danger" onClick={arreter} disabled={busy === 'arret'}>arrêter et garder</button>
            : <button type="button" className="btn" disabled={Boolean(bloque) || busy === 'clip'} title={bloque || `Enregistre ${dureeLisible(choisie)} au plus`} onClick={() => void clip()}>enregistrer un clip</button>}
          <label className="at-champ">durée
            <select value={choisie} disabled={Boolean(d.enregistrement)} aria-label="Durée du clip" onChange={(e) => setDuree(Number(e.target.value))}>
              {[...new Set([...DUREES, d.reglages.duree])].filter((s) => s <= d.limites.duree_max).sort((a, b) => a - b).map((s) => <option key={s} value={s}>{dureeLisible(s)}</option>)}
            </select>
          </label>
        </div>
        {(d.enregistrement || vise) && (
          <div className="stu-rec" role="status" aria-live="polite">
            <span className="stu-point" aria-hidden />
            <span>{enCours ? `enregistrement : encore ${enCours.reste} s` : 'démarrage de l’enregistrement…'}</span>
            <Bar pct={Math.round((enCours?.part ?? 0) * 100)} />
          </div>
        )}
      </Card>

      <StudioScenes etat={d} onChange={() => { etat.refresh(); onChange?.() }} />
      <StudioGalerie prises={d.prises} onChange={etat.refresh} />

      <Card title="stockage">
        <div className="stu-quota">
          <Bar pct={Math.round(part * 100)} tone={part > 0.9 ? 'crit' : part > 0.7 ? 'warn' : 'ok'} />
          <span>{tailleLisible(d.quota.utilise)} sur {tailleLisible(d.quota.max)} · {d.quota.n} sur {d.quota.max_n} prises</span>
        </div>
        <p className="cam-note">Au-delà, les plus anciennes prises sont effacées toutes seules (jamais celle que tu viens de faire).</p>
        <button type="button" className="btn sm" aria-expanded={reglages} onClick={() => setReglages(!reglages)}>{reglages ? 'masquer les réglages' : 'réglages du studio'}</button>
        {reglages && (
          <div className="stu-regl">
            <label className="at-champ">images par seconde (clips)
              <select value={d.reglages.fps} aria-label="Images par seconde des clips" onChange={(e) => regler({ fps: Number(e.target.value) })}>
                {d.limites.fps.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            {([['duree', 'durée par défaut (s)'], ['quota_mo', 'espace au plus (Mo)'], ['max_prises', 'prises au plus']] as const).map(([k, label]) => (
              <label key={k} className="at-champ">{label}
                <NumField label={label} value={d.reglages[k]} min={d.limites.bornes[k][0]} max={d.limites.bornes[k][1]} onCommit={(v) => regler({ [k]: v })} />
              </label>
            ))}
            <Chip tone="gold">un clip pèse {tailleLisible(d.limites.taille_clip)} au plus</Chip>
          </div>
        )}
      </Card>
    </div>
  )
}
