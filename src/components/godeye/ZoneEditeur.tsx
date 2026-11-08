import { useEffect, useState } from 'react'
import {
  bboxDeCercle, changerForme, deplacerZone, erreursZone, NOM_MAX, OBJETS_ZONE, RAYON_MAX_KM, RAYON_MIN_KM, resumeForme,
  type Bbox, type FormeZone, type ObjetZone, type ZoneBrouillon,
} from '../../lib/godeye/zones'
import { Case, Puces } from './Champs'
import type { EtatZones } from './useZones'
import './zones.css'

/** Champ décimal : on tape librement, la valeur n'est transmise qu'à la sortie du champ ou à Entrée. */
function Decimal({ valeur, label, min, max, unite, onValeur }: { valeur: number; label: string; min: number; max: number; unite?: string; onValeur: (v: number) => void }) {
  const [texte, setTexte] = useState(String(valeur))
  useEffect(() => { setTexte(String(valeur)) }, [valeur])
  const valider = () => {
    const n = Number(texte.replace(',', '.'))
    if (texte.trim() === '' || !Number.isFinite(n)) { setTexte(String(valeur)); return }
    const v = Math.min(max, Math.max(min, Math.round(n * 1000) / 1000))
    setTexte(String(v))
    if (v !== valeur) onValeur(v)
  }
  return (
    <label className="gz-champ"><span>{label}</span>
      <input className="nc-ctl" type="text" inputMode="decimal" value={texte} aria-label={label}
        onChange={(e) => setTexte(e.target.value)} onBlur={valider} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); valider() } }} />
      {unite && <i>{unite}</i>}
    </label>
  )
}

// curseur de rayon logarithmique : 1 km a 5000 km sur une seule course
const versCurseur = (km: number): number => Math.round((Math.log(km / RAYON_MIN_KM) / Math.log(RAYON_MAX_KM / RAYON_MIN_KM)) * 1000)
const depuisCurseur = (c: number): number => {
  const km = RAYON_MIN_KM * (RAYON_MAX_KM / RAYON_MIN_KM) ** (c / 1000)
  return Math.round(km < 50 ? km : km < 500 ? Math.round(km / 5) * 5 : Math.round(km / 25) * 25)
}

type Props = { etat: EtatZones; centreVue: () => { lat: number; lon: number } | null }

/**
 * Éditeur d'une zone : feuille basse sur la scène (téléphone) ou carte flottante (bureau). Le brouillon est dessiné en direct sur la carte ;
 * le centre se pose sur le centre de la vue (bouton) ou se saisit en degrés : pas de geste complexe.
 */
export function ZoneEditeur({ etat, centreVue }: Props) {
  const z = etat.brouillon
  if (!z) return null
  const maj = (n: ZoneBrouillon) => etat.setBrouillon(n)
  const erreurs = erreursZone(z)
  const bord = (k: keyof Bbox, v: number) => maj({ ...z, bbox: { ...(z.bbox as Bbox), [k]: v } })
  const objet = (id: ObjetZone) => maj({ ...z, objets: z.objets.includes(id) ? z.objets.filter((o) => o !== id) : [...z.objets, id] })
  const poser = () => { const c = centreVue(); if (c) maj(deplacerZone(z, c.lat, c.lon)) }
  const sauver = async () => { if (await etat.enregistrer(z)) etat.setBrouillon(null) }
  const formes: { id: FormeZone; nom: string }[] = [{ id: 'cercle', nom: 'cercle' }, { id: 'rect', nom: 'rectangle' }]
  return (
    <section className="gz-feuille" data-bloque="1" aria-label={z.id ? 'modifier la zone' : 'nouvelle zone'}>
      <header className="gz-tete">
        <strong>{z.id ? 'modifier la zone' : 'nouvelle zone'}</strong>
        <span className="gz-resume">{resumeForme(z)}</span>
      </header>
      <div className="gz-corps">
        <label className="gz-champ gz-nom"><span>nom</span>
          <input className="nc-ctl" type="text" maxLength={NOM_MAX} value={z.nom} placeholder="détroit, base, port..." aria-label="nom de la zone" onChange={(e) => maj({ ...z, nom: e.target.value })} />
        </label>
        <div className="ge-seg" role="group" aria-label="forme">
          {formes.map((f) => <button key={f.id} type="button" className={z.forme === f.id ? 'on' : ''} aria-pressed={z.forme === f.id} onClick={() => maj(changerForme(z, f.id))}>{f.nom}</button>)}
        </div>
        <p className="ge-note">Place le centre au milieu de la carte actuellement affichée, ou saisis-le en degrés ; la zone se dessine en direct.</p>
        <button type="button" className="gz-bouton" onClick={poser}>placer au centre de la vue</button>
        <div className="gz-grille">
          <Decimal valeur={z.centre.lat} label="latitude" min={-90} max={90} unite="°" onValeur={(v) => maj(deplacerZone(z, v, z.centre.lon))} />
          <Decimal valeur={z.centre.lon} label="longitude" min={-180} max={180} unite="°" onValeur={(v) => maj(deplacerZone(z, z.centre.lat, v))} />
        </div>
        {z.forme === 'cercle' ? (
          <>
            <label className="gz-champ"><span>rayon</span>
              <input type="range" min={0} max={1000} step={1} value={versCurseur(z.rayon_km ?? 100)} aria-label="rayon en kilomètres"
                onChange={(e) => maj({ ...z, rayon_km: depuisCurseur(Number(e.target.value)) })} />
              <i>{Math.round(z.rayon_km ?? 0)} km</i>
            </label>
            <Decimal valeur={z.rayon_km ?? 100} label="rayon (km)" min={RAYON_MIN_KM} max={RAYON_MAX_KM} unite="km" onValeur={(v) => maj({ ...z, rayon_km: v })} />
          </>
        ) : (
          <>
            <div className="gz-grille">
              <Decimal valeur={z.bbox?.n ?? 0} label="nord" min={-90} max={90} unite="°" onValeur={(v) => bord('n', v)} />
              <Decimal valeur={z.bbox?.s ?? 0} label="sud" min={-90} max={90} unite="°" onValeur={(v) => bord('s', v)} />
              <Decimal valeur={z.bbox?.w ?? 0} label="ouest" min={-180} max={180} unite="°" onValeur={(v) => bord('w', v)} />
              <Decimal valeur={z.bbox?.e ?? 0} label="est" min={-180} max={180} unite="°" onValeur={(v) => bord('e', v)} />
            </div>
            <button type="button" className="ge-lien" onClick={() => maj({ ...z, bbox: bboxDeCercle(z.centre.lat, z.centre.lon, z.rayon_km ?? 100) })}>refaire le rectangle autour du centre</button>
          </>
        )}
        <div className="ge-bloc-t">objets surveillés</div>
        <Puces options={OBJETS_ZONE} actives={z.objets} onBasculer={objet} />
        <Case label="zone active (surveillée et dessinée)" on={z.actif} onChange={(v) => maj({ ...z, actif: v })} />
        <Case label="me notifier à chaque entrée ou sortie" on={z.notifier} onChange={(v) => maj({ ...z, notifier: v })} />
        <p className="ge-note">Les seuils d'alerte se règlent dans les automatisations.</p>
        {erreurs.length > 0 && <ul className="gz-erreurs" role="alert">{erreurs.map((e) => <li key={e}>{e}</li>)}</ul>}
      </div>
      <footer className="gz-pied">
        <button type="button" className="gz-bouton" onClick={() => etat.setBrouillon(null)}>annuler</button>
        <button type="button" className="gz-bouton gz-ok" disabled={etat.occupe || erreurs.length > 0} onClick={() => void sauver()}>{z.id ? 'enregistrer' : 'créer la zone'}</button>
      </footer>
    </section>
  )
}
