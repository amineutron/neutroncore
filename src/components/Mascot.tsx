import { useEffect, useState } from 'react'
import mascotData from '../mascots.json'
import { getSettings } from '../lib/settings'
import { acknowledge, getActivity, getReason, subscribe, type MascotKind, type MascotState } from '../lib/mascotBus'

// Données du fichier mascottes : 15 rapides (lyra) + 15 lentes (ephaistos/hestia),
// chaque état = frames ASCII 9×5 animées.
type MascotDef = { n: string; c: string; ms: number; role: string; states: Record<string, string[][]> }
const DATA = mascotData as { fast: MascotDef[]; slow: MascotDef[] }

export const MASCOTS: Record<MascotKind, { name: string; role: string }[]> = {
  fast: DATA.fast.map((m) => ({ name: m.n, role: m.role })),
  slow: DATA.slow.map((m) => ({ name: m.n, role: m.role })),
}

const STATE_COLOR: Record<MascotState, string> = {
  idle: 'var(--muted)', sleep: 'var(--faint)', busy: 'var(--gold)',
  work: 'var(--rose)', ok: 'var(--ok)', err: 'var(--crit)',
}

export function find(kind: MascotKind, name: string): MascotDef {
  const list = DATA[kind]
  return list.find((m) => m.n === name) ?? list[10] ?? list[0]
}

/** Rendu d'une mascotte ASCII animée. state fixe (préview) ou live (bus). */
export function Mascot({ kind, name, state, size = 13, live }: {
  kind: MascotKind; name: string; state?: MascotState; size?: number; live?: boolean
}) {
  const def = find(kind, name)
  const [liveState, setLiveState] = useState<MascotState>(() => getActivity(kind))
  const [frame, setFrame] = useState(0)
  const current: MascotState = live ? liveState : (state ?? 'idle')

  useEffect(() => {
    if (!live) return
    return subscribe((k, s) => { if (k === kind) setLiveState(s) })
  }, [kind, live])

  const frames = def.states[current] ?? def.states.idle
  useEffect(() => {
    setFrame(0)
    if (frames.length <= 1) return
    const speed = Math.max(0.25, getSettings().mascotSpeed || 1)
    const ms = ((current === 'busy' || current === 'work') ? def.ms : def.ms * 2.2) / speed
    const t = setInterval(() => setFrame((f) => (f + 1) % frames.length), ms)
    return () => clearInterval(t)
  }, [current, def, frames.length])

  return (
    <pre
      aria-label={`${def.n} — ${current}`}
      style={{
        fontFamily: 'var(--mono)', fontWeight: 400, fontSize: size, lineHeight: 1.18,
        letterSpacing: '0.06em', color: STATE_COLOR[current], margin: 0,
        transition: 'color .4s ease', userSelect: 'none',
      }}
    >{(frames[frame % frames.length] ?? frames[0]).join('\n')}</pre>
  )
}

const STATE_LABEL: Record<MascotState, string> = {
  idle: 'repos', sleep: 'veille', busy: 'réfléchit', work: 'exécute', ok: 'succès', err: 'erreur',
}

/** La chaîne de mascottes de l'accueil : lyra (rapide) + ephaistos/hestia (lente). */
export function MascotChain({ fastName, slowName, showFast, showSlow }: {
  fastName: string; slowName: string; showFast: boolean; showSlow: boolean
}) {
  const [, force] = useState(0)
  useEffect(() => subscribe(() => force((n) => n + 1)), [])
  if (!showFast && !showSlow) return null
  const cell = (kind: MascotKind, name: string, label: string) => {
    const st = getActivity(kind)
    const reason = getReason(kind)
    const sticky = st === 'err' || Boolean(reason)
    return (
      <div
        style={{ textAlign: 'center', cursor: sticky ? 'pointer' : 'default' }}
        onClick={() => sticky && acknowledge(kind)}
        title={sticky ? 'clic pour acquitter' : undefined}
      >
        <Mascot kind={kind} name={name} live size={13} />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginTop: 6 }}>
          {label}<br />
          <span style={{ color: st === 'err' ? 'var(--crit)' : reason ? 'var(--warn)' : 'var(--muted)' }}>
            {reason || STATE_LABEL[st]}
          </span>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '10px 0 4px' }}>
      {showFast && cell('fast', fastName, 'lyra')}
      {showFast && showSlow && <span style={{ color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 11 }}>·············</span>}
      {showSlow && cell('slow', slowName, 'ephaistos · hestia')}
    </div>
  )
}
