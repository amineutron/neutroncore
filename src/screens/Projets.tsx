import { useState } from 'react'
import { apiGet, apiPost, withConfirm } from '../lib/api'
import { usePoll, fmtAgo } from '../lib/poll'
import { Btn, Card, Chip, PageTitle } from '../components/ui'

type Project = { name: string; path: string; branch: string; dirty: number; has_remote: boolean; ahead: number; behind: number; last_commit: number | null }
type Updates = { status: string; checked_at?: number; images: { image: string; state: string }[]; updates?: number }
type SysUpdates = { status: string; checked_at?: number; updates: { name: string; version: string; risky: boolean }[]; risky_count?: number }

export function Projets() {
  const projects = usePoll<{ projects: Project[] }>(() => apiGet('/projects'), 60000)
  const updates = usePoll<Updates>(() => apiGet('/projects/updates'), 60000)
  const sysUpdates = usePoll<SysUpdates>(() => apiGet('/system/updates'), 300000)
  const [fetching, setFetching] = useState(false)
  const [checking, setChecking] = useState(false)
  const [sysBusy, setSysBusy] = useState('')
  const [launching, setLaunching] = useState<string | null>(null)

  async function checkSystem() {
    setSysBusy('scan')
    try { await apiPost('/system/updates/check'); sysUpdates.refresh() } finally { setSysBusy('') }
  }
  async function downloadSafe() {
    setSysBusy('dl')
    try {
      const r = await apiPost<{ downloaded: number; dir?: string }>('/system/updates/download?safe_only=true')
      window.alert(`${r.downloaded} RPM téléchargés dans ${r.dir ?? '~/.neutroncore/updates'} — installation à faire en terminal (sudo dnf install ...).`)
    } finally { setSysBusy('') }
  }

  async function gitFetch() {
    setFetching(true)
    try { await apiPost('/projects/fetch'); projects.refresh() } finally { setFetching(false) }
  }
  async function checkUpdates() {
    setChecking(true)
    try { await apiPost('/projects/check-updates'); updates.refresh() } finally { setChecking(false) }
  }
  async function openClaude(path: string) {
    setLaunching(path)
    try { await apiPost('/launcher/claude', { path }, await withConfirm('launcher_claude')) } finally { setLaunching(null) }
  }

  const upd = updates.data
  return (
    <>
      <PageTitle help="projets" title="projets & mises à jour" desc="L'état de ~/dev en une page : git, images Docker, dérives." />
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Btn sm onClick={gitFetch} disabled={fetching}>{fetching ? 'fetch…' : 'git fetch (tous)'}</Btn>
        <Btn sm onClick={checkUpdates} disabled={checking}>{checking ? 'vérification…' : 'vérifier les images docker'}</Btn>
      </div>

      <Card title="dépôts" lite="~/dev" style={{ marginBottom: 14 }}>
        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>projet</th><th>branche</th><th>état</th><th>sync</th><th style={{ textAlign: 'right' }}>dernier commit</th><th /></tr>
            </thead>
            <tbody>
              {(projects.data?.projects ?? []).map((p) => (
                <tr key={p.name}>
                  <td className="mono"><b>{p.name}</b></td>
                  <td className="mono" style={{ color: 'var(--muted)' }}>{p.has_remote ? p.branch : `${p.branch} · local`}</td>
                  <td>{p.dirty > 0 ? <Chip tone="warn">{p.dirty} modifié{p.dirty > 1 ? 's' : ''}</Chip> : <Chip tone="ok">propre</Chip>}</td>
                  <td className="num" style={{ color: p.behind > 0 ? 'var(--warn)' : 'var(--muted)' }}>
                    {p.has_remote ? `↑${p.ahead} ↓${p.behind}` : '—'}
                  </td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--faint)' }}>{fmtAgo(p.last_commit)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Btn sm disabled={launching === p.path} onClick={() => openClaude(p.path)}>ouvrir claude</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="mises à jour système" lite={sysUpdates.data?.checked_at ? `dnf · vérifié ${fmtAgo(sysUpdates.data.checked_at)}` : 'dnf · jamais scanné'} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Btn sm onClick={checkSystem} disabled={sysBusy !== ''}>{sysBusy === 'scan' ? 'scan…' : 'scanner'}</Btn>
          <Btn sm onClick={downloadSafe} disabled={sysBusy !== '' || !(sysUpdates.data?.updates ?? []).some((u) => !u.risky)}>
            {sysBusy === 'dl' ? 'téléchargement…' : 'télécharger les sûres'}
          </Btn>
          {(sysUpdates.data?.risky_count ?? 0) > 0 && (
            <Chip tone="warn">{sysUpdates.data?.risky_count} risquée(s) — redémarrage conseillé</Chip>
          )}
        </div>
        {(sysUpdates.data?.updates ?? []).length > 0 ? (
          <div className="scroll-x" style={{ maxHeight: 220, overflowY: 'auto' }}>
            <table>
              <tbody>
                {(sysUpdates.data?.updates ?? []).map((u) => (
                  <tr key={u.name}>
                    <td className="mono" style={{ fontSize: 11.5 }}>{u.name}</td>
                    <td className="num" style={{ color: 'var(--muted)', fontSize: 11 }}>{u.version}</td>
                    <td style={{ textAlign: 'right' }}>
                      {u.risky ? <Chip tone="warn">risquée · reboot</Chip> : <Chip tone="ok">sûre</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: sysUpdates.data?.status === 'done' ? 'var(--ok)' : 'var(--muted)' }}>
            {sysUpdates.data?.status === 'done' ? 'Système à jour.' : 'Lance un scan pour voir les mises à jour dnf disponibles.'}
          </p>
        )}
      </Card>

      <Card title="mises à jour docker" lite={upd?.checked_at ? `vérifié ${fmtAgo(upd.checked_at)}` : 'jamais vérifié'}>
        {upd?.status === 'never_run' && (
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Lance « vérifier les images docker » pour comparer les digests locaux aux registres.</p>
        )}
        {upd?.status === 'done' && (
          <>
            {upd.images.filter((i) => i.state === 'update_available').map((i) => (
              <div className="upd" key={i.image}>
                <div className="t"><b>{i.image}</b><span>nouvelle version disponible sur le registre</span></div>
                <Chip tone="gold">mise à jour dispo</Chip>
              </div>
            ))}
            {(upd.updates ?? 0) === 0 && <p style={{ fontSize: 12.5, color: 'var(--ok)' }}>Toutes les images sont à jour.</p>}
            {upd.images.some((i) => i.state === 'unknown') && (
              <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>
                {upd.images.filter((i) => i.state === 'unknown').length} image(s) non comparables (digest local absent).
              </p>
            )}
          </>
        )}
        <div className="comet" />
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          neutroncore montre l'état — les pulls et mises à jour se font en terminal (ou via le lanceur).
        </span>
      </Card>
    </>
  )
}
