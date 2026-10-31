import { LIBELLE_STATUT, tonStatut, type Passage } from '../../lib/rotation'
import { Chip } from '../ui'

const PUCE = { ok: 'ok', echec: 'KO', saute: '-', simule: '~' } as const

// Étapes d'un passage : jamais de valeur de secret, seulement ce qui a été fait ou refusé.
export function RunSteps({ run }: { run: Passage }) {
  return (
    <div className="rot-run">
      <div className="sec-row" style={{ flexWrap: 'wrap' }}>
        <Chip tone={tonStatut(run.statut)}>{LIBELLE_STATUT[run.statut]}</Chip>
        <span className="sec-muted">{run.reel ? 'rotation réelle' : "essai à blanc, rien n'a été modifié"}</span>
      </div>
      <p className="rot-resume">{run.resume}</p>
      <ol className="rot-steps">
        {run.etapes.map((e, i) => (
          <li key={`${e.id}-${i}`} className={`s-${e.etat}`}>
            <b className="rot-puce">{PUCE[e.etat]}</b>
            <span>{e.libelle}{e.detail ? <em> : {e.detail}</em> : null}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
