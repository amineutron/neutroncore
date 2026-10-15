import { useState } from 'react'
import { apiPost, withConfirm } from '../../lib/api'
import { ask, confirmDialog, toast } from '../../lib/dialog'
import { pieceLabel, slugProjet } from '../../lib/atelier'

const erreur = (e: unknown, defaut: string) => (e instanceof Error ? e.message : defaut)

// Choix du projet, création, retrait. Retirer se confirme deux fois : d'abord ce qu'on enlève
// (le projet de l'atelier seulement, ou ses fichiers aussi), puis l'énoncé exact de ce qui va se passer.
export function ProjectBar({ modeles, masques, nom, onPick, onChanged }: {
  modeles: { nom: string }[]; masques: string[]; nom: string; onPick: (nom: string) => void; onChanged: (nom?: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const slug = slugProjet(titre)
  const pris = modeles.some((m) => m.nom === slug) || masques.includes(slug)

  const creer = async () => {
    setBusy(true)
    try {
      await apiPost('/modelisation/projets', { nom: slug, description: description.trim() })
      toast(`projet ${pieceLabel(slug)} créé`)
      setCreating(false); setTitre(''); setDescription('')
      onChanged(slug)
    } catch (e) { toast(erreur(e, 'création impossible'), 'crit') } finally { setBusy(false) }
  }

  const retirer = async () => {
    const lisible = pieceLabel(nom)
    const choix = await ask({
      title: `retirer « ${lisible} » de l'atelier ?`,
      body: 'Le projet disparaît de cette liste. Ses fichiers (spec, plans, pièces 3D, itérations, vidéos) restent où ils sont et tu peux le remettre quand tu veux.',
      check: 'supprimer aussi ses fichiers', ok: 'continuer', danger: true,
    })
    if (!choix.ok) return
    const complet = choix.checked
    const sur = await confirmDialog(complet
      ? { title: `supprimer les fichiers de « ${lisible} » ?`, body: 'La spec, le relevé de prix, le code du modèle, ses tests et toutes ses sorties (pièces 3D, plans, itérations, demandes) quittent le projet modelisation-3d. Ils sont déplacés dans la corbeille de neutroncore, qui ne se vide qu’à la main.', ok: 'supprimer les fichiers', danger: true }
      : { title: `retirer « ${lisible} » sans toucher à ses fichiers ?`, body: 'Aucun fichier n’est modifié. Le projet se retrouve sous « projets retirés », d’où tu peux le remettre.', ok: 'retirer de l’atelier', danger: true })
    if (!sur) return
    try {
      await apiPost(`/modelisation/projets/${nom}/retirer`, { mode: complet ? 'complet' : 'reference' }, await withConfirm('modelisation_supprimer'))
      toast(complet ? `${lisible} : fichiers déplacés dans la corbeille` : `${lisible} retiré de l'atelier`)
      onChanged()
    } catch (e) { toast(erreur(e, 'retrait impossible'), 'crit') }
  }

  const remettre = async (m: string) => {
    try { await apiPost(`/modelisation/projets/${m}/remettre`); toast(`${pieceLabel(m)} remis dans l'atelier`); onChanged(m) } catch (e) { toast(erreur(e, 'impossible'), 'crit') }
  }

  return (
    <div className="at-projets">
      <div className="at-row">
        {modeles.length > 0 && (
          <select value={nom} aria-label="Projet" onChange={(e) => onPick(e.target.value)}>
            {modeles.map((m) => <option key={m.nom} value={m.nom}>{pieceLabel(m.nom)}</option>)}
          </select>
        )}
        <button type="button" className={`btn sm ${creating ? 'solid' : ''}`} aria-expanded={creating} onClick={() => setCreating(!creating)}>nouveau projet</button>
        {nom && <button type="button" className="btn sm" onClick={() => void retirer()}>retirer…</button>}
        {masques.length > 0 && (
          <details className="at-masques">
            <summary>{masques.length} projet{masques.length > 1 ? 's' : ''} retiré{masques.length > 1 ? 's' : ''}</summary>
            {masques.map((m) => <span key={m}>{pieceLabel(m)} <button type="button" className="btn sm" onClick={() => void remettre(m)}>remettre</button></span>)}
          </details>
        )}
      </div>
      {creating && (
        <form className="at-creer" onSubmit={(e) => { e.preventDefault(); if (slug && !pris && !busy) void creer() }}>
          <label>nom du projet
            <input className="bp-text" value={titre} maxLength={80} placeholder="ex. support de casque" autoFocus onChange={(e) => setTitre(e.target.value)} />
          </label>
          {titre.trim() && <p className="au-note">{slug ? <>Sera enregistré sous <code>{slug}</code>{pris ? ' — ce nom existe déjà.' : '.'}</> : 'Le nom doit commencer par une lettre.'}</p>}
          <label>en une phrase, ce que c'est (facultatif)
            <textarea value={description} maxLength={600} rows={2} placeholder="ex. un support mural imprimé pour un casque audio, avec passe-câble" onChange={(e) => setDescription(e.target.value)} />
          </label>
          <p className="au-note">Le projet démarre vide : décris ce que tu veux dans l'onglet « itérations » pour lancer sa première conception.</p>
          <div className="at-row">
            <button type="submit" className="btn solid" disabled={!slug || pris || busy}>{busy ? 'création…' : 'créer'}</button>
            <button type="button" className="btn sm" onClick={() => setCreating(false)}>annuler</button>
          </div>
        </form>
      )}
    </div>
  )
}
