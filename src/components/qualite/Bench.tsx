import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { fmtAgo } from '../../lib/poll'
import { commitCourt, ecrirePref, fmtDuree, lirePref, phraseBench, type Comparaison, type DetailSuite } from '../../lib/qualite'
import { Btn, Card, Chip } from '../ui'

const PREF = 'neutroncore_qualite_bench'
type Mode = 'runs' | 'commits'

const LIGNES: [keyof Comparaison['comptes'], string][] = [['passed', 'réussis'], ['failed', 'échecs'], ['errors', 'erreurs'], ['skipped', 'ignorés']]

// Bench : durée et résultats entre deux runs, ou entre deux versions (commits) de la batterie.
export function Bench({ detail }: { detail: DetailSuite }) {
  const [mode, setMode] = useState<Mode>(() => lirePref<Mode>(`${PREF}_mode`, 'runs'))
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [res, setRes] = useState<Comparaison | null>(null)
  const [erreur, setErreur] = useState('')

  const options = mode === 'runs'
    ? detail.runs.map((r) => ({ v: r.id, t: `${fmtAgo(r.started)} · ${fmtDuree(r.duree)} · ${r.ok ? 'réussi' : 'échec'}` }))
    : detail.commits.map((c) => ({ v: c.commit, t: `${commitCourt(c.commit)} · ${c.runs} run${c.runs > 1 ? 's' : ''} (${c.ok} réussi${c.ok > 1 ? 's' : ''})` }))

  // par défaut : l'avant-dernier contre le dernier, remis à zéro quand la batterie ou le mode change
  useEffect(() => {
    setRes(null); setErreur('')
    setA(options[1]?.v ?? options[0]?.v ?? '')
    setB(options[0]?.v ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.suite, mode])

  function choisir(m: Mode) { setMode(m); ecrirePref(`${PREF}_mode`, m) }

  async function comparer() {
    setErreur('')
    const q = mode === 'runs' ? `a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}` : `commit_a=${encodeURIComponent(a)}&commit_b=${encodeURIComponent(b)}`
    try { setRes(await apiGet<Comparaison>(`/tests/sante/bench?suite=${encodeURIComponent(detail.suite)}&${q}`)) }
    catch (e) { setRes(null); setErreur((e as Error).message); toast('comparaison impossible', 'crit') }
  }

  const ton = res?.resultat === 'regression' ? 'crit' : res?.resultat === 'corrige' ? 'ok' : undefined
  const selecteur = (val: string, set: (v: string) => void, nom: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--muted)', minWidth: 0, flex: 1 }}>{nom}
      <select value={val} onChange={(e) => set(e.target.value)} style={{ minWidth: 0 }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </label>
  )

  return (
    <Card title="bench" lite="comparer deux runs ou deux versions">
      <div className="glyph-tabs" style={{ marginBottom: 10 }}>
        <button className={mode === 'runs' ? 'on' : ''} onClick={() => choisir('runs')}>deux runs</button>
        <button className={mode === 'commits' ? 'on' : ''} onClick={() => choisir('commits')}>deux commits</button>
      </div>
      {options.length < 2 && <p style={{ color: 'var(--faint)', fontSize: 12 }}>Il faut au moins deux {mode === 'runs' ? 'runs' : 'commits différents'} dans l'historique.</p>}
      {options.length >= 2 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {selecteur(a, setA, 'référence')}
          {selecteur(b, setB, 'à comparer')}
          <Btn sm solid disabled={!a || !b || a === b} onClick={() => void comparer()}>comparer</Btn>
        </div>
      )}
      {mode === 'commits' && <p style={{ color: 'var(--faint)', fontSize: 11, marginTop: 8 }}>Par commit, la durée comparée est la médiane de ses runs : un seul run est du bruit.</p>}
      {erreur && <div style={{ marginTop: 10 }}><Chip tone="crit">{erreur}</Chip></div>}
      {res && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <Chip tone={ton}>{res.resultat === 'regression' ? 'régression' : res.resultat === 'corrige' ? 'corrigé' : 'même résultat'}</Chip>
            <Chip tone={res.duree.verdict === 'plus_lent' ? 'warn' : res.duree.verdict === 'plus_rapide' ? 'ok' : undefined}>
              {fmtDuree(res.duree.a)} → {fmtDuree(res.duree.b)} ({res.duree.variation_pct > 0 ? '+' : ''}{res.duree.variation_pct} %)
            </Chip>
          </div>
          <p style={{ fontSize: 12.5, marginBottom: 10 }}>{phraseBench(res)}</p>
          <table style={{ fontFamily: 'var(--mono)', fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              {LIGNES.map(([k, nom]) => (
                <tr key={k}>
                  <td style={{ padding: '2px 14px 2px 0', color: 'var(--muted)' }}>{nom}</td>
                  <td style={{ padding: '2px 10px' }}>{res.comptes[k].a}</td>
                  <td style={{ padding: '2px 10px' }}>{res.comptes[k].b}</td>
                  <td style={{ padding: '2px 10px', color: res.comptes[k].ecart === 0 ? 'var(--faint)' : k === 'passed' ? (res.comptes[k].ecart > 0 ? 'var(--ok)' : 'var(--crit)') : (res.comptes[k].ecart > 0 ? 'var(--crit)' : 'var(--ok)') }}>
                    {res.comptes[k].ecart > 0 ? '+' : ''}{res.comptes[k].ecart}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {([['nouveaux échecs', res.nouveaux_echecs, 'crit'], ['corrigés', res.corriges, 'ok'], ['toujours en échec', res.toujours_en_echec, 'warn']] as const).map(([nom, liste, tone]) =>
            liste.length > 0 && (
              <div key={nom} style={{ marginTop: 10 }}>
                <Chip tone={tone}>{nom} : {liste.length}</Chip>
                {liste.slice(0, 8).map((t) => <div key={t} className="logline">{t}</div>)}
                {liste.length > 8 && <div className="logline">… et {liste.length - 8} autres</div>}
              </div>
            ))}
        </div>
      )}
    </Card>
  )
}
