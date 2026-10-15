import { useEffect, useRef, useState } from 'react'
import { apiBinary } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { pieceLabel, type Jeu } from '../../lib/atelier'
import { Markdown } from '../Markdown'

type Vue = { nom: string; url: string }
const download = (href: string, name: string) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }

// Plans : les planches dessinées par le pipeline (plans cotés, coupes, vues d'usage), la fiche de
// fabrication et les fichiers à imprimer. Les images passent par l'API authentifiée.
export function Plans({ jeu }: { jeu: Jeu }) {
  const q = jeu.iteration === 'courant' ? '' : `&iteration=${encodeURIComponent(jeu.iteration)}`
  const fichier = (chemin: string) => `/modelisation/${jeu.nom}/fichier?chemin=${encodeURIComponent(chemin)}${q}`
  const [vues, setVues] = useState<Vue[]>([])
  const [rate, setRate] = useState(0)
  const [grand, setGrand] = useState<Vue | null>(null)
  const [fiche, setFiche] = useState<{ nom: string; texte: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const demande = useRef(0)
  const cle = `${jeu.nom}|${jeu.iteration}|${jeu.maj}|${jeu.images.map((i) => i.chemin).join(',')}`

  useEffect(() => {
    let dead = false
    const urls: string[] = []
    setVues([]); setRate(0); setGrand(null); setFiche(null); demande.current += 1
    void Promise.all(jeu.images.map(async (img) => {
      try {
        const octets = await apiBinary(fichier(img.chemin))
        if (dead) return null       // arrivé après le changement de jeu : rien à créer, donc rien à libérer
        const url = URL.createObjectURL(new Blob([octets], { type: 'image/png' }))
        urls.push(url)
        return { nom: img.nom, url }
      } catch { return null }
    })).then((res) => {
      if (dead) return
      setVues(res.filter((v): v is Vue => v !== null))
      setRate(res.filter((v) => v === null).length)
    })
    return () => { dead = true; window.setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 0) }
  }, [cle]) // eslint-disable-line react-hooks/exhaustive-deps

  // Échap referme la planche agrandie
  useEffect(() => {
    if (!grand) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setGrand(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [grand])

  const lire = async (doc: { nom: string; chemin: string }) => {
    const rang = ++demande.current      // seule la dernière fiche demandée s'affiche
    if (fiche?.nom === doc.nom) { setFiche(null); return }
    try {
      const texte = new TextDecoder().decode(await apiBinary(fichier(doc.chemin)))
      if (rang === demande.current) setFiche({ nom: doc.nom, texte })
    } catch { toast('document illisible', 'crit') }
  }
  const archive = async () => {
    setBusy(true)
    try {
      const url = URL.createObjectURL(new Blob([await apiBinary(`/modelisation/${jeu.nom}/archive?dossier=impression`)], { type: 'application/zip' }))
      download(url, `${jeu.nom}_impression.zip`)
      window.setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch { toast('archive indisponible', 'crit') } finally { setBusy(false) }
  }

  const rien = jeu.images.length === 0 && jeu.documents.length === 0
  return (
    <div className="at-plans">
      {rien && <p className="at-faint">Cette itération n'a ni planche ni document : le pipeline les dessine quand il construit le modèle.</p>}
      {jeu.images.length > 0 && vues.length === 0 && rate === 0 && <p className="at-faint">chargement des planches…</p>}
      {rate > 0 && <p className="chip crit">{rate} planche{rate > 1 ? 's' : ''} illisible{rate > 1 ? 's' : ''}</p>}
      <div className="at-planches">
        {vues.map((v) => (
          <button key={v.nom} type="button" onClick={() => setGrand(v)} title="Agrandir">
            <img src={v.url} alt={`Planche ${pieceLabel(v.nom)}`} loading="lazy" />
            <span>{pieceLabel(v.nom)}</span>
          </button>
        ))}
      </div>
      {jeu.documents.length > 0 && <b className="at-sub">documents</b>}
      {jeu.documents.map((d) => (
        <div key={d.nom} className="at-doc">
          <button type="button" className={`btn sm ${fiche?.nom === d.nom ? 'solid' : ''}`} aria-expanded={fiche?.nom === d.nom} onClick={() => void lire(d)}>{pieceLabel(d.nom)}</button>
          {fiche?.nom === d.nom && <Markdown text={fiche.texte} />}
        </div>
      ))}
      {(jeu.impression ?? []).length > 0 && jeu.iteration === 'courant' && (
        <>
          <b className="at-sub">à imprimer</b>
          <button type="button" className="btn sm" disabled={busy} onClick={() => void archive()}>{busy ? 'préparation…' : `télécharger les ${jeu.impression!.length} fichiers (zip)`}</button>
        </>
      )}
      {grand && (
        <div className="at-planche-grande" role="dialog" aria-modal="true" aria-label={`Planche ${pieceLabel(grand.nom)}`} onClick={() => setGrand(null)}>
          <img src={grand.url} alt={`Planche ${pieceLabel(grand.nom)}`} onClick={(e) => e.stopPropagation()} />
          <div className="at-row" onClick={(e) => e.stopPropagation()}>
            <b>{pieceLabel(grand.nom)}</b>
            <button type="button" className="btn sm" onClick={() => download(grand.url, `${jeu.nom}-${grand.nom}.png`)}>télécharger</button>
            <button type="button" className="btn sm" autoFocus onClick={() => setGrand(null)}>fermer</button>
          </div>
        </div>
      )}
    </div>
  )
}
