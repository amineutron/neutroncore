import { useContext } from 'react'
import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { NavContext } from '../App'
import { ETAPES, MOTIF_ATTENTE, etapeIndex, lireAttente, pieceLabel } from '../lib/atelier'
import { bouclesEnCours, PHASE_LABEL, PROJET_ATELIER, type Courant } from '../lib/atelierSessions'
import { fmtAge, type LiveSession } from '../lib/sessions'
import { getSettings } from '../lib/settings'
import { MASCOTS, Mascot } from './Mascot'
import type { MascotState } from '../lib/mascotBus'
import { Eyebrow } from './ui'
import type { HomeFormat } from './HomeSessions'

type Carte = { vivantes: Record<string, string>; courants?: Record<string, Courant> }
const HUMEUR: Record<string, MascotState> = { travaille: 'work', attend: 'err', pause: 'sleep', finie: 'ok', demarre: 'busy', perdue: 'err' }

// Boucles de l'atelier 3d en cours, sur l'accueil et en mode télé : projet, itération, étape et état,
// avec la mascotte de l'étape. Rien à l'écran s'il n'y a pas de boucle (sauf en mode télé).
export function HomeAtelier({ format = 'medium', tv = false }: { format?: HomeFormat; tv?: boolean }) {
  const navigate = useContext(NavContext)
  const carte = usePoll<Carte>(() => apiGet('/modelisation/sessions'), 8000)
  const sessions = usePoll<{ sessions: LiveSession[] }>(() => apiGet('/launcher/sessions?others=1'), 8000)
  const lignes = bouclesEnCours(carte.data?.vivantes ?? {}, carte.data?.courants ?? {}, sessions.data?.sessions ?? [], etapeIndex)
  if (lignes.length === 0) return tv ? <div className="card home-sess"><Eyebrow>atelier 3d</Eyebrow><div className="home-sess-empty">aucune boucle en cours</div></div> : null

  const mascottes = getSettings().mascots
  const noms = MASCOTS.slow.length ? MASCOTS.slow : MASCOTS.fast
  const ouvrir = (modele: string) => {
    if (tv) return
    try { sessionStorage.setItem(PROJET_ATELIER, modele) } catch { /* stockage indisponible */ }
    navigate('atelier')
  }
  return (
    <div className={`card home-sess home-atelier fmt-${format} ${tv ? 'tv' : ''}`}>
      <Eyebrow>atelier 3d</Eyebrow>
      <div className="home-sess-row">
        {lignes.map((l) => {
          const bloque = lireAttente(l.courant?.attente)
          const etat = bloque ? MOTIF_ATTENTE[bloque.motif] : PHASE_LABEL[l.phase]
          const etape = ETAPES[Math.min(l.etape, ETAPES.length - 1)]
          return (
            <button key={l.sessionId} type="button" className={`home-sess-cell home-at-cell ph-${bloque ? 'attend' : l.phase}`} title={`${pieceLabel(l.modele)} — ${etat}`} onClick={() => ouvrir(l.modele)}>
              {mascottes && noms.length > 0 && format !== 'short' && (
                <span className="home-at-mascotte"><Mascot kind={MASCOTS.slow.length ? 'slow' : 'fast'} name={noms[l.etape % noms.length].name} state={bloque ? 'err' : HUMEUR[l.phase]} size={format === 'long' ? 11 : 9} /></span>
              )}
              <span className="home-sess-txt">
                <b>{pieceLabel(l.modele)}{l.sessions > 1 && <small> · {l.sessions} sessions</small>}</b>
                <i>{etat}</i>
                {format !== 'short' && <span className="home-at-etape">{l.numero ? `itération ${l.numero} · ` : ''}{etape}</span>}
                {format !== 'short' && (
                  <span className="home-at-pas" aria-hidden>{ETAPES.map((nom, i) => <s key={nom} className={i < l.etape ? 'done' : i === l.etape ? 'now' : ''} />)}</span>
                )}
                {format === 'long' && (bloque?.texte || l.dit) && <em>{bloque?.texte || l.dit}<small> ouverte depuis {fmtAge(l.age_s)}</small></em>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
