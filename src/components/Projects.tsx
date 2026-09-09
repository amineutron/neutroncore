import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { getSettings } from '../lib/settings'
import { Mascot } from './Mascot'
import { Bar, Btn, Chip, Eyebrow } from './ui'

// Carte « projets suivis » : une ligne par projet (repliable), barre de progression qui
// s'épaissit quand le projet est déplié, événements colorés sur la ligne de temps pour les
// moments qui demandent une intervention humaine, et une mascotte qui avance avec le projet.
// Données : project-tracker (issues GitHub du dépôt de suivi) via lyra-control-api.
// La vérité est sur GitHub ; ici on regarde, on ne modifie pas.

export type Item = {
  number: number; key: string; title: string; status: 'pending' | 'running' | 'blocked' | 'done'
  waiting: boolean; owner: string; effort: string; url: string; needs_human: boolean; blocked_by: number[]
}
export type TimelineItem = Item & { phase: string; index: number }
export type Phase = {
  key: string; title: string; horizon: string; done: number; total: number; percent: number
  running: number; blocked: number; waiting: number; items: Item[]
}
export type Project = {
  key: string; name: string; state: 'actif' | 'pause' | 'termine'; objective: string; readme: string
  how_to_run: string; issues_repo: string; generated_at: string
  stage: 'done' | 'waiting' | 'blocked' | 'working' | 'idle'
  repos: { name: string; url: string; path?: string; readme?: string }[]
  docs: { label: string; url: string }[]
  services: { name: string; port?: number }[]
  decisions: { date?: string; text?: string; replaces?: number[] }[]
  kpis: { name: string; source?: string; start?: string; target?: string }[]
  totals: { done: number; total: number; percent: number; waiting: number; blocked: number; human: number }
  phases: Phase[]; timeline: TimelineItem[]; next: Item[]; waiting: Item[]; blocked: Item[]
}
type Payload = { generated_at: string; projects: Project[]; errors?: Record<string, string> }

export function useProjects() {
  return usePoll<Payload>(() => apiGet('/roadmap/projects'), 60000)
}

/** Le projet mis en avant sur l'accueil : le premier actif, sinon le premier. */
export function mainProject(p: Payload | null): Project | null {
  if (!p || p.projects.length === 0) return null
  return p.projects.find((x) => x.state === 'actif') ?? p.projects[0]
}

// ---- mascotte : état et humeur selon l'étape du projet -------------------------------------
const MOOD: Record<Project['stage'], { state: 'idle' | 'busy' | 'work' | 'ok' | 'err'; say: string; tone: 'gold' | 'rose' | 'ok' | 'warn' | 'crit' }> = {
  done: { state: 'ok', say: 'terminé !', tone: 'ok' },
  waiting: { state: 'busy', say: "j'attends toi", tone: 'warn' },
  blocked: { state: 'err', say: 'bloqué', tone: 'crit' },
  working: { state: 'work', say: 'au boulot', tone: 'rose' },
  idle: { state: 'idle', say: 'prêt', tone: 'gold' },
}

function eventClass(t: TimelineItem): string | null {
  if (t.status === 'done') return null
  if (t.status === 'blocked') return 'ev crit'
  if (t.waiting) return 'ev rose pulse'
  if (t.needs_human) return 'ev rose hollow'
  if (t.status === 'running') return 'ev gold'
  return null
}

/** La ligne de temps : barre + événements + mascotte. thick = projet déplié. */
function Timeline({ p, thick }: { p: Project; thick: boolean }) {
  const mood = MOOD[p.stage]
  const total = Math.max(p.timeline.length, 1)
  const showMascot = getSettings().mascots
  return (
    <div className={`tl ${thick ? 'thick' : ''} ${p.stage}`}>
      {showMascot && (
        <div className={`tl-mascot ${p.stage}`} style={{ left: `${p.totals.percent}%` }} title={`${p.totals.percent} % · ${mood.say}`}>
          <span className={`bubble ${mood.tone}`}>{mood.say}</span>
          <Mascot kind="fast" name={getSettings().mascotFast} state={mood.state} size={thick ? 9 : 7} />
        </div>
      )}
      <div className="tl-track">
        <Bar pct={p.totals.percent} tone={p.stage === 'done' ? 'ok' : p.stage === 'blocked' ? 'crit' : p.totals.waiting > 0 ? 'warn' : undefined} />
        {p.timeline.map((t) => {
          const cls = eventClass(t)
          if (!cls) return null
          return (
            <a
              key={t.number}
              className={cls}
              style={{ left: `${((t.index + 0.5) / total) * 100}%` }}
              href={t.url}
              target="_blank"
              rel="noreferrer"
              title={`#${t.number} ${t.title}${t.waiting ? ' · attend toi' : t.needs_human ? ' · te concerne' : t.status === 'blocked' ? ' · bloqué' : ' · en cours'}`}
              onClick={(e) => e.stopPropagation()}
            />
          )
        })}
      </div>
    </div>
  )
}

function ItemList({ title, items, tone }: { title: string; items: Item[]; tone?: 'gold' | 'rose' | 'crit' }) {
  if (items.length === 0) return null
  return (
    <div style={{ marginTop: 12 }}>
      <Eyebrow>{title}</Eyebrow>
      <ul className="tl-list">
        {items.map((i) => (
          <li key={i.number}>
            <a href={i.url} target="_blank" rel="noreferrer">#{i.number}</a> {i.title}
            {tone && <Chip tone={tone}>{i.status === 'blocked' ? `bloqué${i.blocked_by.length ? ' par #' + i.blocked_by.join(', #') : ''}` : i.waiting ? 'attend toi' : i.status === 'running' ? 'en cours' : i.owner || 'à faire'}</Chip>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Details({ p }: { p: Project }) {
  const [more, setMore] = useState(false)
  return (
    <div className="tl-details">
      {p.objective && <p className="muted" style={{ margin: '8px 0 10px' }}>{p.objective}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <a className="btn sm solid" href={p.readme} target="_blank" rel="noreferrer">README du projet</a>
        <a className="btn sm" href={`https://github.com/${p.issues_repo}/issues`} target="_blank" rel="noreferrer">issues</a>
        {p.docs.map((d) => <a key={d.url} className="btn sm" href={d.url} target="_blank" rel="noreferrer">{d.label}</a>)}
      </div>
      {p.how_to_run && <pre className="tl-run">{p.how_to_run}</pre>}
      <div className="tl-phases">
        {p.phases.map((ph) => (
          <div key={ph.key} className="tl-phase">
            <div className="tl-phase-name" title={ph.horizon}>{ph.title}</div>
            <div className="tl-phase-bar"><Bar pct={ph.percent} tone={ph.percent >= 100 ? 'ok' : ph.blocked > 0 ? 'crit' : ph.waiting > 0 ? 'warn' : undefined} /></div>
            <span className="num tl-phase-n">
              {ph.done}/{ph.total}
              {ph.running > 0 && <small> · {ph.running} en cours</small>}
              {ph.waiting > 0 && <small className="rose"> · {ph.waiting} attend toi</small>}
              {ph.blocked > 0 && <small className="crit"> · {ph.blocked} bloqué</small>}
            </span>
          </div>
        ))}
      </div>
      <ItemList title="en attente de toi" items={p.waiting} tone="rose" />
      <ItemList title="bloqué" items={p.blocked} tone="crit" />
      <ItemList title="prochaines actions" items={p.next} tone="gold" />
      <div style={{ marginTop: 12 }}>
        <Btn sm onClick={() => setMore((m) => !m)}>{more ? 'moins de détails' : 'dépôts, décisions, indicateurs'}</Btn>
      </div>
      {more && (
        <div className="tl-more">
          {p.repos.length > 0 && (
            <div><Eyebrow>dépôts et chemins</Eyebrow>
              <ul className="tl-list">{p.repos.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>{r.path && <span className="muted"> · {r.path}</span>}{r.readme && <> · <a href={r.readme} target="_blank" rel="noreferrer">README</a></>}</li>)}</ul></div>
          )}
          {p.services.length > 0 && (
            <div><Eyebrow>services</Eyebrow><ul className="tl-list">{p.services.map((s) => <li key={s.name}>{s.name}{s.port ? <span className="muted"> · :{s.port}</span> : null}</li>)}</ul></div>
          )}
          {p.decisions.length > 0 && (
            <div><Eyebrow>décisions</Eyebrow><ul className="tl-list">{p.decisions.map((d, i) => <li key={i}><span className="muted">{d.date}</span> {d.text}</li>)}</ul></div>
          )}
          {p.kpis.length > 0 && (
            <div><Eyebrow>indicateurs</Eyebrow><ul className="tl-list">{p.kpis.map((k) => <li key={k.name}>{k.name} : <span className="num">{k.start ?? '?'}</span> <span className="muted">vers</span> <span className="num">{k.target ?? '?'}</span>{k.source && <span className="muted"> · {k.source}</span>}</li>)}</ul></div>
          )}
        </div>
      )}
      <div className="muted" style={{ marginTop: 10, fontSize: 11 }}>
        issues de {p.issues_repo} · mise à jour {p.generated_at.replace('T', ' ').slice(0, 16)}
      </div>
    </div>
  )
}

const OPEN_KEY = 'neutroncore_projects_open'
function loadOpen(): string[] {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') } catch { return [] }
}

export function Projects() {
  const data = useProjects()
  const [open, setOpen] = useState<string[]>(loadOpen)
  useEffect(() => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(open)) } catch { /* stockage indisponible */ } }, [open])

  const d = data.data
  if (data.error && !d) return <div className="card"><h3>projets suivis</h3><div className="muted">project-tracker injoignable (127.0.0.1:8766).</div></div>
  if (!d) return <div className="card"><h3>projets suivis</h3><div className="muted">chargement…</div></div>

  const toggle = (k: string) => setOpen((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))
  const all = d.projects.map((p) => p.key)
  const stateChip = (p: Project) => p.state === 'termine' ? <Chip tone="ok">terminé</Chip> : p.state === 'pause' ? <Chip>en pause</Chip> : null

  return (
    <div className="card">
      <h3>
        projets suivis<span className="lite">{d.projects.length} projet{d.projects.length > 1 ? 's' : ''}</span>
        <span className="tl-actions">
          <Btn sm onClick={() => setOpen(all)}>tout déplier</Btn>
          <Btn sm onClick={() => setOpen([])}>tout replier</Btn>
        </span>
      </h3>
      {d.projects.map((p) => {
        const isOpen = open.includes(p.key)
        return (
          <section key={p.key} className={`tl-project ${isOpen ? 'open' : ''}`}>
            <header onClick={() => toggle(p.key)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(p.key) }} aria-expanded={isOpen}>
              <span className="tl-caret">{isOpen ? '▾' : '▸'}</span>
              <span className="tl-name">{p.name}</span>
              {stateChip(p)}
              <span className="num tl-count">{p.totals.done} / {p.totals.total}</span>
              {p.totals.waiting > 0 && <Chip tone="rose">{p.totals.waiting} attend toi</Chip>}
              {p.totals.blocked > 0 && <Chip tone="crit">{p.totals.blocked} bloqué</Chip>}
            </header>
            <Timeline p={p} thick={isOpen} />
            {isOpen && <Details p={p} />}
          </section>
        )
      })}
    </div>
  )
}
