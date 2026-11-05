import { useState } from 'react'
import { nouvelId, profilsDeDepart, type Profil } from '../../lib/djCouches'
import { confirmDialog, toast } from '../../lib/dialog'

const MAX_PROFILS = 24

/** Les profils : chacun est une pile de couches complète. On en change d'un clic, on les copie, renomme, supprime. */
export function Profils({ profils, actif, onChoisir, onChange }: { profils: Profil[]; actif: string; onChoisir: (id: string) => void; onChange: (profils: Profil[]) => void }) {
  const [nom, setNom] = useState<string | null>(null)
  const courant = profils.find((p) => p.id === actif)
  const copier = () => {
    if (!courant || profils.length >= MAX_PROFILS) return
    const p: Profil = { id: nouvelId(), nom: `${courant.nom} (copie)`.slice(0, 40), couches: courant.couches.map((c) => ({ ...c, id: nouvelId(), palettes: [...c.palettes] })) }
    onChange([...profils, p]); onChoisir(p.id); setNom(p.nom)
  }
  const supprimer = async () => {
    if (!courant || profils.length <= 1) { toast('il faut garder au moins un profil', 'warn'); return }
    if (!(await confirmDialog({ title: `supprimer le profil « ${courant.nom} » ?`, body: 'Ses rangées sont perdues.', ok: 'supprimer', danger: true }))) return
    const reste = profils.filter((p) => p.id !== courant.id)
    onChange(reste); onChoisir(reste[0].id)
  }
  const retrouver = () => {
    const manquants = profilsDeDepart().filter((d) => !profils.some((p) => p.id === d.id))
    if (manquants.length === 0) { toast('tous les profils de départ sont déjà là'); return }
    onChange([...profils, ...manquants].slice(0, MAX_PROFILS))
  }
  const valider = () => {
    if (courant && nom !== null && nom.trim()) onChange(profils.map((p) => (p.id === courant.id ? { ...p, nom: nom.trim().slice(0, 40) } : p)))
    setNom(null)
  }
  return (
    <div className="dj-profils">
      <div className="dj-puces" role="radiogroup" aria-label="Profil de couches">
        {profils.map((p) => <button key={p.id} type="button" role="radio" aria-checked={p.id === actif} className="dj-puce" aria-pressed={p.id === actif} onClick={() => { onChoisir(p.id); setNom(null) }}>{p.nom}</button>)}
      </div>
      <div className="dj-ligne">
        {nom === null
          ? <button type="button" className="btn sm" disabled={!courant} onClick={() => setNom(courant?.nom ?? '')}>renommer</button>
          : <><input className="bp-text" value={nom} maxLength={40} autoFocus aria-label="Nom du profil" onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') valider(); if (e.key === 'Escape') setNom(null) }} />
            <button type="button" className="btn sm solid" onClick={valider}>ok</button></>}
        <button type="button" className="btn sm" onClick={copier} disabled={profils.length >= MAX_PROFILS} title="Copie le profil en cours pour le retoucher sans perdre l’original">copier</button>
        <button type="button" className="btn sm danger" onClick={() => void supprimer()}>supprimer</button>
        <button type="button" className="btn sm" onClick={retrouver} title="Remet les profils fournis avec l’écran qui manquent">profils de départ</button>
      </div>
    </div>
  )
}
