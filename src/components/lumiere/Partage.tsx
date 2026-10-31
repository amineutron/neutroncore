import { useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'
import { toast } from '../../lib/dialog'
import {
  basculer, importPossible, lireFichier, nomFichierExport, phraseApercu, requeteExport, type ApercuImport, type FichierEchange,
} from '../../lib/spatialOutils'
import { Btn, Chip } from '../ui'
import './lumiere-outils.css'

type Nomme = { id: string; nom: string }
type Reponse<T> = { success: boolean; error?: string } & T

function telecharger(nom: string, contenu: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url; a.download = nom
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Exporter / importer des scènes et des sets en fichier JSON versionné.
 * L'import montre d'abord ce qui sera ajouté (noms, renommages, refus avec raison) et n'écrase jamais rien.
 * `scenes` et `sets` : ceux du pad (GET /spatial) ; `onImporte` : à appeler pour recharger le pad. */
export function Partage({ scenes, sets, onImporte }: { scenes: Nomme[]; sets: Nomme[]; onImporte?: () => void }) {
  const [sc, setSc] = useState<string[] | null>(null)       // null = tout coché (état de départ)
  const [st, setSt] = useState<string[] | null>(null)
  const [fichier, setFichier] = useState<{ nom: string; contenu: FichierEchange } | null>(null)
  const [apercu, setApercu] = useState<ApercuImport | null>(null)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const choisiesSc = sc ?? scenes.map((s) => s.id), choisisSt = st ?? sets.map((s) => s.id)

  async function exporter() {
    setOccupe(true)
    try {
      const q = requeteExport(choisiesSc, scenes.map((s) => s.id), choisisSt, sets.map((s) => s.id))
      const r = await apiGet<Reponse<{ fichier: unknown }>>(`/spatial/outils/export${q}`)
      if (!r.success) { toast(r.error ?? 'export impossible', 'crit'); return }
      telecharger(nomFichierExport(new Date()), r.fichier)
      toast('fichier exporté')
    } catch (e) { toast(`échec : ${(e as Error).message}`, 'crit') } finally { setOccupe(false) }
  }

  async function choisir(f: File | undefined) {
    setErreur(''); setApercu(null); setFichier(null)
    if (!f) return
    const lu = lireFichier(await f.text())
    if (!lu.ok) { setErreur(lu.erreur); return }
    setOccupe(true)
    try {
      const r = await apiPost<Reponse<{ apercu: ApercuImport }>>('/spatial/outils/import/apercu', { fichier: lu.fichier })
      if (!r.success) { setErreur(r.error ?? 'fichier refusé'); return }
      setFichier({ nom: f.name, contenu: lu.fichier }); setApercu(r.apercu)
    } catch (e) { setErreur((e as Error).message) } finally { setOccupe(false) }
  }

  async function importer() {
    if (!fichier) return
    setOccupe(true)
    try {
      const r = await apiPost<Reponse<{ ajoutes: { scenes: number; sets: number } }>>('/spatial/outils/import', { fichier: fichier.contenu })
      if (!r.success) { setErreur(r.error ?? 'import refusé'); return }
      toast(`importé : ${r.ajoutes.scenes} scène(s), ${r.ajoutes.sets} set(s)`)
      setFichier(null); setApercu(null)
      onImporte?.()
    } catch (e) { setErreur((e as Error).message) } finally { setOccupe(false) }
  }

  return (
    <div className="lu-outil">
      <h4>exporter</h4>
      <p className="lite">Un set emporte toujours les scènes qu’il joue. Décoche ce que tu ne veux pas partager.</p>
      <Liste titre="scènes" items={scenes} cochees={choisiesSc} onBascule={(id) => setSc(basculer(choisiesSc, id))} />
      <Liste titre="sets" items={sets} cochees={choisisSt} onBascule={(id) => setSt(basculer(choisisSt, id))} />
      <div className="lu-outil-barre"><Btn solid disabled={occupe || (choisiesSc.length + choisisSt.length === 0)} onClick={exporter}>exporter en fichier</Btn></div>

      <h4>importer</h4>
      <p className="lite">Rien n’est écrasé : un nom déjà pris est renommé. Tu vois le résultat avant d’appliquer.</p>
      <label className="lu-outil-fichier">
        <span className="btn sm">choisir un fichier .json</span>
        <input type="file" accept="application/json,.json" disabled={occupe} onChange={(e) => { void choisir(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {erreur && <div className="lu-outil-err"><Chip tone="crit">{erreur}</Chip></div>}
      {apercu && fichier && (
        <div className="lu-outil-apercu" role="status">
          <p className="lu-outil-phrase">{fichier.nom} — {phraseApercu(apercu)}</p>
          <ul className="lu-outil-liste">
            {apercu.scenes.map((s, i) => <li key={`s${i}`}>scène « {s.nom} »{s.renomme_de && <span className="lite"> (s’appelait « {s.renomme_de} »)</span>}</li>)}
            {apercu.sets.map((s, i) => <li key={`j${i}`}>set « {s.nom} », {s.etapes} étape{s.etapes > 1 ? 's' : ''}{s.renomme_de && <span className="lite"> (s’appelait « {s.renomme_de} »)</span>}</li>)}
            {apercu.refus.map((r, i) => <li key={`r${i}`} className="ko">{r.type === 'scene' ? 'scène' : 'set'} « {r.nom} » refusé : {r.raison}</li>)}
          </ul>
          <div className="lu-outil-barre">
            <Btn solid disabled={occupe || !importPossible(apercu)} onClick={importer}>appliquer l’import</Btn>
            <Btn sm disabled={occupe} onClick={() => { setFichier(null); setApercu(null) }}>annuler</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

function Liste({ titre, items, cochees, onBascule }: { titre: string; items: Nomme[]; cochees: string[]; onBascule: (id: string) => void }) {
  if (items.length === 0) return null
  return (
    <fieldset className="lu-outil-coches">
      <legend>{titre}</legend>
      {items.map((x) => (
        <label key={x.id}><input type="checkbox" checked={cochees.includes(x.id)} onChange={() => onBascule(x.id)} /> {x.nom}</label>
      ))}
    </fieldset>
  )
}
