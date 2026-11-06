import { useEffect, useState } from 'react'
import { apiDelete, getApiKey, withConfirm, DEMO } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { tailleLisible } from '../../lib/camera'
import { comptes, dureeLisible, ecrireFiltre, filtrer, FILTRES, lireFiltre, nomLisible, type Filtre, type Prise } from '../../lib/cameraStudio'
import { Card } from '../ui'

const url = (nom: string, telecharger = false) => `/camera/studio/prises/${encodeURIComponent(nom)}${telecharger ? '?telecharger=true' : ''}`

// Le navigateur ne peut pas joindre la clé de l'API à une balise image ou vidéo : on récupère le fichier
// avec l'en-tête puis on l'expose par une adresse locale, libérée quand on n'en a plus besoin.
async function blobDe(nom: string): Promise<Blob | null> {
  if (DEMO) return null
  const r = await fetch(url(nom), { headers: { Authorization: `Bearer ${getApiKey()}` } })
  return r.ok ? r.blob() : null
}

function useBlobUrl(nom: string, actif: boolean): string {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!actif) { setSrc(''); return }
    let mort = false, cree = ''
    void blobDe(nom).then((b) => { if (b && !mort) { cree = URL.createObjectURL(b); setSrc(cree) } }).catch(() => { /* vignette absente */ })
    return () => { mort = true; if (cree) URL.revokeObjectURL(cree) }
  }, [nom, actif])
  return src
}

function Tuile({ p, choisie, onPick }: { p: Prise; choisie: boolean; onPick: () => void }) {
  const src = useBlobUrl(p.nom, p.genre === 'image')
  return (
    <button type="button" className={`stu-tuile ${choisie ? 'on' : ''}`} aria-pressed={choisie} onClick={onPick} title={nomLisible(p.nom)}>
      <span className="stu-img" style={src ? { backgroundImage: `url(${src})` } : undefined}>{p.genre === 'video' && <b>lecture</b>}</span>
      <span className="stu-leg"><i>{nomLisible(p.nom)}</i><em>{p.genre === 'video' ? dureeLisible(p.duree) || 'clip' : 'photo'} · {tailleLisible(p.taille)}</em></span>
    </button>
  )
}

function Visionneuse({ p, onFermer, onSupprimer }: { p: Prise; onFermer: () => void; onSupprimer: () => void }) {
  const src = useBlobUrl(p.nom, true)
  const telecharger = async () => {
    try {
      const b = await blobDe(p.nom)
      if (!b) { toast('téléchargement indisponible', 'warn'); return }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = p.nom
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch (err) { toast((err as Error).message, 'crit') }
  }
  return (
    <div className="stu-vue">
      <div className="stu-media">
        {!src ? <span className="cam-note">{DEMO ? 'aperçu indisponible en démonstration' : 'chargement…'}</span>
          : p.genre === 'image' ? <img src={src} alt={`Photo du ${nomLisible(p.nom)}`} /> : <video src={src} controls autoPlay loop playsInline />}
      </div>
      <div className="at-row">
        <b>{nomLisible(p.nom)}</b>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn sm" onClick={() => void telecharger()}>télécharger</button>
        <button type="button" className="btn sm danger" onClick={onSupprimer}>supprimer</button>
        <button type="button" className="btn sm" onClick={onFermer}>fermer</button>
      </div>
    </div>
  )
}

export function StudioGalerie({ prises, onChange }: { prises: Prise[]; onChange: () => void }) {
  const [filtre, setFiltre] = useState<Filtre>(lireFiltre)
  const [nom, setNom] = useState('')
  const n = comptes(prises)
  const liste = filtrer(prises, filtre)
  const ouverte = prises.find((p) => p.nom === nom)
  const changer = (f: Filtre) => { setFiltre(f); ecrireFiltre(f) }
  const supprimer = async (p: Prise) => {
    if (!(await confirmDialog({ title: `supprimer ${nomLisible(p.nom)} ?`, body: 'Le fichier est effacé du dossier des prises.', ok: 'supprimer', danger: true }))) return
    try {
      await apiDelete(url(p.nom), await withConfirm('camera_prise_supprimer'))
      if (nom === p.nom) setNom('')
      onChange()
    } catch (err) { toast((err as Error).message, 'crit') }
  }
  return (
    <Card title="galerie">
      <div className="at-seg" role="group" aria-label="Filtrer les prises">
        {FILTRES.map((f) => <button key={f.id} type="button" className={filtre === f.id ? 'on' : ''} aria-pressed={filtre === f.id} onClick={() => changer(f.id)}>{f.label} {n[f.id]}</button>)}
      </div>
      {ouverte && <Visionneuse p={ouverte} onFermer={() => setNom('')} onSupprimer={() => void supprimer(ouverte)} />}
      {liste.length === 0
        ? <p className="cam-note">{prises.length === 0 ? 'Aucune prise pour l’instant : une photo ou un clip apparaîtra ici.' : 'Rien dans ce filtre.'}</p>
        : <div className="stu-grille">{liste.map((p) => <Tuile key={p.nom} p={p} choisie={p.nom === nom} onPick={() => setNom(p.nom === nom ? '' : p.nom)} />)}</div>}
    </Card>
  )
}
