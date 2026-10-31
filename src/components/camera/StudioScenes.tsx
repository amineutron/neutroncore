import { useState } from 'react'
import { apiDelete, apiPost, apiPut } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { patchDeScene, resumeScene, type Scene, type Studio } from '../../lib/cameraStudio'
import { Card } from '../ui'

type Res = { success: boolean; error?: string }

// Scènes : préréglages nommés (fond, flou, détourage, cadence). Un clic les applique par PUT /camera/reglages,
// comme les curseurs de l'écran ; « enregistrer » retient la configuration de la caméra à cet instant.
export function StudioScenes({ etat, onChange }: { etat: Studio; onChange: () => void }) {
  const [nom, setNom] = useState('')
  const [busy, setBusy] = useState('')
  const pleine = etat.scenes.length >= etat.limites.scenes_max

  const faire = async (cle: string, f: () => Promise<Res>, ok = '') => {
    setBusy(cle)
    try {
      const r = await f()
      if (!r.success) toast(r.error ?? 'refusé', 'crit')
      else { if (ok) toast(ok, 'ok'); onChange() }
      return r.success
    } catch (err) { toast((err as Error).message, 'crit'); return false } finally { setBusy('') }
  }
  const appliquer = (s: Scene) => void faire(s.id, () => apiPut<Res>('/camera/reglages', { reglages: patchDeScene(s) }), `scène « ${s.nom} » appliquée`)
  const creer = async () => {
    const n = nom.trim()
    if (!n) return
    if (await faire('nouvelle', () => apiPost<Res>('/camera/studio/scenes', { nom: n }), `scène « ${n} » enregistrée`)) setNom('')
  }
  // remplacer garde le nom : la scène retient la configuration actuelle
  const remplacer = async (s: Scene) => {
    if (!(await confirmDialog({ title: `remplacer « ${s.nom} » ?`, body: 'La scène retiendra les réglages actuels de la caméra.', ok: 'remplacer' }))) return
    void faire(`maj:${s.id}`, () => apiPut<Res>(`/camera/studio/scenes/${s.id}`, { nom: s.nom }), `scène « ${s.nom} » mise à jour`)
  }
  const retirer = async (s: Scene) => {
    if (!(await confirmDialog({ title: `supprimer la scène « ${s.nom} » ?`, body: 'Seul le préréglage disparaît, la caméra garde ses réglages.', ok: 'supprimer', danger: true }))) return
    void faire(`del:${s.id}`, () => apiDelete<Res>(`/camera/studio/scenes/${s.id}`))
  }

  return (
    <Card title="scènes">
      <p className="cam-note">Un clic rappelle un fond et un détourage : par exemple « visio », « stream », « sans fond ».</p>
      {etat.scenes.length === 0 && <p className="cam-note">Aucune scène pour l’instant : règle la caméra, puis donne-lui un nom ci-dessous.</p>}
      <ul className="stu-scenes">
        {etat.scenes.map((s) => {
          const active = etat.scene_active === s.id
          return (
            <li key={s.id} className={active ? 'on' : ''}>
              <button type="button" className={`btn ${active ? 'solid' : ''}`} aria-pressed={active} disabled={busy === s.id} title={resumeScene(s)} onClick={() => appliquer(s)}>
                {busy === s.id && <i className="tourne" aria-hidden />}{s.nom}</button>
              <small>{resumeScene(s)}</small>
              <span className="stu-scene-act">
                <button type="button" className="btn sm" onClick={() => void remplacer(s)} title="Retient les réglages actuels dans cette scène" aria-label={`Remplacer la scène ${s.nom}`}>maj</button>
                <button type="button" className="btn sm danger" onClick={() => void retirer(s)} aria-label={`Supprimer la scène ${s.nom}`}>×</button>
              </span>
            </li>
          )
        })}
      </ul>
      <form className="at-row" onSubmit={(e) => { e.preventDefault(); void creer() }}>
        <input value={nom} maxLength={40} placeholder="nom de la scène" aria-label="Nom de la nouvelle scène" disabled={pleine} onChange={(e) => setNom(e.target.value)} />
        <button type="submit" className="btn" disabled={!nom.trim() || pleine || busy === 'nouvelle'}>enregistrer les réglages actuels</button>
      </form>
      {pleine && <p className="cam-note">{etat.limites.scenes_max} scènes au plus : supprime-en une d’abord.</p>}
    </Card>
  )
}
