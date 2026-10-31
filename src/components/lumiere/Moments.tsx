import { useState } from 'react'
import { apiDelete, apiGet, apiPut, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { usePoll } from '../../lib/poll'
import type { Scene } from '../../lib/spatialFx'
import './lumiere-source.css'

export type Moment = { id: string; nom: string; scene: string; intensite: number; scene_ok: boolean }
type Brouillon = { id: string; nom: string; scene: string; intensite: number }
const NOUVEAU = 'new'

/** Moments de la journée (soirée film, repas, réveil, nuit) : chacun = une scène du pad à une intensité donnée.
 * Jouer un moment passe par `onJouer` (le même chemin que les touches du pad) avec l'intensité du moment. */
export function Moments({ scenes, onJouer }: { scenes: Scene[]; onJouer: (scene: Scene) => void | Promise<void> }) {
  const liste = usePoll<{ moments: Moment[]; max: number }>(() => apiGet('/moments-lumiere'), 30000)
  const [edition, setEdition] = useState<Brouillon | null>(null)
  const moments = liste.data?.moments ?? []
  const nomScene = (id: string) => scenes.find((s) => s.id === id)?.nom

  const jouer = (m: Moment) => {
    const s = scenes.find((x) => x.id === m.scene)
    if (!s) { toast(`la scène de « ${m.nom} » n’est plus dans le pad`, 'warn'); return }
    void onJouer({ ...s, intensite: m.intensite })
  }

  const enregistrer = async () => {
    if (!edition) return
    try {
      const r = await apiPut<{ success: boolean; error?: string }>(`/moments-lumiere/${edition.id}`, { moment: { nom: edition.nom, scene: edition.scene, intensite: edition.intensite } })
      if (!r.success) { toast(r.error ?? 'moment refusé', 'crit'); return }
      setEdition(null); liste.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'enregistrement impossible', 'crit') }
  }

  const supprimer = async (m: Moment) => {
    const ok = await confirmDialog({ title: `supprimer « ${m.nom} » ?`, body: 'La scène du pad n’est pas touchée, seulement ce moment.', ok: 'supprimer', danger: true })
    if (!ok) return
    try {
      const r = await apiDelete<{ success: boolean; error?: string }>(`/moments-lumiere/${m.id}`, await withConfirm('spatial_moment_supprimer'))
      if (!r.success) toast(r.error ?? 'suppression refusée', 'crit')
      liste.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'suppression impossible', 'crit') }
  }

  const nouveau = () => scenes[0] && setEdition({ id: NOUVEAU, nom: '', scene: scenes[0].id, intensite: 50 })

  return (
    <div className="lu-mom">
      {liste.error && !liste.data && <p className="lu-src-erreur" role="alert">les moments ne se chargent pas : {liste.error}</p>}
      <ul className="lu-mom-liste">
        {moments.map((m) => (
          <li key={m.id} className={`lu-mom-item ${m.scene_ok ? '' : 'perdu'}`}>
            <div className="lu-mom-nom"><b>{m.nom}</b>
              <span className="lite">{m.scene_ok ? `${nomScene(m.scene) ?? m.scene} · ${m.intensite} %` : 'sa scène a quitté le pad'}</span>
            </div>
            <div className="lu-mom-actions">
              <button type="button" className="btn sm solid" disabled={!m.scene_ok} onClick={() => jouer(m)}>jouer</button>
              <button type="button" className="btn sm" onClick={() => setEdition({ id: m.id, nom: m.nom, scene: m.scene, intensite: m.intensite })}>modifier</button>
              <button type="button" className="btn sm danger" onClick={() => void supprimer(m)}>supprimer</button>
            </div>
          </li>
        ))}
        {liste.data && moments.length === 0 && <li className="lu-note">Aucun moment. Crée-en un : une scène du pad, une intensité.</li>}
      </ul>

      {edition ? (
        <form className="lu-mom-form" onSubmit={(e) => { e.preventDefault(); void enregistrer() }}>
          <label>nom<input value={edition.nom} maxLength={40} placeholder="soirée jeux" onChange={(e) => setEdition({ ...edition, nom: e.target.value })} /></label>
          <label>scène
            <select value={edition.scene} onChange={(e) => setEdition({ ...edition, scene: e.target.value })}>
              {!scenes.some((s) => s.id === edition.scene) && <option value={edition.scene}>scène retirée du pad</option>}
              {scenes.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
          <label>intensité : {edition.intensite} %
            <input type="range" min={10} max={100} step={5} value={edition.intensite} onChange={(e) => setEdition({ ...edition, intensite: Number(e.target.value) })} />
          </label>
          <div className="lu-mom-actions">
            <button type="submit" className="btn sm solid" disabled={!edition.nom.trim()}>enregistrer</button>
            <button type="button" className="btn sm" onClick={() => setEdition(null)}>annuler</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn sm" disabled={scenes.length === 0 || moments.length >= (liste.data?.max ?? 24)} onClick={nouveau}>nouveau moment</button>
      )}
    </div>
  )
}
