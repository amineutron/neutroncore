import { absents, basculer, cartesDe, nomsAppareils, type Appareil, type Zone } from '../../lib/zonesAudio'
import { Card } from '../ui'
import { AppareilCard } from './AppareilCard'

type Props = {
  zone: Zone
  appareils: Appareil[]
  plafond: number
  multi: boolean
  onChange: (z: Zone) => void
  onSave: () => void
  onClose: () => void
}

/** Édition d'une zone : un nom, des cartes d'appareils à cocher, un volume maximum. */
export function ZoneEditor({ zone, appareils, plafond, multi, onChange, onSave, onClose }: Props) {
  const ids = cartesDe(zone)
  const perdus = absents(ids, appareils)
  const fantomes = perdus.map((id): Appareil => ({ id, type: id === 'denon' ? 'denon' : id.startsWith('cast:') ? 'chromecast' : id === 'tv' ? 'tv' : 'pc', nom: 'appareil absent', hote: id.split(':')[1] ?? '', etat: 'absent', detail: 'plus vu depuis la dernière fois', volume: null, pilotable: false }))
  const toutes = [...appareils, ...fantomes]
  const phrase = ids.length ? `cette zone fera jouer ${nomsAppareils(ids, toutes).join(', ')}` : 'aucun appareil coché : coche au moins une carte'
  const aCaster = ids.some((i) => i.startsWith('cast:'))
  return (
    <Card title="zone" lite={zone.id}>
      <label className="rv-champ">nom de la zone
        <input type="text" maxLength={40} value={zone.nom} placeholder="salon, cuisine, terrasse…" onChange={(e) => onChange({ ...zone, nom: e.target.value })} />
      </label>
      <p className="sn-etape">1. coche les appareils qui jouent ensemble</p>
      {toutes.length === 0 && <p className="nc-empty">aucun appareil détecté : rien à cocher pour l’instant.</p>}
      <div className="sn-grille">
        {toutes.map((a) => (
          <AppareilCard key={a.id} appareil={a} choisi={ids.includes(a.id)} onChoisir={() => onChange({ ...zone, appareils: basculer(ids, a.id) })}
            note={a.type === 'tv' ? 'le son passe par l’ampli : volume non réglable ici' : a.type === 'pc' ? 'volume non réglable ici' : undefined} />
        ))}
      </div>
      <p className="sn-etape">2. fixe le volume maximum de la zone</p>
      <div className="rv-vol">
        <input type="range" min={0} max={plafond} value={zone.volume_max} aria-label="volume maximum"
          onChange={(e) => { const m = Number(e.target.value); onChange({ ...zone, volume_max: m, volume: Math.min(zone.volume, m) }) }} />
        <output>{zone.volume_max}</output>
      </div>
      <p className="sn-phrase">{phrase}, jamais au-dessus de {zone.volume_max}.</p>
      {aCaster && !multi && <p className="rv-note">le serveur catt ne vise qu’un appareil : les enceintes cochées seront refusées tant que ce réglage n’est pas activé (écran, en haut).</p>}
      <div className="rv-ligne" style={{ marginTop: 10 }}>
        <button className="btn solid sn-gros" disabled={!zone.nom.trim() || ids.length === 0} onClick={onSave}>enregistrer la zone</button>
        <button className="btn sn-gros" onClick={onClose}>fermer</button>
      </div>
    </Card>
  )
}
