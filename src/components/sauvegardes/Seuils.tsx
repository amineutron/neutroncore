import { NumField } from '../NumField'
import type { Reglages } from '../../lib/sauvegardes'

const CHAMPS: { cle: keyof Reglages; label: string; min: number; max: number; aide: string }[] = [
  { cle: 'timeshift_max_h', label: 'timeshift : alerte au-delà de (heures)', min: 6, max: 720, aide: 'un snapshot par jour à 03:00' },
  { cle: 'borg_max_j', label: 'borg : alerte au-delà de (jours)', min: 1, max: 120, aide: 'une archive par dimanche' },
  { cle: 'verif_max_j', label: 'test de restauration : à refaire après (jours)', min: 1, max: 365, aide: 'dernière vérification' },
  { cle: 'liste_max', label: 'lignes par liste', min: 5, max: 200, aide: 'taille de l\'historique affiché' },
]

export function Seuils({ reglages, onChange }: { reglages: Reglages; onChange: (p: Partial<Reglages>) => void }) {
  return (
    <details className="card">
      <summary><b>seuils d'alerte</b></summary>
      <p className="au-note">Une alerte apparaît sur l'accueil et dans le centre de notifications quand une sauvegarde dépasse son seuil.</p>
      <div className="sv-regl">
        {CHAMPS.map((c) => (
          <label key={c.cle}>{c.label}
            <NumField value={reglages[c.cle]} min={c.min} max={c.max} label={c.label} onCommit={(v) => onChange({ [c.cle]: v })} />
            <small className="au-note">{c.aide}</small>
          </label>
        ))}
      </div>
    </details>
  )
}
