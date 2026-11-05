import { useState } from 'react'
import { SIGNAUX_INFO } from '../../lib/djSignaux'
import {
  CADENCE_MAX, CADENCE_MIN, SIGNAUX_AMBILIGHT, couleurDeNiveau, type ReglagesAmbilight, type VoieAmbilight,
} from '../../lib/djAmbilight'
import { NB_SAUVEGARDES, NOM_SAUVEGARDE_MAX, type SauvegardeAmbilight } from '../../lib/djAmbilightSaves'
import type { EtatAmbilight } from '../../lib/djLiaisonAmbilight'

const VOIES: { id: VoieAmbilight; label: string; quoi: string }[] = [
  { id: 'cached', label: 'rapide', quoi: 'Très réactive : suit même 4 changements par seconde. Ne fait pas réagir les lampes liées à l’Ambilight (Ambilight + Hue).' },
  { id: 'lounge', label: 'douce', quoi: 'Fidèle jusqu’à environ 1 changement par seconde, puis la télé prend du retard : pour des réglages lents (cadence 2 à 4).' },
]
const rgb = (c: { r: number; g: number; b: number }): string => `rgb(${c.r}, ${c.g}, ${c.b})`

type Props = {
  etat: EtatAmbilight
  reglages: ReglagesAmbilight
  sauvegardes: SauvegardeAmbilight[]
  courante: number | null
  niveau: number                                   // niveau envoyé en ce moment, 0..1 (pour la jauge)
  onChange: (r: ReglagesAmbilight) => void
  onDemarrer: () => void
  onArreter: () => void
  onCharger: (i: number) => void
  onEnregistrer: (i: number) => void
  onNommer: (i: number, nom: string) => void
}

/** Le pilotage de l'Ambilight par la musique : réglages en direct, et quatre sauvegardes que l'on nomme et que l'on écrase. */
export function AmbilightPanneau({ etat, reglages: r, sauvegardes, courante, niveau, onChange, onDemarrer, onArreter, onCharger, onEnregistrer, onNommer }: Props) {
  const enMarche = etat.phase === 'actif' || etat.phase === 'demarrage'
  const poser = (p: Partial<ReglagesAmbilight>) => onChange({ ...r, ...p })
  const modifie = courante !== null && JSON.stringify(sauvegardes[courante]?.reglages) !== JSON.stringify(r)
  return (
    <div className="dj-ambi">
      <div className="dj-ambi-ligne">
        {etat.phase === 'arret' && <>
          <button type="button" className="btn solid dj-reel" onClick={onDemarrer} title="Passe l’Ambilight de la télé en pilotage par la musique. Le style d’avant est rétabli à l’arrêt.">lancer sur l’Ambilight</button>
          <span className="chip" title="Sans lancement, l’Ambilight garde son style.">aperçu seulement : la télé n’est pas touchée</span>
        </>}
        {etat.phase === 'demarrage' && <>
          <span className="chip warn" role="status">{etat.message || 'démarrage…'}</span>
          <button type="button" className="btn" onClick={onArreter}>annuler</button>
        </>}
        {etat.phase === 'erreur' && <>
          <span className="chip crit" role="alert">Ambilight : {etat.message}</span>
          <button type="button" className="btn solid dj-reel" onClick={onDemarrer}>réessayer</button>
        </>}
        {etat.phase === 'actif' && <>
          <span className="chip ok" role="status" title="Navigateur, API, démon Lyra, télé. Une valeur en retard est abandonnée, jamais mise en file.">
            Ambilight en direct · voie {etat.voie === 'lounge' ? 'douce' : 'rapide'}{etat.ms !== null ? ` · ${Math.round(etat.ms)} ms par envoi` : ''}
          </span>
          {etat.erreurs > 0 && <span className="chip warn">{etat.erreurs} erreur{etat.erreurs > 1 ? 's' : ''} d’envoi</span>}
          <span className="chip" title="Le calcul se fait dans cet onglet : le fermer, ou quitter cet écran, rend l’Ambilight.">garde cet écran ouvert</span>
          <button type="button" className="btn dj-reel" onClick={onArreter}>arrêter et rendre l’Ambilight</button>
        </>}
      </div>

      <div className="dj-ambi-jauge" role="img" aria-label={`Niveau envoyé : ${Math.round(niveau * 100)} %`}>
        <i style={{ width: `${Math.round(niveau * 100)}%`, background: rgb(couleurDeNiveau(Math.max(0.15, niveau), r.couleur)) }} />
        <span>{Math.round(niveau * 100)} %</span>
      </div>

      <div className="dj-ambi-reglages">
        <div>
          <p className="dj-note">voie vers la télé{enMarche ? ' (arrête pour la changer)' : ''}</p>
          <div className="dj-seg" role="radiogroup" aria-label="Voie vers la télé">
            {VOIES.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={r.voie === v.id} aria-pressed={r.voie === v.id} disabled={enMarche} title={v.quoi} onClick={() => poser({ voie: v.id })}>{v.label}</button>
            ))}
          </div>
          <p className="dj-note">{VOIES.find((v) => v.id === r.voie)?.quoi}</p>
        </div>
        <label className="at-champ">suit
          <select value={r.signal} aria-label="Signal qui pilote la luminosité" onChange={(e) => poser({ signal: e.target.value as ReglagesAmbilight['signal'] })}>
            {SIGNAUX_AMBILIGHT.map((s) => <option key={s} value={s}>{SIGNAUX_INFO[s].label}</option>)}
          </select>
        </label>
        <label className="at-champ">couleur
          <input type="color" value={r.couleur} aria-label="Couleur de l’Ambilight" onChange={(e) => poser({ couleur: e.target.value })} />
        </label>
        <div>
          <label className="dj-inverse"><input type="checkbox" checked={r.auto} onChange={(e) => poser({ auto: e.target.checked })} />sensibilité auto</label>
          <p className="dj-note">{r.auto
            ? 'Recale le signal sur ce que la musique fait réellement : les creux récents vont au minimum, les pics au maximum, même si le morceau varie peu. S’adapte en une dizaine de secondes.'
            : 'Le signal est utilisé tel quel : un morceau au volume régulier garde l’Ambilight à mi-hauteur.'}</p>
        </div>
        <label className="dj-curseur">minimum (au calme) <em>{r.min} %</em>
          <input type="range" min={0} max={100} value={r.min} aria-label="Minimum" onChange={(e) => { const v = Number(e.target.value); poser({ min: v, max: Math.max(r.max, v) }) }} />
        </label>
        <label className="dj-curseur">maximum (sur les pics) <em>{r.max} %</em>
          <input type="range" min={0} max={100} value={r.max} aria-label="Maximum" onChange={(e) => { const v = Number(e.target.value); poser({ max: v, min: Math.min(r.min, v) }) }} />
        </label>
        <label className="dj-curseur">moyenne (lissage) <em>{r.lissage === 0 ? 'd’un coup' : r.lissage < 30 ? 'vif' : r.lissage < 65 ? 'doux' : 'très lent'}</em>
          <input type="range" min={0} max={100} value={r.lissage} aria-label="Lissage" onChange={(e) => poser({ lissage: Number(e.target.value) })} />
        </label>
        <label className="dj-curseur">cadence <em>{r.cadence} envois/s</em>
          <input type="range" min={CADENCE_MIN} max={CADENCE_MAX} step={1} value={r.cadence} aria-label="Cadence d’envoi" onChange={(e) => poser({ cadence: Number(e.target.value) })} />
        </label>
      </div>

      <div className="dj-sec-titre"><h3>mes réglages</h3>{modifie && <span className="chip gold" title="Les curseurs ne correspondent plus à la case chargée.">modifié depuis « {sauvegardes[courante as number]?.nom} »</span>}</div>
      <div className="dj-ambi-saves">
        {Array.from({ length: NB_SAUVEGARDES }, (_, i) => (
          <Case key={i} i={i} s={sauvegardes[i]} courante={courante === i} onCharger={onCharger} onEnregistrer={onEnregistrer} onNommer={onNommer} />
        ))}
      </div>
      <p className="dj-note">« charger » applique les réglages de la case ; « enregistrer ici » y garde les curseurs actuels. Les noms se modifient directement. Tout reste dans ce navigateur.</p>
    </div>
  )
}

function Case({ i, s, courante, onCharger, onEnregistrer, onNommer }: {
  i: number; s: SauvegardeAmbilight | undefined; courante: boolean
  onCharger: (i: number) => void; onEnregistrer: (i: number) => void; onNommer: (i: number, nom: string) => void
}) {
  const [brouillon, setBrouillon] = useState<string | null>(null)
  if (!s) return null
  const fin = () => { if (brouillon !== null) onNommer(i, brouillon); setBrouillon(null) }
  return (
    <div className={`dj-ambi-case ${courante ? 'on' : ''}`}>
      <input className="bp-text" value={brouillon ?? s.nom} maxLength={NOM_SAUVEGARDE_MAX} aria-label={`Nom de la sauvegarde ${i + 1}`}
        onChange={(e) => setBrouillon(e.target.value)} onBlur={fin} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      <span className="dj-note">{s.reglages.voie === 'lounge' ? 'douce' : 'rapide'} · {SIGNAUX_INFO[s.reglages.signal].label} · {s.reglages.min}–{s.reglages.max} % · {s.reglages.cadence}/s</span>
      <span className="dj-ambi-case-couleur" style={{ background: s.reglages.couleur }} aria-hidden="true" />
      <div className="dj-actions">
        <button type="button" className="btn sm" onClick={() => onCharger(i)}>charger</button>
        <button type="button" className="btn sm" onClick={() => onEnregistrer(i)}>enregistrer ici</button>
      </div>
    </div>
  )
}
