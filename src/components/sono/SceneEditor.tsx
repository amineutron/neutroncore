import { nomsAppareils, phraseScene, sceneAvec, type Appareil, type Scene, type Zone } from '../../lib/zonesAudio'
import { Card } from '../ui'

type Props = {
  scene: Scene
  zones: Zone[]
  appareils: Appareil[]
  plafond: number
  onChange: (s: Scene) => void
  onSave: () => void
  onPlay: () => void
  onClose: () => void
}

/** Édition d'une scène de volume : une ligne par zone, un curseur, un aperçu en phrase. */
export function SceneEditor({ scene, zones, appareils, plafond, onChange, onSave, onPlay, onClose }: Props) {
  const noms = Object.fromEntries(zones.map((z) => [z.id, z.nom]))
  return (
    <Card title="scène de volume" lite="ambiance">
      <label className="rv-champ">nom de la scène
        <input type="text" maxLength={40} value={scene.nom} placeholder="ambiance soirée" onChange={(e) => onChange({ ...scene, nom: e.target.value })} />
      </label>
      <p className="sn-etape">choisis les zones et leur volume</p>
      {zones.length === 0 && <p className="nc-empty">crée d’abord une zone : une scène règle le volume des zones.</p>}
      <div className="rv-liste">
        {zones.map((z) => {
          const dedans = z.id in scene.volumes
          const max = Math.min(z.volume_max, plafond)
          const v = Math.min(scene.volumes[z.id] ?? z.volume, max)
          return (
            <div key={z.id} className={`sn-ligne-scene ${dedans ? 'on' : ''}`}>
              <label className="sn-case"><input type="checkbox" checked={dedans} onChange={(e) => onChange({ ...scene, volumes: sceneAvec(scene.volumes, z, e.target.checked) })} />
                <span><b>{z.nom}</b><small>{nomsAppareils(z.appareils ?? [], appareils).join(', ') || z.appareil || 'appareil par défaut'}</small></span></label>
              <div className="rv-vol">
                <input type="range" min={0} max={max} value={v} disabled={!dedans} aria-label={`volume de ${z.nom} dans la scène`}
                  onChange={(e) => onChange({ ...scene, volumes: { ...scene.volumes, [z.id]: Number(e.target.value) } })} />
                <output>{dedans ? v : '-'}</output>
              </div>
            </div>
          )
        })}
      </div>
      <p className="sn-phrase" aria-live="polite">{phraseScene(scene.nom || 'scène', scene.volumes, noms)}</p>
      <div className="rv-ligne" style={{ marginTop: 10 }}>
        <button className="btn solid sn-gros" disabled={!scene.nom.trim() || !Object.keys(scene.volumes).length} onClick={onSave}>enregistrer</button>
        <button className="btn sn-gros" disabled={!scene.nom.trim() || !Object.keys(scene.volumes).length} onClick={onPlay}>enregistrer et jouer</button>
        <button className="btn sn-gros" onClick={onClose}>fermer</button>
      </div>
    </Card>
  )
}
