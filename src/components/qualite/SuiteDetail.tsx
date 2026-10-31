import { useState } from 'react'
import { apiDelete, apiGet, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { fmtAgo, usePoll } from '../../lib/poll'
import { commitCourt, etiquetteTendance, fmtDuree, type DetailSuite } from '../../lib/qualite'
import { Btn, Card, Chip, Loader } from '../ui'
import { Bench } from './Bench'
import { Courbe } from './Courbe'

// Détail d'une batterie : tendance, tests instables, historique des runs, bench.
export function SuiteDetail({ suite, onPurge }: { suite: string; onPurge: () => void }) {
  const d = usePoll<DetailSuite>(() => apiGet(`/tests/sante/suite?suite=${encodeURIComponent(suite)}`), 10000)
  const [tout, setTout] = useState(false)
  if (d.error && !d.data) return <Card><Chip tone="crit">{d.error}</Chip></Card>
  if (!d.data) return <Card><Loader label="lecture de l'historique…" /></Card>
  const s = d.data
  const t = etiquetteTendance(s.tendance)
  const runs = tout ? s.runs : s.runs.slice(0, 12)

  async function purger() {
    if (!(await confirmDialog({ title: 'effacer l\'historique ?', body: `Les ${s.runs.length} runs enregistrés de « ${s.label} » sont effacés d'ici. Les tests eux-mêmes ne bougent pas.`, ok: 'effacer', danger: true }))) return
    try { await apiDelete(`/tests/sante/suite?suite=${encodeURIComponent(suite)}`, await withConfirm('tests_sante_purger')); toast('historique effacé'); onPurge() }
    catch { toast('effacement refusé', 'crit') }
  }

  return (
    <>
      <Card title={s.label} lite={`${s.instabilite.runs} derniers runs · ${s.instabilite.taux_reussite} % de réussite`} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Courbe valeurs={s.tendance.points} w={200} h={40} tone={t.tone === 'warn' ? 'warn' : t.tone === 'ok' ? 'ok' : ''} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chip tone={t.tone || undefined}>{t.texte}</Chip>
            {s.tendance.etat !== 'insuffisant' && <Chip>médiane {fmtDuree(s.tendance.mediane)}</Chip>}
            {s.instabilite.instable && <Chip tone="warn">instable : {s.instabilite.bascules} changements de résultat</Chip>}
            {s.instabilite.meme_commit.length > 0 && <Chip tone="crit">même code, deux résultats ({s.instabilite.meme_commit.map(commitCourt).join(', ')})</Chip>}
          </div>
          <span style={{ flex: 1 }} />
          <Btn sm danger onClick={() => void purger()}>effacer l'historique</Btn>
        </div>
      </Card>

      {s.instables.length > 0 && (
        <Card title="tests instables" lite="échouent puis repassent sur les derniers runs" style={{ marginBottom: 12 }}>
          {s.instables.map((x) => (
            <div key={x.test} className="logline" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="dot warn" />
              <b style={{ flex: 1, minWidth: 0 }}>{x.test}</b>
              <span>{x.echecs} échec{x.echecs > 1 ? 's' : ''} sur {x.runs} · {x.bascules} bascule{x.bascules > 1 ? 's' : ''}</span>
              {x.meme_commit && <Chip tone="crit">même commit</Chip>}
            </div>
          ))}
        </Card>
      )}

      <Card title="historique des runs" lite="du plus récent au plus ancien" style={{ marginBottom: 12 }}>
        {runs.map((r) => (
          <div key={r.id} className="logline" style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }} title={r.echecs.join('\n')}>
            <span className={`dot ${r.ok ? 'ok' : 'crit'}`} />
            <span style={{ minWidth: 86 }}>{fmtAgo(r.started)}</span>
            <b style={{ minWidth: 60 }}>{fmtDuree(r.duree)}</b>
            <span>{commitCourt(r.commit)}{r.dirty ? ' + modifs' : ''}</span>
            <span style={{ flex: 1, minWidth: 0 }}>{r.resume}</span>
            {r.echecs.length > 0 && <span style={{ color: 'var(--crit)' }}>{r.echecs.slice(0, 2).join(', ')}{r.echecs.length > 2 ? ` +${r.echecs.length - 2}` : ''}</span>}
          </div>
        ))}
        {s.runs.length > 12 && <div style={{ marginTop: 8 }}><Btn sm onClick={() => setTout(!tout)}>{tout ? 'voir moins' : `voir les ${s.runs.length} runs`}</Btn></div>}
      </Card>

      <Bench detail={s} />
    </>
  )
}
