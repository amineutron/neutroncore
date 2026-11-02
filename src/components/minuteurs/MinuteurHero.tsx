import { Btn, Chip } from '../ui'
import { compteARebours, dureeParlee, partEcoulee, phaseParlee, restantMaintenant, type Minuteur } from '../../lib/minuteurs'
import type { ActionMinuteur } from './MinuteurCard'
import './minuteurs.css'

type Props = { t: Minuteur; releveA: number; now: number; onAction: (id: string, action: ActionMinuteur) => void }

const R = 108
const CIRC = 2 * Math.PI * R

// Le minuteur principal : chrono en grand qui descend, anneau qui se vide, actions à portée de pouce.
export function MinuteurHero({ t, releveA, now, onAction }: Props) {
  const reste = restantMaintenant(t, releveA, now)
  const fini = t.etat === 'fini'
  const part = partEcoulee(t, reste)
  const urgent = t.etat === 'actif' && reste <= 10
  return (
    <section className={`mn-hero ${t.etat} ${urgent ? 'urgent' : ''}`} aria-label={`minuteur principal : ${t.nom}`}>
      <div className="mn-hero-head">
        <b title={t.nom}>{t.nom}</b>
        {t.pomodoro && <Chip tone="rose">{phaseParlee(t)}</Chip>}
        {t.etat === 'pause' && <Chip>en pause</Chip>}
      </div>
      <div className="mn-ringwrap">
        <svg viewBox="0 0 240 240" className="mn-svg" aria-hidden>
          <circle cx="120" cy="120" r={R} className="mn-track" />
          <circle cx="120" cy="120" r={R} className="mn-arc" strokeDasharray={CIRC} strokeDashoffset={CIRC * part} transform="rotate(-90 120 120)" />
        </svg>
        <div className="mn-bigtime" role="timer" aria-live="off">
          {fini ? (
            <>
              <span className="mn-done">terminé</span>
              <small>{dureeParlee(t.duree_s)}</small>
            </>
          ) : (
            <>
              <span>{compteARebours(reste)}</span>
              <small>sur {dureeParlee(t.duree_s)}</small>
            </>
          )}
        </div>
      </div>
      <div className="mn-actions mn-hero-actions">
        {t.etat === 'actif' && <Btn onClick={() => onAction(t.id, 'pause')}>pause</Btn>}
        {t.etat === 'pause' && <Btn solid onClick={() => onAction(t.id, 'reprendre')}>reprendre</Btn>}
        {!fini && <Btn onClick={() => onAction(t.id, 'plus')}>+1 min</Btn>}
        {fini && <Btn solid onClick={() => onAction(t.id, 'relancer')}>relancer</Btn>}
        <Btn danger onClick={() => onAction(t.id, 'supprimer')}>{fini ? 'retirer' : 'annuler'}</Btn>
      </div>
    </section>
  )
}
