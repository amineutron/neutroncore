import { useEffect, useRef, useState } from 'react'
import { apiGet } from '../lib/api'
import { getSettings } from '../lib/settings'
import { Mascot } from './Mascot'

// Animation de lancement : allumage du réacteur (smooth) puis wordmark et
// log de boot en ASCII (TUI). Le log affiche l'installation RÉELLE.
// Réglable dans paramètres ; toujours passable au clic ou à la touche.

const WORDMARK = [
  '                     __',
  '   ____  ___  __  __/ /__________  ____  _________  ________',
  '  / __ \\/ _ \\/ / / / __/ ___/ __ \\/ __ \\/ ___/ __ \\/ ___/ _ \\',
  ' / / / /  __/ /_/ / /_/ /  / /_/ / / / / /__/ /_/ / /  /  __/',
  '/_/ /_/\\___/\\__,_/\\__/_/   \\____/_/ /_/\\___/\\____/_/   \\___/',
]

type Line = { text: string; value: string; tone: 'ok' | 'warn' | 'crit' }

export function BootSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0)      // 0 réacteur, 1 wordmark, 2 log, 3 sortie
  const [shown, setShown] = useState(0)      // lignes de log révélées
  const [lines, setLines] = useState<Line[]>([])
  const doneRef = useRef(false)
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    setPhase(3)
    setTimeout(onDone, 420)
  }

  // Détection réelle de l'installation (le log n'est pas décoratif)
  useEffect(() => {
    let alive = true
    const detect = async () => {
      const out: Line[] = [{ text: 'noyau neutroncore', value: 'ok', tone: 'ok' }]
      try {
        const s = await apiGet<{ services: { status: string }[] }>('/services')
        const up = s.services.filter((x) => x.status === 'up').length
        out.push({
          text: 'services', value: `${up}/${s.services.length} actifs`,
          tone: up === s.services.length ? 'ok' : up > 0 ? 'warn' : 'crit',
        })
      } catch {
        out.push({ text: 'services', value: 'injoignables', tone: 'crit' })
      }
      try {
        const l = await apiGet<{ reachable: boolean }>('/lyra/status')
        out.push({
          text: 'lyra daemon', value: l.reachable ? 'connectée' : 'hors ligne',
          tone: l.reachable ? 'ok' : 'warn',
        })
      } catch {
        out.push({ text: 'lyra daemon', value: 'hors ligne', tone: 'warn' })
      }
      try {
        const c = await apiGet<{ kinds: { kind: string; targets: string[] }[] }>('/tests/catalog')
        const mcp = c.kinds.find((k) => k.kind === 'smoke')?.targets ?? []
        out.push({
          text: 'serveurs mcp', value: mcp.length ? `${mcp.length} branchés` : 'aucun',
          tone: mcp.length ? 'ok' : 'warn',
        })
      } catch { /* option absente : ligne omise */ }
      out.push({ text: 'interface', value: 'prête', tone: 'ok' })
      if (alive) setLines(out)
    }
    detect()
    return () => { alive = false }
  }, [])

  // Enchaînement des phases
  useEffect(() => {
    if (reduced) { finish(); return }
    const t1 = setTimeout(() => setPhase(1), 620)
    const t2 = setTimeout(() => setPhase(2), 1250)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Révélation des lignes de log une par une
  useEffect(() => {
    if (phase !== 2 || lines.length === 0) return
    if (shown >= lines.length) {
      const t = setTimeout(finish, 900)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setShown((n) => n + 1), 180)
    return () => clearTimeout(t)
  }, [phase, shown, lines.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Passer : clic, touche, ou fin naturelle
  useEffect(() => {
    const skip = () => finish()
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const s = getSettings()
  return (
    <div className={`boot ${phase === 3 ? 'out' : ''}`} role="presentation">
      <div className="boot-core" />
      {phase >= 1 && (
        <pre className="boot-wm" aria-label="neutroncore">
          {WORDMARK.join('\n')}
        </pre>
      )}
      {phase >= 1 && <div className="boot-sub">hub · amineutron</div>}
      {phase >= 2 && (
        <div className="boot-log">
          {lines.slice(0, shown).map((l, i) => (
            <div className="boot-line" key={i}>
              <span className="lbl">{l.text}</span>
              <span className="dots" />
              <span className={`val ${l.tone}`}>{l.value}</span>
            </div>
          ))}
          {shown < lines.length && <span className="boot-cursor" />}
        </div>
      )}
      {phase >= 2 && s.mascots && (
        <div className="boot-mascot">
          <Mascot kind="fast" name={s.mascotFast} state={shown >= lines.length ? 'ok' : 'busy'} size={9} />
        </div>
      )}
      <div className="boot-skip">toucher pour passer</div>
    </div>
  )
}
