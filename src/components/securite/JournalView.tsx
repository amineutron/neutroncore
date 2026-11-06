import './securite.css'
import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import {
  chargerFiltres, dureeCourte, requeteJournal, sauverFiltres, tonNiveau,
  type Catalogue, type Filtres, type Journal,
} from '../../lib/securite'
import { Card, Chip, Loader } from '../ui'

const NOMS = ['urgence', 'alerte', 'critique', 'erreur', 'avertissement', 'notice', 'info', 'debug']

export function JournalView() {
  const [f, setF] = useState<Filtres>(chargerFiltres)
  const [auto, setAuto] = useState(true)
  const cat = usePoll<Catalogue>(() => apiGet('/securite/journal/unites'), 3600000)
  const j = usePoll<Journal>(() => apiGet(`/securite/journal?${requeteJournal(f)}`), 10000, auto)
  const maj = (p: Partial<Filtres>) => setF((a) => ({ ...a, ...p }))

  useEffect(() => { sauverFiltres(f) }, [f])
  // un changement de filtre relit tout de suite (la recherche attend la fin de la frappe)
  useEffect(() => {
    const t = setTimeout(j.refresh, 350)
    return () => clearTimeout(t)
  }, [f.unite, f.priorite, f.plage, f.recherche]) // eslint-disable-line react-hooks/exhaustive-deps

  const d = j.data
  return (
    <>
      <Card title="filtres" lite="retenus d'une visite à l'autre">
        <div className="sec-row sec-filters" style={{ flexWrap: 'wrap', gap: 10 }}>
          <select value={f.unite} onChange={(e) => maj({ unite: e.target.value })} aria-label="unité">
            {(cat.data?.unites ?? [{ id: f.unite, portee: '', libelle: f.unite }]).map((u) => (
              <option key={u.id} value={u.id}>{u.libelle}{u.portee && !u.id.startsWith('@') ? ` (${u.portee})` : ''}</option>
            ))}
          </select>
          <select value={f.priorite} onChange={(e) => maj({ priorite: e.target.value })} aria-label="priorité">
            <option value="">toutes priorités</option>
            {NOMS.slice(0, 7).map((n) => <option key={n} value={n}>{n} et plus grave</option>)}
          </select>
          <select value={f.plage} onChange={(e) => maj({ plage: e.target.value })} aria-label="plage">
            {(cat.data?.plages ?? [f.plage]).map((p) => <option key={p} value={p}>dernier(s) {p}</option>)}
          </select>
          <input type="text" value={f.recherche} maxLength={100} placeholder="chercher dans les messages" aria-label="recherche"
            onChange={(e) => maj({ recherche: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
          <label><input type="checkbox" checked={f.groupes} onChange={(e) => maj({ groupes: e.target.checked })} /> regrouper les erreurs</label>
          <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> suivi auto (10 s)</label>
        </div>
      </Card>

      {!d ? <Loader label={j.error ?? 'lecture du journal…'} /> : (
        <>
          <div className="sec-row" style={{ flexWrap: 'wrap', margin: '12px 0' }}>
            <Chip>{d.total} entrées</Chip>
            {NOMS.filter((n) => d.decompte[n]).map((n) => <Chip key={n} tone={tonNiveau(NOMS.indexOf(n)) || undefined}>{d.decompte[n]} {n}</Chip>)}
            {d.erreur && <Chip tone="crit">{d.erreur}</Chip>}
          </div>

          {f.groupes && d.groupes.length > 0 && (
            <Card title="erreurs répétées" lite="plus fréquentes d'abord">
              {d.groupes.slice(0, 12).map((g, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Chip tone={tonNiveau(g.niveau) || undefined}>x{g.nombre}</Chip> <b>{g.unite.replace('.service', '')}</b>
                  <span className="sec-muted"> dernière il y a {dureeCourte(Date.now() / 1000 - g.dernier)}</span>
                  <div className="num" style={{ fontSize: 12, wordBreak: 'break-word' }}>{g.exemple}</div>
                </div>
              ))}
            </Card>
          )}

          <Card title="entrées" lite="la plus récente en haut">
            {d.entrees.length === 0 && <div className="sec-muted">rien pour ces filtres.</div>}
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {d.entrees.map((e, i) => (
                <div key={i} className="num" style={{ fontSize: 12, padding: '2px 0', display: 'flex', gap: 8 }}>
                  <span className="sec-muted" style={{ flex: 'none' }}>{e.quand.slice(5)}</span>
                  <span className={`chip ${tonNiveau(e.niveau)}`} style={{ flex: 'none' }}>{NOMS[e.niveau]}</span>
                  <span style={{ wordBreak: 'break-word' }}>{f.unite.startsWith('@') && e.unite ? `[${e.unite.replace('.service', '')}] ` : ''}{e.message}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  )
}
