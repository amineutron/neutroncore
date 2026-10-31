// Banque de sonneries : rangée par catégorie, chaque son s'écoute sur l'appareil choisi
// (cet appareil ou une sortie du PC) et se choisit d'un toucher. Les sons importés
// (« mes sons ») s'ajoutent et se retirent ici.
import { useEffect, useRef, useState } from 'react'
import { DEMO, apiBinary, apiDelete, apiPost, apiUpload, withConfirm } from '../lib/api'
import { confirmDialog, toast } from '../lib/dialog'
import { NAVIGATEUR, categoriesBanque, filtrerBanque, type Sonnerie, type Sortie } from '../lib/rappels'
import { Btn } from './ui'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function SonnerieBank({ sonneries, sorties, value, sortieRappel, onChoose, onChanged }: {
  sonneries: Sonnerie[]; sorties: Sortie[]; value: string; sortieRappel: string
  onChoose: (id: string) => void; onChanged: () => void
}) {
  const [categorie, setCategorie] = useState(() => sonneries.find((s) => s.id === value)?.categorie ?? 'toutes')
  const [ecoute, setEcoute] = useState(NAVIGATEUR)
  const [joue, setJoue] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const minuteur = useRef<number | undefined>(undefined)
  const fichier = useRef<HTMLInputElement | null>(null)

  useEffect(() => () => { audio.current?.pause(); window.clearTimeout(minuteur.current) }, [])
  // l'écoute suit la sortie du rappel tant qu'on ne l'a pas changée à la main
  useEffect(() => { setEcoute(sortieRappel) }, [sortieRappel])

  async function arreter() {
    window.clearTimeout(minuteur.current)
    audio.current?.pause()
    audio.current = null
    if (joue && ecoute !== NAVIGATEUR) await apiPost('/agenda/rappels/arreter').catch(() => undefined)
    setJoue(null)
  }

  async function ecouter(id: string) {
    await arreter()
    if (ecoute === NAVIGATEUR) {
      if (DEMO) { toast('démo : pas de son dans le navigateur'); return }
      try {
        const data = await apiBinary(`/agenda/rappels/sonneries/${encodeURIComponent(id)}`)
        const a = new Audio(URL.createObjectURL(new Blob([data])))
        audio.current = a
        a.onended = () => { setJoue((j) => (j === id ? null : j)); URL.revokeObjectURL(a.src) }
        setJoue(id)
        await a.play()
      } catch (e) { setJoue(null); toast(`écoute impossible : ${message(e)}`, 'warn') }
      return
    }
    try {
      const r = await apiPost<{ remarque: string | null }>('/agenda/rappels/ecouter', { sonnerie: id, sortie: ecoute })
      setJoue(id)
      minuteur.current = window.setTimeout(() => setJoue(null), 6000)    // une sonnerie de la banque dure moins de 6 s
      if (r.remarque) toast(r.remarque, 'warn')
    } catch (e) { toast(`écoute impossible : ${message(e)}`, 'warn') }
  }

  async function importer(f: File | undefined) {
    if (!f) return
    setEnvoi(true)
    try {
      const r = await apiUpload<{ success: boolean; error?: string; id?: string }>('/agenda/rappels/sonneries', 'fichier', f)
      if (!r.success) { toast(r.error ?? 'import refusé', 'warn'); return }
      toast(`« ${f.name} » ajouté à mes sons`)
      setCategorie('mes sons')
      onChanged()
      if (r.id) onChoose(r.id)
    } catch (e) { toast(`import impossible : ${message(e)}`, 'warn') } finally {
      setEnvoi(false)
      if (fichier.current) fichier.current.value = ''
    }
  }

  async function retirer(s: Sonnerie) {
    const ok = await confirmDialog({ title: `retirer « ${s.nom} » de mes sons ?`, body: 'Le fichier importé est effacé.', ok: 'retirer', danger: true })
    if (!ok) return
    try {
      await apiDelete(`/agenda/rappels/sonneries/${encodeURIComponent(s.id)}`, await withConfirm('sonnerie_supprimer'))
      if (value === s.id) onChoose('classique')
      onChanged()
    } catch (e) { toast(`retrait impossible : ${message(e)}`, 'warn') }
  }

  const liste = filtrerBanque(sonneries, categorie)
  return (
    <div className="sb wide">
      <div className="sb-tete">
        <span>banque de sonneries</span>
        <span className="sb-sp" />
        <span className="sb-sur">écouter sur</span>
        <select value={ecoute} onChange={(e) => { void arreter(); setEcoute(e.target.value) }}>
          <option value={NAVIGATEUR}>cet appareil</option>
          {sorties.map((s) => <option key={s.id} value={s.id}>{s.present ? s.nom : `${s.nom} (absente)`}</option>)}
        </select>
      </div>
      {ecoute !== NAVIGATEUR && <VolumeSortie sortie={sorties.find((x) => x.id === ecoute)} onChanged={onChanged} />}
      <div className="sb-cats">
        {['toutes', ...categoriesBanque(sonneries)].map((c) => (
          <button key={c} type="button" className={`chip ${categorie === c ? 'on' : ''}`} onClick={() => setCategorie(c)}>{c}</button>
        ))}
      </div>
      <div className="sb-liste">
        {liste.map((s) => (
          <div key={s.id} className={`sb-son ${value === s.id ? 'on' : ''} ${joue === s.id ? 'joue' : ''}`}
            role="radio" aria-checked={value === s.id} tabIndex={0}
            onClick={() => onChoose(s.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoose(s.id) } }}>
            <span className="sb-nom">{s.nom}</span>
            <span className="sb-cat">{value === s.id ? 'choisie' : s.categorie}</span>
            <span className="sb-act" onClick={(e) => e.stopPropagation()}>
              {joue === s.id ? <Btn sm onClick={arreter}>stop</Btn> : <Btn sm onClick={() => ecouter(s.id)}>écouter</Btn>}
              {s.origine === 'perso' && <Btn sm danger onClick={() => retirer(s)}>retirer</Btn>}
            </span>
          </div>
        ))}
        {liste.length === 0 && <p className="sb-vide">Aucun son importé pour l’instant.</p>}
      </div>
      <div className="sb-pied">
        <input ref={fichier} type="file" accept=".wav,.ogg,.oga,.flac,.mp3,audio/*" hidden onChange={(e) => importer(e.target.files?.[0])} />
        <Btn sm onClick={() => fichier.current?.click()} disabled={envoi}>{envoi ? 'envoi…' : 'ajouter un son à moi'}</Btn>
        <span className="rp-note">wav, ogg, flac ou mp3, 10 Mo au plus.</span>
      </div>
    </div>
  )
}

/** Volume de la sortie d'écoute, réglé tout de suite (et sortie de la sourdine). */
function VolumeSortie({ sortie, onChanged }: { sortie: Sortie | undefined; onChanged: () => void }) {
  const [v, setV] = useState<number | null>(sortie?.volume ?? null)
  useEffect(() => { setV(sortie?.volume ?? null) }, [sortie?.id, sortie?.volume])
  if (!sortie) return null
  if (!sortie.present) return <p className="rp-note">cette sortie n’est pas branchée en ce moment</p>
  async function appliquer(n: number) {
    try {
      await apiPost('/agenda/rappels/sortie-volume', { sortie: sortie!.id, volume: n })
      onChanged()
    } catch (e) { toast(`volume refusé : ${message(e)}`, 'warn') }
  }
  return (
    <div className="sb-vol">
      <span>volume de « {sortie.nom} »</span>
      <input type="range" min={0} max={100} step={5} value={v ?? 0} aria-label="volume de la sortie"
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={(e) => appliquer(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => appliquer(Number((e.target as HTMLInputElement).value))} />
      <b>{v == null ? '?' : `${v} %`}</b>
      {sortie.muet && <span className="sb-muet">en sourdine : bouger le curseur la rétablit</span>}
    </div>
  )
}
