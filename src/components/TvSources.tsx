import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { hhmm, isProblem, STATUS, type Occurrence } from './AgendaParts'
import { iso } from './AgendaViews'
import type { EtatBranches } from '../lib/branches'
import type { Moteur } from '../lib/camera'
import type { MissingEpisode, MissingMovie } from '../lib/missing'
import { Card, Chip, Dot } from './ui'

// Sources du mode télé ajoutées après coup : chaque bloc relève ses propres données,
// donc rien n'est interrogé tant que la source est désactivée. `size` (1 à 3) règle
// le nombre de lignes affichées.

type Tone = 'ok' | 'warn' | 'crit'
const rows = (size: number) => (size === 1 ? 2 : size === 3 ? 7 : 4)
const mono = { fontSize: 12, color: 'var(--muted)' } as const
const line = { marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
const ageLabel = (iso?: string | null) => {
  if (!iso) return 'jamais'
  const h = (Date.now() - new Date(iso).getTime()) / 3600000
  return h < 1 ? 'il y a moins d\'1 h' : h < 48 ? `il y a ${Math.round(h)} h` : `il y a ${Math.round(h / 24)} j`
}

export function TvAgenda({ size }: { size: number }) {
  const today = iso(new Date())
  const agenda = usePoll<{ occurrences: Occurrence[] }>(() => apiGet(`/agenda?start=${today}&end=${today}`), 120000)
  const list = (agenda.data?.occurrences ?? []).filter((o) => o.start.slice(0, 10) === today)
    .sort((a, b) => a.start.localeCompare(b.start))
  const problems = list.filter(isProblem).length
  return (
    <Card title="agenda du jour" lite={problems ? `${problems} à revoir` : `${list.length} prévus`}>
      {list.length === 0 && <span style={{ color: 'var(--faint)' }}>rien de prévu aujourd'hui</span>}
      {list.slice(0, rows(size) + 2).map((o) => (
        <div key={o.id} style={line}>
          <span className="mono" style={{ color: 'var(--gold)', marginRight: 8 }}>{hhmm(o.start)}</span>
          {o.title}
          {isProblem(o) && <span style={{ marginLeft: 8 }}><Chip tone="crit">{STATUS[o.status].label}</Chip></span>}
        </div>
      ))}
    </Card>
  )
}

type Unit = { state: 'ok' | 'failed' | 'running' | 'never' | 'missing'; last_run: string | null }
const UNIT_TONE: Record<Unit['state'], Tone | undefined> = { ok: 'ok', failed: 'crit', running: undefined, never: 'warn', missing: 'warn' }
const UNIT_LABEL: Record<Unit['state'], string> = { ok: 'ok', failed: 'échec', running: 'en cours', never: 'jamais lancé', missing: 'non installé' }

export function TvBackups() {
  const b = usePoll<{ borg: Unit; timeshift: Unit }>(() => apiGet('/system/backups'), 300000)
  const units: [string, Unit | undefined][] = [['timeshift', b.data?.timeshift], ['borg', b.data?.borg]]
  return (
    <Card title="sauvegardes">
      {units.map(([name, u]) => (
        <div key={name} style={{ ...line, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Dot s={u ? UNIT_TONE[u.state] ?? 'off' : 'off'} /> <b className="mono">{name}</b>
          <span style={mono}>{u ? `${UNIT_LABEL[u.state]}, ${ageLabel(u.last_run)}` : '…'}</span>
        </div>
      ))}
    </Card>
  )
}

export function TvBranches({ size }: { size: number }) {
  const e = usePoll<EtatBranches>(() => apiGet('/branches'), 300000)
  const r = e.data?.resume
  const prs = (e.data?.depots ?? []).flatMap((d) => (d.prs ?? []).map((p) => ({ ...p, depot: d.depot })))
  return (
    <Card title="branches & pr" lite={r ? `${r.prs} PR ouvertes` : undefined}>
      {r && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <Chip tone={r.conflits ? 'crit' : 'ok'}>{r.conflits} conflit{r.conflits > 1 ? 's' : ''}</Chip>
          <Chip tone={r.sans_pr ? 'warn' : 'ok'}>{r.sans_pr} sans PR</Chip>
          <Chip>{r.fusionnees} à supprimer</Chip>
        </div>
      )}
      {prs.slice(0, rows(size)).map((p) => (
        <div key={`${p.depot}#${p.numero}`} style={line}>
          <Dot s={p.conflit ? 'crit' : 'ok'} /> <span className="mono" style={mono}>{p.depot} #{p.numero}</span> {p.titre}
        </div>
      ))}
    </Card>
  )
}

type Run = { id: string; kind: string; targets: string[]; status: 'running' | 'ok' | 'fail'; started: number }

export function TvTests({ size }: { size: number }) {
  const t = usePoll<{ runs: Run[] }>(() => apiGet('/tests/runs'), 15000)
  const runs = [...(t.data?.runs ?? [])].sort((a, b) => b.started - a.started)
  const tone = (s: Run['status']): Tone | 'off' => (s === 'ok' ? 'ok' : s === 'fail' ? 'crit' : 'warn')
  return (
    <Card title="tests" lite={runs.some((r) => r.status === 'running') ? 'en cours' : undefined}>
      {runs.length === 0 && <span style={{ color: 'var(--faint)' }}>aucune batterie lancée</span>}
      {runs.slice(0, rows(size)).map((r) => (
        <div key={r.id} style={line}>
          <Dot s={tone(r.status)} /> {r.targets.join(', ') || r.kind}
          <span style={{ ...mono, marginLeft: 8 }}>{ageLabel(new Date(r.started * 1000).toISOString())}</span>
        </div>
      ))}
    </Card>
  )
}

type Spatial = { huebeat: { actif: boolean; silence?: boolean; bpm?: number }; reel: { nom: string; pause?: boolean } | null }

export function TvLumiere3d() {
  const s = usePoll<Spatial>(() => apiGet('/spatial'), 5000)
  const live = s.data?.reel && s.data.huebeat.actif
  return (
    <Card title="lumière 3d" lite={live ? 'en direct' : 'arrêtée'}>
      {live ? (
        <>
          <div style={line}><Dot s={s.data?.reel?.pause ? 'warn' : 'ok'} /> <b>{s.data?.reel?.nom}</b></div>
          <div className="mono" style={mono}>
            {s.data?.huebeat.bpm ? `${Math.round(s.data.huebeat.bpm)} bpm` : 'tempo en recherche'}
            {s.data?.huebeat.silence ? ' · silence' : ''}{s.data?.reel?.pause ? ' · en pause' : ''}
          </div>
        </>
      ) : <span style={{ color: 'var(--faint)' }}>les lampes ne jouent pas d'effet</span>}
    </Card>
  )
}

export function TvCamera() {
  const c = usePoll<{ installee?: boolean; moteur: Moteur; reglages: { fond: { mode: string }; veille?: boolean } }>(() => apiGet('/camera'), 10000)
  const m = c.data?.moteur
  return (
    <Card title="caméra" lite={m?.actif ? 'allumée' : 'éteinte'}>
      {c.data?.installee === false && <span style={{ color: 'var(--faint)' }}>non installée</span>}
      {m?.actif ? (
        <div className="mono" style={mono}>
          fond {c.data?.reglages.fond.mode}{m.fps ? ` · ${Math.round(m.fps)} images/s` : ''}{c.data?.reglages.veille ? ' · veille' : ''}
        </div>
      ) : c.data?.installee !== false && <span style={{ color: 'var(--faint)' }}>moteur arrêté</span>}
      {m?.erreur && <Chip tone="crit">{m.erreur}</Chip>}
    </Card>
  )
}

export function TvMaj({ size }: { size: number }) {
  const sys = usePoll<{ status: string; updates: { name: string; risky: boolean }[]; risky_count?: number }>(() => apiGet('/system/updates'), 300000)
  const proj = usePoll<{ updates?: number }>(() => apiGet('/projects/updates'), 300000)
  const n = sys.data?.updates?.length ?? 0
  const risky = sys.data?.updates?.filter((u) => u.risky) ?? []
  return (
    <Card title="mises à jour" lite={`${n} paquets`}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <Chip tone={n ? 'warn' : 'ok'}>{n} système</Chip>
        <Chip tone={risky.length ? 'crit' : 'ok'}>{risky.length} sensibles</Chip>
        <Chip tone={proj.data?.updates ? 'warn' : 'ok'}>{proj.data?.updates ?? 0} images</Chip>
      </div>
      {size > 1 && risky.slice(0, rows(size)).map((u) => <div key={u.name} className="mono" style={{ ...line, fontSize: 12 }}>{u.name}</div>)}
    </Card>
  )
}

export function TvTele() {
  const t = usePoll<{ power: string; volume: number; muted: boolean; ambilight_mode: string; denon_volume: number | null; denon_power?: string; denon_source?: string }>(() => apiGet('/tv/status'), 20000)
  const d = t.data
  const on = d?.power === 'On'
  return (
    <Card title="télé & ampli" lite={d ? (on ? 'allumée' : 'en veille') : undefined}>
      {d && (
        <div className="mono" style={mono}>
          <div>volume tv {d.muted ? 'coupé' : d.volume} · ambilight {d.ambilight_mode.toLowerCase()}</div>
          {d.denon_power && <div>ampli {d.denon_power.toLowerCase()}{d.denon_volume != null ? ` · vol ${d.denon_volume}` : ''}{d.denon_source ? ` · ${d.denon_source}` : ''}</div>}
        </div>
      )}
    </Card>
  )
}

export function TvDebit() {
  const q = usePoll<{ dl_speed_fmt: string; ul_speed_fmt?: string; connection_status: string }>(() => apiGet('/qbit/stats'), 10000)
  return (
    <Card title="téléchargements" lite={q.data?.connection_status}>
      <div style={{ fontSize: 22 }}>{q.data?.dl_speed_fmt ?? '…'}</div>
      {q.data?.ul_speed_fmt && <span className="mono" style={mono}>envoi {q.data.ul_speed_fmt}</span>}
    </Card>
  )
}

export function TvRoadmap({ size }: { size: number }) {
  type P = { key: string; name: string; state: string; totals: { percent: number; waiting: number; blocked: number }; next: { title: string }[] }
  const r = usePoll<{ projects: P[] }>(() => apiGet('/roadmap/projects'), 120000)
  const list = (r.data?.projects ?? []).filter((p) => p.state === 'actif')
  return (
    <Card title="roadmap" lite={`${list.length} projets actifs`}>
      {list.slice(0, rows(size) - 1).map((p) => (
        <div key={p.key} style={line}>
          <b>{p.name}</b> <span className="mono" style={mono}>{p.totals.percent}%{p.totals.waiting ? ` · ${p.totals.waiting} en attente` : ''}</span>
          {size > 1 && p.next[0] && <div style={{ ...mono, paddingLeft: 10 }}>{p.next[0].title}</div>}
        </div>
      ))}
    </Card>
  )
}

export function TvManquants({ size }: { size: number }) {
  const m = usePoll<{ movies: MissingMovie[]; episodes: MissingEpisode[]; episode_total: number }>(() => apiGet('/arr/missing'), 300000)
  const shown = (m.data?.movies ?? []).slice(0, rows(size))
  return (
    <Card title="manquants" lite={m.data ? `${m.data.movies.length} films · ${m.data.episode_total} épisodes` : undefined}>
      {shown.map((f) => <div key={f.id} style={line}>{f.title} <span className="mono" style={mono}>{f.year}</span></div>)}
      {m.data && shown.length === 0 && <span style={{ color: 'var(--faint)' }}>aucun film manquant</span>}
    </Card>
  )
}
