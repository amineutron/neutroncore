import { Fragment } from 'react'
import { fmtBytes } from '../../lib/poll'
import {
  courbe, fmtAge, fmtDuree, joursAvantPlein, phraseTendance, tonAge, tonEspace,
  type Durees, type Espace, type Planif, type Tendance,
} from '../../lib/sauvegardes'
import { Bar, Btn, Card, Chip } from '../ui'

type Props = {
  titre: string; lite: string; age: number | null; limiteJours: number; total: number
  taille: number | null; tendanceTaille: Tendance; points: (number | null | undefined)[]
  duree: Durees; espace: Espace | null; planif: Planif; croissanceJour: number | null
  lignesEnPlus?: [string, string][]; occupe: boolean; onLancer: () => void
}

// Une carte par source : âge, taille, durée, tendance, espace restant, prochain passage, lancement.
export function Resume(p: Props) {
  const ton = tonAge(p.age, p.limiteJours)
  const e = p.espace
  const plein = joursAvantPlein(e, p.croissanceJour)
  return (
    <Card title={p.titre} lite={p.lite}>
      <div className="sv-age">{fmtAge(p.age)}</div>
      <Chip tone={ton}>{ton === 'ok' ? 'à jour' : ton === 'warn' ? 'en retard' : 'trop ancienne'}</Chip>{' '}
      {p.planif.unite?.state === 'failed' && <Chip tone="crit">dernier passage en échec</Chip>}
      {p.planif.minuteur_actif === false && <Chip tone="warn">minuteur inactif</Chip>}
      <svg className="sv-courbe" viewBox="0 0 100 34" preserveAspectRatio="none" role="img" aria-label="évolution de la taille">
        <polyline points={courbe(p.points, 100, 34)} />
      </svg>
      <dl className="sv-kv">
        <dt>sauvegardes gardées</dt><dd>{p.total}</dd>
        <dt>taille de la dernière</dt><dd>{p.taille != null ? fmtBytes(p.taille) : '-'}</dd>
        <dt>évolution de la taille</dt><dd>{phraseTendance(p.tendanceTaille)}</dd>
        <dt>durée moyenne</dt><dd>{fmtDuree(p.duree.moyenne_s)} (max {fmtDuree(p.duree.max_s)})</dd>
        <dt>évolution de la durée</dt><dd>{phraseTendance(p.duree.tendance, 'plus long')}</dd>
        <dt>prochain passage</dt><dd>{p.planif.prochain ? p.planif.prochain.replace('T', ' ') : '-'}</dd>
        {p.lignesEnPlus?.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
      </dl>
      {e && (
        <>
          <Bar pct={100 - (e.libre_pct ?? 0)} tone={tonEspace(e.libre_pct)} />
          <dl className="sv-kv">
            <dt>espace restant ({e.montage})</dt><dd>{fmtBytes(e.libre)} sur {fmtBytes(e.total)} ({e.libre_pct ?? '?'} %)</dd>
            {plein != null && <><dt>plein dans environ</dt><dd>{plein} j au rythme actuel</dd></>}
          </dl>
        </>
      )}
      <div className="sv-actions"><Btn sm disabled={p.occupe} onClick={p.onLancer}>lancer maintenant</Btn></div>
    </Card>
  )
}
