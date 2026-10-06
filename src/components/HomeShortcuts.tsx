import { useContext, useSyncExternalStore } from 'react'
import { CommandsContext } from '../lib/commands'
import { getFavs, subscribeFavs } from '../lib/palette'
import { Eyebrow } from './ui'

// Favoris de la palette en boutons sur l'accueil. Sans favori : une invite discrète.
export function HomeShortcuts() {
  const { commands, run, open } = useContext(CommandsContext)
  const favs = useSyncExternalStore(subscribeFavs, getFavs)
  const pinned = favs.map((id) => commands.find((c) => c.id === id)).filter((c) => c !== undefined)
  return (
    <div style={{ marginBottom: 14 }}>
      <Eyebrow>raccourcis</Eyebrow>
      <div className="svc-row">
        {pinned.map((c) => (
          <button key={c.id} className="btn sm" onClick={() => run(c)}>{c.label}</button>
        ))}
        <button className="btn sm hs-open" onClick={open}>
          {pinned.length === 0 ? 'ctrl+k : chercher une commande, étoile pour l’épingler ici' : '+ ctrl+k'}
        </button>
      </div>
    </div>
  )
}
