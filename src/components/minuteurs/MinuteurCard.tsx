import { Bar, Btn, Chip } from '../ui'
import { compteARebours, dureeParlee, phaseParlee, restantMaintenant, type Minuteur } from '../../lib/minuteurs'
import './minuteurs.css'

export type ActionMinuteur = 'pause' | 'reprendre' | 'relancer' | 'supprimer' | 'plus'
type Props = { t: Minuteur; releveA: number; now: number; onAction: (id: string, action: ActionMinuteur) => void; onSelect?: (id: string) => void }

// Une carte = un minuteur : compte à rebours décompté localement, actions à portée de pouce.
export function MinuteurCard({ t, releveA, now, onAction, onSelect }: Props) {
  const reste = restantMaintenant(t, releveA, now)
  const fini = t.etat === 'fini'
  const pct = fini ? 100 : t.duree_s ? (1 - reste / t.duree_s) * 100 : 0
  return (
    <div className={`mn-card ${t.etat}`}>
      <div className="nom">
        <b title={t.nom}>{t.nom}</b>
        {t.pomodoro && <Chip tone="rose">{phaseParlee(t)}</Chip>}
        {t.etat === 'pause' && <Chip>en pause</Chip>}
        {fini && <Chip tone="ok">terminé</Chip>}
      </div>
      <div className="mn-time">{fini ? `terminé · ${dureeParlee(t.duree_s)}` : compteARebours(reste)}</div>
      <Bar pct={pct} tone={fini ? 'ok' : undefined} />
      <div className="mn-actions">
        {onSelect && <Btn sm onClick={() => onSelect(t.id)}>en grand</Btn>}
        {t.etat === 'actif' && <Btn sm onClick={() => onAction(t.id, 'pause')}>pause</Btn>}
        {t.etat === 'pause' && <Btn sm solid onClick={() => onAction(t.id, 'reprendre')}>reprendre</Btn>}
        {!fini && <Btn sm onClick={() => onAction(t.id, 'plus')}>+1 min</Btn>}
        {fini && <Btn sm solid onClick={() => onAction(t.id, 'relancer')}>relancer</Btn>}
        <Btn sm danger onClick={() => onAction(t.id, 'supprimer')}>retirer</Btn>
      </div>
    </div>
  )
}
