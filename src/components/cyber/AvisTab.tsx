import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { toast } from '../../lib/dialog'
import {
  NOM_NIVEAU, NOM_SOURCE, age, basculer, enregistrerFiltres, filtrer, lireFiltresStockes, lireVeille, nbFiltresActifs, tonNiveau,
  FILTRES_DEFAUT, type Filtres, type ListeCyber, type Niveau, type ReglagesCyber, type Source,
} from '../../lib/cyber'
import { Btn, Card, Chip, Loader } from '../ui'
import { Exposition } from './Exposition'
import '../audit-ux-lot3.css'
import './cyber.css'

function Veille({ reglages, onSaved }: { reglages: ReglagesCyber; onSaved: () => void }) {
  const [saisie, setSaisie] = useState('')
  const enregistrer = async (veille: string[]) => {
    try { await apiPut('/cyber/reglages', { veille }); onSaved() } catch (e) { toast((e as Error).message, 'crit') }
  }
  const ajouter = () => { const v = lireVeille(saisie, reglages.veille); setSaisie(''); void enregistrer(v) }
  return (
    <Card title="liste de veille" lite="logiciels que tu utilises">
      <p className="cy-note">Un avis qui cite l'un de ces logiciels monte d'un niveau. Séparer par des virgules ; toucher un nom pour le retirer.</p>
      <div className="cy-veille">
        {reglages.veille.length === 0 && <span className="cy-note">aucun logiciel surveillé</span>}
        {reglages.veille.map((n) => <button key={n} title="retirer" onClick={() => void enregistrer(reglages.veille.filter((x) => x !== n))}>{n} x</button>)}
      </div>
      <div className="cy-filters">
        <input type="text" value={saisie} placeholder="firefox, openssh, nginx" aria-label="ajouter à la veille"
          onChange={(e) => setSaisie(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouter()} />
        <Btn sm disabled={!saisie.trim()} onClick={ajouter}>ajouter</Btn>
      </div>
    </Card>
  )
}

export function AvisTab() {
  const [f, setF] = useState<Filtres>(lireFiltresStockes)
  const liste = usePoll<ListeCyber>(() => apiGet('/cyber?limit=500'), 60000)
  const reglages = usePoll<ReglagesCyber>(() => apiGet('/cyber/reglages'), 300000)
  useEffect(() => enregistrerFiltres(f), [f])
  const maj = (p: Partial<Filtres>) => setF((x) => ({ ...x, ...p }))

  const sonder = async () => {
    try { const r = await apiPost<{ ajoutes: number }>('/cyber/sonder'); toast(`${r.ajoutes} nouveau(x)`); liste.refresh() } catch (e) { toast((e as Error).message, 'warn') }
  }
  const lus = async (ids: string[] | null) => { try { await apiPost('/cyber/lus', { ids }); liste.refresh() } catch { toast('action refusée', 'crit') } }

  const d = liste.data
  if (!d) return liste.error ? <Chip tone="crit">API injoignable : {liste.error}</Chip> : <Loader label="chargement des avis…" />
  const now = Date.now() / 1000
  const vus = filtrer(d.items, f)
  return (
    <>
      <Card title="avis & alertes" lite={`niveau courant : ${NOM_NIVEAU[d.niveau]} · ${d.non_lus} non lu${d.non_lus > 1 ? 's' : ''}`}>
        <div className="cy-src">
          {d.sources.map((s) => (
            <span key={s.source} title={s.raison || s.erreur}>
              <Chip tone={s.erreur ? 'crit' : s.active ? 'ok' : undefined}>{NOM_SOURCE[s.source]} : {s.erreur || (s.active ? (s.dernier ? age(s.dernier, now) : 'en attente') : 'désactivée')}</Chip>
            </span>
          ))}
          <Btn sm onClick={() => void sonder()}>sonder maintenant</Btn>
          <Btn sm onClick={() => void lus(null)}>tout marquer lu</Btn>
        </div>
        <div className="cy-filters">
          <div className="cy-fgroup" role="group" aria-label="filtrer par gravité">
            <span className="cy-flbl">gravité</span>
            {(['crit', 'warn', 'info'] as Niveau[]).map((n) => (
              <button key={n} className={`chip ${f.niveaux.includes(n) ? 'on' : ''}`} aria-pressed={f.niveaux.includes(n)} onClick={() => maj({ niveaux: basculer(f.niveaux, n) })}>{NOM_NIVEAU[n]}</button>
            ))}
          </div>
          <div className="cy-fgroup" role="group" aria-label="filtrer par source">
            <span className="cy-flbl">source</span>
            {(['certfr', 'shodan', 'greynoise'] as Source[]).map((s) => (
              <button key={s} className={`chip ${f.sources.includes(s) ? 'on' : ''}`} aria-pressed={f.sources.includes(s)} onClick={() => maj({ sources: basculer(f.sources, s) })}>{NOM_SOURCE[s]}</button>
            ))}
          </div>
          <button className={`chip ${f.nonLus ? 'on' : ''}`} onClick={() => maj({ nonLus: !f.nonLus })}>non lus</button>
          <button className={`chip ${f.veilleSeule ? 'on' : ''}`} onClick={() => maj({ veilleSeule: !f.veilleSeule })}>ma veille</button>
          <input type="text" value={f.texte} placeholder="chercher" aria-label="chercher dans les avis" onChange={(e) => maj({ texte: e.target.value })} />
          {nbFiltresActifs(f) > 0 && <Btn sm onClick={() => setF(FILTRES_DEFAUT)}>effacer les filtres</Btn>}
        </div>
        <div className="cy-avis">
          {vus.length === 0 && <span className="cy-note">{d.total === 0 ? "rien reçu pour l'instant" : 'aucun avis ne correspond aux filtres'}</span>}
          {vus.map((a) => (
            <div key={a.id} className={`cy-item ${a.lu ? 'lu' : ''}`}>
              <Chip tone={tonNiveau(a.level) || undefined}>{NOM_NIVEAU[a.level]}</Chip>
              <span className="tt">{a.url.startsWith('https://') ? <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a> : a.title}</span>
              <span className="meta">{NOM_SOURCE[a.source]} · {age(a.published, now)}</span>
              {(a.summary || a.matched.length > 0) && <span className="sm">{a.matched.length > 0 && <b>veille : {a.matched.join(', ')}. </b>}{a.summary}</span>}
              {!a.lu && <span className="sm"><Btn sm onClick={() => void lus([a.id])}>marquer lu</Btn></span>}
            </div>
          ))}
        </div>
      </Card>
      {reglages.data && <Veille reglages={reglages.data} onSaved={() => { reglages.refresh(); liste.refresh() }} />}
      {reglages.data && <Exposition key={reglages.data.ip_publique} reglages={reglages.data} onSaved={() => { reglages.refresh(); liste.refresh() }} />}
    </>
  )
}
