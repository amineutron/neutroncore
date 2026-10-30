// Fenêtre « ce qui remplit le disque » : ouverte en touchant une alerte disque (accueil, notifications)
// ou depuis la palette. Les plus gros dossiers, puis ceux que rien n'a ouverts depuis 90 jours.
// Lecture seule : on regarde, on ne supprime rien d'ici. Analyse en tâche de fond côté API (`du`).
import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { toast } from '../lib/dialog'
import { anciennete, part, surOuvrirDisque, taille, type AnalyseReponse, type Disque, type Dossier } from '../lib/disque'
import { usePoll } from '../lib/poll'

export function DiskPanel() {
  const [chemin, setChemin] = useState<string | null>(null)
  useEffect(() => surOuvrirDisque((c) => setChemin(c)), [])
  if (chemin === null) return null
  return <Fenetre initial={chemin} onClose={() => setChemin(null)} />
}

function Fenetre({ initial, onClose }: { initial: string; onClose: () => void }) {
  const disques = usePoll<{ disques: Disque[] }>(() => apiGet('/system/disque'), 30000)
  const liste = disques.data?.disques ?? []
  const plusRempli = [...liste].sort((a, b) => b.used_pct - a.used_pct)[0]?.path ?? ''
  const [choisi, setChoisi] = useState(initial)
  const actif = choisi || plusRempli
  useEffect(() => {
    const fermer = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fermer)
    return () => window.removeEventListener('keydown', fermer)
  }, [onClose])
  return (
    <div className="pre-modal" onClick={onClose}>
      <div className="inner dk-modal" role="dialog" aria-modal="true" aria-label="ce qui remplit le disque" onClick={(e) => e.stopPropagation()}>
        <div className="head"><b>ce qui remplit le disque</b><span style={{ flex: 1 }} /><button className="btn sm" onClick={onClose}>fermer</button></div>
        <div className="dk-disques" role="tablist">
          {liste.map((d) => (
            <button key={d.path} role="tab" aria-selected={d.path === actif} className={`dk-disque ${d.path === actif ? 'on' : ''} ${d.used_pct >= 95 ? 'crit' : d.used_pct >= 90 ? 'warn' : ''}`}
              onClick={() => setChoisi(d.path)}>
              <b>{d.path}</b>
              <span className="dk-bar"><i style={{ width: `${d.used_pct}%` }} /></span>
              <em>{Math.round(d.used_pct)} % · {taille(d.free)} libres</em>
            </button>
          ))}
        </div>
        {actif && <Analyse key={actif} chemin={actif} />}
      </div>
    </div>
  )
}

function Analyse({ chemin }: { chemin: string }) {
  const [lance, setLance] = useState(false)
  const r = usePoll<AnalyseReponse>(() => apiGet(`/system/disque/analyse?chemin=${encodeURIComponent(chemin)}`), lance ? 4000 : 8000)
  const res = r.data?.resultat
  const enCours = r.data?.en_cours ?? true

  async function relancer() {
    try {
      await apiPost('/system/disque/analyser', { chemin })
      setLance(true)
      r.refresh()
    } catch (e) { toast(`analyse impossible : ${e instanceof Error ? e.message : String(e)}`, 'warn') }
  }

  return (
    <div className="dk-corps">
      <div className="dk-etat">
        {enCours
          ? <span className="dk-tourne">analyse en cours… (quelques minutes sur un gros disque)</span>
          : res?.at ? <span>analysé {new Date(res.at * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}{res.duree_s ? ` en ${res.duree_s} s` : ''}</span> : null}
        <span style={{ flex: 1 }} />
        <button className="btn sm" disabled={enCours} onClick={relancer}>relancer l’analyse</button>
      </div>
      {res?.erreur && <p className="dk-note warn">{res.erreur}</p>}
      {res && !res.erreur && (
        <>
          <Liste titre="ce qui prend le plus de place" dossiers={res.gros} total={res.total} />
          <Liste titre={`pas ${res.critere === 'acces' ? 'ouvert' : 'modifié'} depuis plus de 90 jours`} dossiers={res.oublies} total={res.total} vieux
            vide="Rien de lourd qui dorme depuis plus de 90 jours." />
          <p className="dk-note">
            Dossiers seulement, trois niveaux de profondeur. {res.critere === 'acces' ? 'Date du dernier accès à un fichier du dossier.' : 'Ce disque ne note pas les accès : c’est la date de dernière modification.'}
            {res.illisibles ? ` ${res.illisibles} dossiers illisibles (droits administrateur) ne sont pas comptés.` : ''}
          </p>
        </>
      )}
    </div>
  )
}

function Liste({ titre, dossiers, total, vieux = false, vide = '' }: { titre: string; dossiers: Dossier[]; total: number; vieux?: boolean; vide?: string }) {
  return (
    <section className="dk-liste">
      <h4>{titre}</h4>
      {dossiers.length === 0 && <p className="dk-note">{vide}</p>}
      {dossiers.map((d) => (
        <div key={d.chemin} className="dk-ligne">
          <span className="dk-chemin" title={d.chemin}>{d.chemin}</span>
          <span className="dk-bar"><i style={{ width: `${part(d.octets, total)}%` }} /></span>
          <b>{taille(d.octets)}</b>
          <em className={vieux ? 'vieux' : ''}>{anciennete(d.jours)}</em>
        </div>
      ))}
    </section>
  )
}
