import { useEffect, useRef, useState } from 'react'

// Barre de volume du Denon : on glisse, l'affichage suit tout de suite (animation),
// un seul envoi au relâchement. Plafond 80 = 0 dB de référence sur l'échelle Denon :
// au-delà c'est de l'amplification, trop fort pour un réglage au doigt.
export const DENON_VOL_MAX = 80
// délai max pour que la valeur relue rejoigne la consigne (sinon on affiche la relue)
const CONFIRM_TIMEOUT_MS = 5000

type Props = {
  volume: number | null | undefined
  disabled?: boolean
  onCommit: (level: number) => Promise<unknown>
}

export function DenonVolume({ volume, disabled, onCommit }: Props) {
  const [draft, setDraft] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [bump, setBump] = useState(0)
  const dragging = useRef(false)
  // consigne envoyée pas encore confirmée par une relecture de l'ampli
  const pending = useRef<{ target: number; until: number } | null>(null)
  const shown = draft ?? (typeof volume === 'number' ? volume : 0)
  const pct = Math.max(0, Math.min(100, (shown / DENON_VOL_MAX) * 100))

  // Le brouillon reste affiché tant que l'ampli n'a pas confirmé la consigne :
  // la relecture part après la réponse de la commande, et l'ancienne valeur encore
  // en mémoire faisait revenir la barre en arrière avant de repasser à la nouvelle.
  useEffect(() => {
    if (dragging.current || sending) return
    const p = pending.current
    if (p && typeof volume === 'number' && Math.abs(volume - p.target) > 0.6 && Date.now() < p.until) {
      const t = setTimeout(() => { pending.current = null; setDraft(null) }, p.until - Date.now())
      return () => clearTimeout(t)
    }
    pending.current = null
    setDraft(null)
  }, [volume, sending])

  async function commit(level: number) {
    const target = Math.round(Math.max(0, Math.min(DENON_VOL_MAX, level)))
    setDraft(target)
    setBump((b) => b + 1)
    pending.current = { target, until: Date.now() + CONFIRM_TIMEOUT_MS }
    setSending(true)
    try {
      await onCommit(target)
    } catch {
      pending.current = null
    } finally {
      setSending(false)
    }
  }

  const release = () => {
    if (!dragging.current) return
    dragging.current = false
    if (draft !== null) commit(draft)
  }

  return (
    <div className={`vol ${sending ? 'sending' : ''} ${disabled ? 'off' : ''}`}>
      <div className="vol-head">
        <span className="vol-label">volume</span>
        <b key={bump} className="vol-val num">{typeof volume === 'number' || draft !== null ? shown : '—'}</b>
      </div>
      <div className="vol-track" style={{ ['--pct' as string]: `${pct}%` }}>
        <div className="vol-fill" />
        <input
          type="range" min={0} max={DENON_VOL_MAX} step={1} value={shown} disabled={disabled}
          aria-label="Volume du Denon"
          onPointerDown={() => { dragging.current = true }}
          onChange={(e) => { dragging.current = true; setDraft(Number(e.target.value)) }}
          onPointerUp={release}
          onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') commit(Number((e.target as HTMLInputElement).value)) }}
          onBlur={release}
        />
      </div>
      <div className="vol-steps">
        <button type="button" className="btn sm" disabled={disabled} onClick={() => commit(shown - 2)}>−2</button>
        <span className="vol-hint">{sending ? 'réglage…' : '0 dB = 80'}</span>
        <button type="button" className="btn sm" disabled={disabled} onClick={() => commit(shown + 2)}>+2</button>
      </div>
    </div>
  )
}
