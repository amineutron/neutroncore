import { useEffect, useRef } from 'react'
import type { Tab } from '../lib/navTree'
import './hubtabs.css'

interface Props<Id extends string> {
  tabs: Tab<Id>[]
  current: Id
  onPick: (id: Id) => void
}

/** Sous-onglets d'une entrée du menu. Défile sur téléphone ; l'onglet actif reste visible. */
export function HubTabs<Id extends string>({ tabs, current, onPick }: Props<Id>) {
  const on = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { on.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' }) }, [current])
  if (tabs.length < 2) return null
  return (
    <div className="hubtabs" role="tablist" aria-label="sections">
      {tabs.map((tb) => (
        <button
          key={tb.id}
          ref={tb.id === current ? on : undefined}
          role="tab"
          aria-selected={tb.id === current}
          className={tb.id === current ? 'on' : ''}
          onClick={() => tb.id !== current && onPick(tb.id)}
        >
          {tb.label}
        </button>
      ))}
    </div>
  )
}
