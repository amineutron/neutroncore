import { fmtBytes } from '../../lib/poll'
import {
  etiquettes, filtrer, fmtDuree, type Filtres, type Ligne, type Periode, type Source, type Tri,
} from '../../lib/sauvegardes'
import { Card } from '../ui'

const SOURCES: [Source, string][] = [['tous', 'tout'], ['timeshift', 'timeshift'], ['borg', 'borg']]
const PERIODES: [Periode, string][] = [['7', '7 j'], ['30', '30 j'], ['90', '90 j'], ['tout', 'tout']]
const TRIS: [Tri, string][] = [['recent', 'plus récentes'], ['taille', 'plus grosses'], ['duree', 'plus longues']]

// Historique commun aux deux sources, avec filtres retenus (localStorage, voir lib/sauvegardes).
export function Historique({ toutes, filtres, onChange, maintenantS }: {
  toutes: Ligne[]; filtres: Filtres; onChange: (f: Filtres) => void; maintenantS: number
}) {
  const l = filtrer(toutes, filtres, maintenantS)
  const set = (p: Partial<Filtres>) => onChange({ ...filtres, ...p })
  return (
    <Card title="historique" lite={`${l.length} sur ${toutes.length}`} style={{ marginBottom: 14 }}>
      <div className="sv-filtres" role="group" aria-label="filtres de l'historique">
        {SOURCES.map(([k, t]) => <button key={k} className={`chip ${filtres.source === k ? 'on' : ''}`} aria-pressed={filtres.source === k} onClick={() => set({ source: k })}>{t}</button>)}
        <span aria-hidden>|</span>
        {PERIODES.map(([k, t]) => <button key={k} className={`chip ${filtres.periode === k ? 'on' : ''}`} aria-pressed={filtres.periode === k} onClick={() => set({ periode: k })}>{t}</button>)}
        <select aria-label="trier par" value={filtres.tri} onChange={(e) => set({ tri: e.target.value as Tri })}>
          {TRIS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <select aria-label="étiquette timeshift" value={filtres.etiquette} onChange={(e) => set({ etiquette: e.target.value })}>
          {etiquettes(toutes).map((x) => <option key={x} value={x}>{x === 'toutes' ? 'toutes les étiquettes' : x}</option>)}
        </select>
      </div>
      {l.length === 0 ? <p className="au-note">Rien ne correspond à ces filtres.</p> : (
        <div className="scroll-x">
          <table className="sv-tbl">
            <thead><tr><th>source</th><th>date</th><th>nom</th><th>type</th><th className="n">taille</th><th className="n">nouveau</th><th className="n">durée</th></tr></thead>
            <tbody>
              {l.map((x) => (
                <tr key={x.id}>
                  <td>{x.source}</td>
                  <td>{new Date(x.ts * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{x.nom}</td><td>{x.etiquette}</td>
                  <td className="n">{x.taille != null ? fmtBytes(x.taille) : '-'}</td>
                  <td className="n">{x.neuf != null ? fmtBytes(x.neuf) : '-'}</td>
                  <td className="n">{fmtDuree(x.duree_s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
