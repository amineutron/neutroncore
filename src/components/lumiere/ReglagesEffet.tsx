import { COMMUN_DEFAUT, EFFETS, LIBRE, MAX_COULEURS, PALETTES, TEMPOS, couleursDe, type Commun, type FxId, type Pulsation, type Surcharge } from '../../lib/spatialFx'
import { LEGENDES } from '../../lib/spatialApercu'

type Source = { x: number; y: number; z: number }
type Base = { palette: string; couleurs?: string[]; intensite: number; source: Source }
// les effets qui partent du point source (le mur et la marée n'en ont pas)
const AVEC_SOURCE: FxId[] = ['onde', 'orbite', 'raz', 'phare']
const RESPIRATION: (keyof Pulsation)[] = ['profondeur', 'attaque', 'retombee', 'vie', 'plancher']
type Groupe = 'couleurs' | 'intensite' | 'source' | 'respiration' | 'tempo'
const NOMS: Record<Groupe, string> = { couleurs: 'couleurs', intensite: 'intensité', source: 'point source', respiration: 'respiration', tempo: 'tempo' }

/** Ce que l'effet règle lui-même, en mots (pour l'en-tête replié). */
export function resumeSurcharge(r: Surcharge | undefined): string {
  const g: Groupe[] = []
  if (r?.palette) g.push('couleurs')
  if (r?.intensite !== undefined) g.push('intensite')
  if (r?.source) g.push('source')
  if (r?.respiration) g.push('respiration')
  if (r?.tempo !== undefined && r.tempo !== 1) g.push('tempo')
  return g.length ? `propres : ${g.map((x) => NOMS[x]).join(', ')}` : 'comme la scène'
}

/** Réglages propres à un effet d'une scène : chaque groupe se coche « propre à cet effet », sinon il suit la scène
 * (couleurs, intensité, point source) ou les réglages communs (respiration). Le tempo multiplie celui de la musique. */
export function ReglagesEffet({ fx, r, base, commun, onChange }: { fx: FxId; r: Surcharge | undefined; base: Base; commun: Commun; onChange: (r: Surcharge | undefined) => void }) {
  const s = r ?? {}
  const poser = (patch: Partial<Surcharge>, retirer?: keyof Surcharge) => {
    const enleve = retirer === 'palette' ? ['palette', 'couleurs'] : retirer ? [retirer] : []
    const next = Object.fromEntries(Object.entries({ ...s, ...patch }).filter(([k, v]) => v !== undefined && !enleve.includes(k))) as Surcharge
    onChange(Object.keys(next).length ? next : undefined)
  }
  const label = EFFETS.find((e) => e.id === fx)?.label ?? fx
  const resp = { ...COMMUN_DEFAUT, ...commun, ...s.respiration }
  const couleurs = couleursDe(s.palette ? { palette: s.palette, couleurs: s.couleurs } : base)
  const coche = (g: Groupe, on: boolean, activer: () => void, retirer: keyof Surcharge) => (
    <label className="lu-fx-coche">
      <input type="checkbox" checked={on} onChange={(e) => (e.target.checked ? activer() : poser({}, retirer))} />
      <b>{NOMS[g]}</b><i>{on ? 'propre à cet effet' : 'comme la scène'}</i>
    </label>
  )

  return (
    <details className="lu-fx">
      <summary><b>{label}</b><i>{resumeSurcharge(r)}</i></summary>
      <div className="lu-fx-corps">
        {coche('couleurs', Boolean(s.palette), () => poser({ palette: base.palette, couleurs: base.palette === LIBRE ? base.couleurs : undefined }), 'palette')}
        {s.palette && (
          <div className="lu-fx-champ">
            <select value={s.palette} aria-label={`Palette de l’effet ${label}`} onChange={(e) => poser(e.target.value === LIBRE ? { palette: LIBRE, couleurs } : { palette: e.target.value, couleurs: undefined })}>
              {Object.entries(PALETTES).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
              <option value={LIBRE}>libre (tes couleurs)</option>
            </select>
            {s.palette === LIBRE && (
              <span className="lu-couleurs">
                {couleurs.map((c, i) => (
                  <span key={i} className="lu-couleur">
                    <input type="color" value={c} aria-label={`${label} : couleur ${i + 1}`} onChange={(e) => poser({ couleurs: couleurs.map((x, j) => (j === i ? e.target.value : x)) })} />
                    {couleurs.length > 1 && <button type="button" aria-label={`Retirer la couleur ${i + 1}`} onClick={() => poser({ couleurs: couleurs.filter((_, j) => j !== i) })}>×</button>}
                  </span>
                ))}
                {couleurs.length < MAX_COULEURS && <button type="button" className="btn sm" onClick={() => poser({ couleurs: [...couleurs, '#ffffff'] })}>+</button>}
              </span>
            )}
          </div>
        )}

        {coche('intensite', s.intensite !== undefined, () => poser({ intensite: base.intensite }), 'intensite')}
        {s.intensite !== undefined && (
          <label className="lu-curseur"><span><b>intensité de l’effet</b><em>{s.intensite} %</em></span>
            <input type="range" min={10} max={100} step={1} value={s.intensite} aria-label={`Intensité de l’effet ${label}`} onChange={(e) => poser({ intensite: Number(e.target.value) })} />
          </label>
        )}

        {AVEC_SOURCE.includes(fx) && coche('source', Boolean(s.source), () => poser({ source: { ...base.source } }), 'source')}
        {AVEC_SOURCE.includes(fx) && s.source && (['x', 'y', 'z'] as const).map((k) => (
          <label key={k} className="lu-curseur"><span><b>{k === 'x' ? 'gauche – droite' : k === 'y' ? 'tv – fond' : 'hauteur'}</b><em>{Math.round(s.source![k])} %</em></span>
            <input type="range" min={0} max={100} step={0.5} value={s.source![k]} aria-label={`Point source de l’effet ${label}, ${k}`} onChange={(e) => poser({ source: { ...s.source!, [k]: Number(e.target.value) } })} />
          </label>
        ))}

        {coche('respiration', Boolean(s.respiration), () => poser({ respiration: { ...(['profondeur', 'attaque', 'retombee', 'vie', 'plancher'] as const).reduce((o, k) => ({ ...o, [k]: resp[k] }), {}), profondeur: resp.profondeur || 70 } }), 'respiration')}
        {s.respiration && RESPIRATION.map((k) => (
          <label key={k} className="lu-curseur"><span><b>{LEGENDES[k].label}</b><em>{resp[k] ?? 0}</em></span>
            <input type="range" min={0} max={k === 'plancher' ? 60 : 100} step={1} value={resp[k] ?? 0} aria-label={`${LEGENDES[k].label}, effet ${label}`}
              onChange={(e) => poser({ respiration: { ...s.respiration, [k]: Number(e.target.value) } })} />
          </label>
        ))}

        <label className="lu-fx-champ"><b>tempo</b>
          <select value={s.tempo ?? 1} aria-label={`Tempo de l’effet ${label}`} onChange={(e) => (Number(e.target.value) === 1 ? poser({}, 'tempo') : poser({ tempo: Number(e.target.value) }))}>
            {TEMPOS.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
          </select>
        </label>
      </div>
    </details>
  )
}
