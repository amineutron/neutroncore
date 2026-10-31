import { apiDelete, apiPut, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import type { Scene } from '../../lib/spatialFx'
import {
  MAX_COUCHES, ajouterCouche, basculerGroupe, deplacerCouche, groupesDeLampes, lampesDeLaCouche, resume, retirerCouche, type CoucheMix, type Mix,
} from '../../lib/spatialMix'
import './lumiere-mix.css'

export const NOUVEAU_MIX = 'new'

type Props = {
  scenes: Scene[]
  mixes: Mix[]
  canaux: Record<string, number[]>
  noms: Record<string, string>
  actif: string | null                       // mix joué en ce moment
  brouillon: Mix | null                      // mix en cours d'édition (id « new » pour un nouveau) ; la pièce 3d le montre
  onBrouillon: (m: Mix | null) => void
  onJouer: (m: Mix) => void
  onArreter: () => void
  onChange: () => void                       // le pad a changé côté API : relire
}

const libelle = (s: Scene) => `${s.nom} · ${s.mode ?? '3d'}`

/** Mixer des scènes : plusieurs scènes du pad (2d et 3d) jouées ensemble, rangées par priorité ; chacune peut ne viser
 * qu'une lampe ou un groupe de lampes. Le calcul est dans spatialMix.ts, l'enregistrement dans l'API (/spatial/mixes). */
export function MixEditeur({ scenes, mixes, canaux, noms, actif, brouillon, onBrouillon, onJouer, onArreter, onChange }: Props) {
  const groupes = groupesDeLampes(canaux, noms)
  const tous = Object.keys(canaux)
  const nomScene = (id: string) => scenes.find((s) => s.id === id)
  const maj = (couches: CoucheMix[]) => brouillon && onBrouillon({ ...brouillon, couches })
  const majCouche = (i: number, patch: Partial<CoucheMix>) => {
    if (!brouillon) return
    const couches = brouillon.couches.map((c, j) => {
      if (j !== i) return c
      const { canaux: _anciens, ...reste } = c
      const n = { ...reste, ...patch }
      return n.canaux === undefined ? { scene: n.scene } : n
    })
    maj(couches)
  }

  const enregistrer = async () => {
    if (!brouillon) return
    try {
      const r = await apiPut<{ success: boolean; error?: string }>(`/spatial/mixes/${brouillon.id}`, { mix: { nom: brouillon.nom.trim(), couches: brouillon.couches } })
      if (!r.success) { toast(r.error ?? 'mix refusé', 'crit'); return }
      onBrouillon(null); onChange()
    } catch (e) { toast(e instanceof Error ? e.message : 'enregistrement impossible', 'crit') }
  }
  const supprimer = async (m: Mix) => {
    if (!(await confirmDialog({ title: `supprimer le mix « ${m.nom} » ?`, body: 'Les scènes du pad ne sont pas touchées, seulement ce mélange.', ok: 'supprimer', danger: true }))) return
    try {
      const r = await apiDelete<{ success: boolean; error?: string }>(`/spatial/mixes/${m.id}`, await withConfirm('spatial_supprimer'))
      if (!r.success) toast(r.error ?? 'suppression refusée', 'crit')
      if (actif === m.id) onArreter()
      onChange()
    } catch (e) { toast(e instanceof Error ? e.message : 'suppression impossible', 'crit') }
  }
  const nouveau = () => scenes[0] && onBrouillon({ id: NOUVEAU_MIX, nom: '', couches: [{ scene: scenes[0].id }] })

  return (
    <div className="lu-mx">
      <p className="lu-note">Un mix joue plusieurs scènes ensemble. La première couche est la plus prioritaire : elle prend la lampe là où elle éclaire, et les suivantes se voient là où elle est faible ou éteinte. Chaque couche peut viser toutes les lampes, ou seulement une lampe ou un groupe.</p>

      <ul className="lu-mx-liste">
        {mixes.map((m) => (
          <li key={m.id} className={`lu-mx-item ${actif === m.id ? 'on' : ''}`}>
            <div className="lu-mx-nom"><b>{m.nom}</b><span className="lite">{resume(m, scenes)}</span></div>
            <div className="lu-mx-actions">
              <button type="button" className={`btn sm ${actif === m.id ? '' : 'solid'}`} aria-pressed={actif === m.id} onClick={() => (actif === m.id ? onArreter() : onJouer(m))}>{actif === m.id ? 'quitter le mix' : 'jouer'}</button>
              <button type="button" className="btn sm" onClick={() => onBrouillon(m)}>modifier</button>
              <button type="button" className="btn sm danger" onClick={() => void supprimer(m)} aria-label={`Supprimer le mix ${m.nom}`}>supprimer</button>
            </div>
          </li>
        ))}
        {mixes.length === 0 && !brouillon && <li className="lu-note">Aucun mix. Crée-en un : choisis deux scènes ou plus, range-les par priorité.</li>}
      </ul>

      {!brouillon && <div className="lu-ligne"><button type="button" className="btn sm" disabled={scenes.length === 0} onClick={nouveau}>nouveau mix</button></div>}

      {brouillon && (
        <form className="lu-mx-form" onSubmit={(e) => { e.preventDefault(); void enregistrer() }}>
          <label className="at-champ">nom du mix
            <input className="bp-text" value={brouillon.nom} maxLength={40} placeholder="salon : neutron + vague de fond" onChange={(e) => onBrouillon({ ...brouillon, nom: e.target.value })} />
          </label>
          <ol className="lu-mx-couches">
            {brouillon.couches.map((c, i) => {
              const s = nomScene(c.scene)
              return (
                <li key={i} className="lu-mx-couche">
                  <span className="lu-mx-rang" title={i === 0 ? 'La plus prioritaire : elle masque les suivantes là où elle éclaire' : `Priorité ${i + 1} : voilée par les couches du dessus`}>{i + 1}</span>
                  <div className="lu-mx-corps">
                    <label className="lu-mx-champ">scène
                      <select value={c.scene} aria-label={`Scène de la couche ${i + 1}`} onChange={(e) => majCouche(i, { scene: e.target.value })}>
                        {!s && <option value={c.scene}>scène retirée du pad</option>}
                        {scenes.map((x) => <option key={x.id} value={x.id}>{libelle(x)}</option>)}
                      </select>
                    </label>
                    <div className="lu-mx-lampes" role="group" aria-label={`Lampes visées par la couche ${i + 1}`}>
                      <button type="button" className={`lu-mx-puce ${c.canaux ? '' : 'on'}`} aria-pressed={!c.canaux} onClick={() => majCouche(i, { canaux: undefined })}>toutes les lampes</button>
                      {groupes.map((g) => {
                        const coche = Boolean(c.canaux) && g.canaux.every((k) => c.canaux!.includes(k))
                        const partiel = Boolean(c.canaux) && !coche && g.canaux.some((k) => c.canaux!.includes(k))
                        return (
                          <button key={g.nom} type="button" className={`lu-mx-puce ${coche ? 'on' : partiel ? 'part' : ''}`} aria-pressed={coche}
                            title={g.canaux.length > 1 ? `${g.canaux.length} segments` : undefined} onClick={() => majCouche(i, { canaux: basculerGroupe(c.canaux, g.canaux, tous) })}>
                            {g.nom}{g.canaux.length > 1 ? ` (${g.canaux.length})` : ''}
                          </button>
                        )
                      })}
                    </div>
                    <span className="lu-mx-vise">{groupes.length === 0 ? 'les lampes du plan ne sont pas connues : la couche joue sur toutes' : lampesDeLaCouche(c.canaux, groupes)}{s ? ` · ${s.mode === '2d' ? '2d' : '3d'}` : ''}</span>
                  </div>
                  <span className="lu-mx-ordre" role="group" aria-label={`Place de la couche ${i + 1}`}>
                    <button type="button" className="btn sm" disabled={i === 0} aria-label="Plus prioritaire" title="Plus prioritaire" onClick={() => maj(deplacerCouche(brouillon.couches, i, -1))}>▲</button>
                    <button type="button" className="btn sm" disabled={i === brouillon.couches.length - 1} aria-label="Moins prioritaire" title="Moins prioritaire" onClick={() => maj(deplacerCouche(brouillon.couches, i, 1))}>▼</button>
                    <button type="button" className="btn sm" disabled={brouillon.couches.length === 1} aria-label={`Retirer la couche ${i + 1}`} title="Retirer cette couche" onClick={() => maj(retirerCouche(brouillon.couches, i))}>×</button>
                  </span>
                </li>
              )
            })}
          </ol>
          <div className="lu-ligne">
            <button type="button" className="btn sm" disabled={brouillon.couches.length >= MAX_COUCHES} onClick={() => maj(ajouterCouche(brouillon.couches, scenes[0]?.id ?? ''))}
              title={brouillon.couches.length >= MAX_COUCHES ? `${MAX_COUCHES} couches au plus` : 'Ajoute une couche sous les autres'}>+ couche</button>
            <button type="submit" className="btn sm solid" disabled={!brouillon.nom.trim()}>enregistrer le mix</button>
            <button type="button" className="btn sm" onClick={() => onBrouillon(null)}>annuler</button>
          </div>
          <p className="lu-legende">La pièce 3d montre le mix en cours d’édition. Pour l’envoyer à tes lampes, enregistre-le puis lance-le.</p>
        </form>
      )}
    </div>
  )
}
