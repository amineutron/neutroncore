import { usePref } from '../../lib/prefs'
import './reveil.css'

export type Lampes = Record<string, { name: string; on?: boolean; reachable?: boolean }>

const estFiltre = (x: unknown): x is boolean => typeof x === 'boolean'

/** Choix des lampes d'une piste ou d'un réveil. Le filtre « seulement celles que le pont atteint » se souvient de son état. */
export function SelecteurLampes({ lampes, choisies, max, onChange, exclues = [] }: {
  lampes: Lampes; choisies: string[]; max: number; onChange: (l: string[]) => void; exclues?: string[]
}) {
  const [atteignables, setAtt] = usePref('neutroncore_rv_atteignables', false, estFiltre)
  const ids = Object.keys(lampes).sort((a, b) => Number(a) - Number(b))
    .filter((id) => !exclues.includes(id) && (!atteignables || lampes[id].reachable !== false || choisies.includes(id)))
  const bascule = (id: string) => onChange(choisies.includes(id) ? choisies.filter((x) => x !== id) : choisies.length < max ? [...choisies, id] : choisies)
  if (!Object.keys(lampes).length) return <p className="rv-note">aucune lampe lue : le pont ou le démon Lyra ne répond pas. Les numéros déjà choisis restent valables.</p>
  return (
    <div>
      <div className="rv-filtres" style={{ marginBottom: 6 }}>
        <button type="button" className="btn sm" aria-pressed={atteignables} onClick={() => setAtt(!atteignables)}>seulement les lampes atteignables</button>
        <span className="chip">{choisies.length} / {max}</span>
      </div>
      <div className="rv-lampes">
        {ids.map((id) => (
          <button key={id} type="button" className="rv-lampe" aria-pressed={choisies.includes(id)} onClick={() => bascule(id)}
            title={lampes[id].reachable === false ? 'injoignable pour le pont' : undefined}>
            <i style={{ background: lampes[id].on ? 'var(--gold-soft)' : 'var(--surface2)', opacity: lampes[id].reachable === false ? 0.4 : 1 }} />
            <b>{lampes[id].name || `lampe ${id}`}</b>
          </button>
        ))}
      </div>
    </div>
  )
}
