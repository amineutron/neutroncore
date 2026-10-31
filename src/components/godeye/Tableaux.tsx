import { apiGet, DEMO } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { lireFaillesApi, lireMarchesApi } from '../../lib/godeye/sources'
import { Card, Chip } from '../ui'

const signe = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(2)} %`
const prix = (v: number): string => v.toLocaleString('fr-FR', { maximumFractionDigits: v >= 1000 ? 0 : 2 })

/** Cours des marchés (indices, pétrole, or, devises, bitcoin) : lus par l'API, gardés 5 minutes. */
export function Marches() {
  const m = usePoll(async () => lireMarchesApi(await apiGet('/godeye/marches')), 5 * 60_000)
  return (
    <Card title="marchés">
      {m.error && !m.data ? <p className="muted">cours indisponibles ({m.error})</p> : !m.data ? <p className="nc-empty">chargement...</p> : (
        <div className="ge-marches">
          {m.data.map((x) => (
            <div key={x.symbole} className={`ge-marche ${x.variation_pct > 0 ? 'haut' : x.variation_pct < 0 ? 'bas' : ''}`}>
              <span className="n">{x.nom}</span>
              <span className="p">{prix(x.prix)}</span>
              <span className="v">{signe(x.variation_pct)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="ge-note">{DEMO ? 'Données de démonstration.' : 'Yahoo Finance, variation depuis la clôture de la veille. Indicatif, pas un conseil.'}</p>
    </Card>
  )
}

/** Failles activement exploitées (catalogue CISA KEV) : de quoi décider quoi patcher en premier. */
export function Failles() {
  const k = usePoll(async () => lireFaillesApi(await apiGet('/godeye/failles')), 60 * 60_000)
  return (
    <Card title="failles exploitées" lite={k.data ? `${k.data.total} au catalogue CISA` : undefined}>
      {k.error && !k.data ? <p className="muted">catalogue indisponible ({k.error})</p> : !k.data ? <p className="nc-empty">chargement...</p> : (
        <ul className="vm-liste">
          {k.data.recentes.slice(0, 8).map((v) => (
            <li key={v.cve}>
              <span className="m">{v.ajoutee.slice(5)}</span>
              <span className="l"><a href={v.lien} target="_blank" rel="noopener noreferrer">{v.cve}</a> {v.editeur} {v.produit}
                <span className="muted"> {v.nom}</span></span>
              {v.rancongiciel && <Chip tone="crit">rançongiciel</Chip>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
