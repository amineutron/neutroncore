import { useState } from 'react'
import { ETAPES, MOTIF_ATTENTE, etapeIndex, lireAttente } from '../../lib/atelier'
import { avancement, type Avancement } from '../../lib/atelierSessions'
import { fmtAge } from '../../lib/sessions'
import { getSettings } from '../../lib/settings'
import { MASCOTS, Mascot } from '../Mascot'
import type { MascotState } from '../../lib/mascotBus'
import type { Boucles, Launch } from './useBoucles'

const PLIE = 'neutroncore_atelier_avance_plie'
// ce que fait chaque étape, dit simplement
const QUOI = ['cherche les cotes et les composants', 'dessine le modèle et écrit ses contrôles', 'construit les pièces et lance les contrôles', 'relit le résultat contre ta demande', 'a fini : à toi de décider']
const ETAT: Record<Avancement['phase'], string> = { demarre: 'démarre…', travaille: 'au travail', attend: 'attend ta réponse', pause: 'en pause', perdue: 'n’a pas démarré', finie: 'terminé' }

// Bandeau d'avancement : dès qu'une itération est lancée, on voit qu'elle tourne, à quelle étape,
// depuis combien de temps, et ce que l'agent vient de dire. Une mascotte par étape.
export function LoopStatus({ boucles, launch, etape, numero, attente, onOpen, questions }: {
  boucles: Boucles; launch: Launch | null; etape: string | undefined; numero: number | undefined; attente?: unknown; onOpen: () => void
  questions?: React.ReactNode       // les points de l'attente, illustrés par l'écran (mini-plans, pièces concernées)
}) {
  // le détail (questions, étapes, dernière phrase) se replie : il ne reste que la ligne d'état
  const [plie, setPlieEtat] = useState(() => { try { return localStorage.getItem(PLIE) === '1' } catch { return false } })
  const setPlie = (v: boolean) => { setPlieEtat(v); try { localStorage.setItem(PLIE, v ? '1' : '0') } catch { /* préférence de confort */ } }
  const a = avancement({ session: boucles.duProjet, attendue: boucles.attendue, perdue: Boolean(boucles.perdue), etape: etapeIndex(etape) })
  if (!a) return null
  // la boucle peut attendre une décision alors qu'un agent continue sur ce qui n'en dépend pas
  const bloque = lireAttente(attente)
  const mascottes = getSettings().mascots
  const noms = MASCOTS.slow.length ? MASCOTS.slow : MASCOTS.fast
  const s = boucles.session
  // la phrase est citee sur une ligne : on retire la mise en forme Markdown
  const dit = (s?.last_claude ?? '').replace(/[*_`#]+/g, '').replace(/\s+/g, ' ').trim()
  return (
    <section className={`at-avance ${a.phase}${bloque ? ' bloque' : ''}`} aria-live="polite" aria-label="Avancement de la boucle d'agents">
      <header>
        <button type="button" className={`at-avance-plier ${plie ? '' : 'open'}`} aria-expanded={!plie} aria-label={plie ? 'Déplier le détail de la boucle' : 'Replier le détail de la boucle'} onClick={() => setPlie(!plie)}><span aria-hidden /></button>
        <span className="at-avance-pouls" aria-hidden />
        <b>itération {numero ?? launch?.numero ?? ''} — {bloque ? MOTIF_ATTENTE[bloque.motif] : ETAT[a.phase]}</b>
        {s && <span className="at-avance-temps">{a.phase === 'travaille' ? 'depuis' : 'session ouverte depuis'} {fmtAge(s.age_s)}</span>}
        <button type="button" className={`btn sm ${a.phase === 'attend' || bloque ? 'solid' : ''}`} onClick={onOpen}>{a.phase === 'attend' || a.phase === 'pause' || bloque ? 'répondre' : 'voir la conversation'}</button>
      </header>
      {!plie && <>
      {bloque && (
        <div className="at-avance-bloque" role="status">
          <b>{bloque.texte}</b>
          {bloque.points.length > 0 && (questions ?? <ol>{bloque.points.map((p) => <li key={p.texte}>{p.texte}</li>)}</ol>)}
          {a.phase === 'travaille' && <span>En attendant, l’agent continue sur ce qui ne dépend pas de ta réponse.</span>}
        </div>
      )}
      <ol className="at-avance-etapes">
        {ETAPES.map((nom, i) => {
          const etat: MascotState = a.phase === 'perdue' ? 'err' : i < a.etape ? 'ok' : i > a.etape ? 'sleep' : a.phase === 'attend' ? 'err' : a.phase === 'pause' ? 'sleep' : a.phase === 'finie' ? 'ok' : a.phase === 'demarre' ? 'busy' : 'work'
          return (
            <li key={nom} className={i < a.etape ? 'done' : i === a.etape ? 'now' : ''} aria-current={i === a.etape ? 'step' : undefined}>
              {mascottes && <Mascot kind={MASCOTS.slow.length ? 'slow' : 'fast'} name={noms[i % noms.length].name} state={etat} size={9} />}
              <span>{nom}</span>
            </li>
          )
        })}
      </ol>
      <p>
        {a.phase === 'demarre' && 'La session s’ouvre : comptez quelques secondes avant le premier signe de vie.'}
        {a.phase === 'perdue' && 'Aucune session n’est apparue. Ouvre les terminaux depuis la conversation pour voir ce qui s’est passé, ou relance.'}
        {a.phase === 'attend' && 'La boucle est à l’arrêt : l’agent attend ta réponse pour continuer.'}
        {a.phase === 'pause' && 'L’agent a rendu la main à cette étape : ouvre la conversation pour lire son compte rendu et lui répondre.'}
        {a.phase !== 'demarre' && a.phase !== 'perdue' && a.phase !== 'attend' && a.phase !== 'pause' && <>L’agent {QUOI[a.etape] ?? 'travaille'}.{a.etape === 1 || a.etape === 2 ? ' Cette étape peut durer plusieurs dizaines de minutes sans rien écrire.' : ''}</>}
      </p>
      {dit && a.phase !== 'demarre' && <blockquote title="Dernier message de l'agent">{dit.length > 220 ? `${dit.slice(0, 220)}…` : dit}</blockquote>}
      </>}
      {plie && bloque && <p className="at-avance-court">{bloque.texte}{bloque.points.length > 0 ? ` (${bloque.points.length} points)` : ''}</p>}
    </section>
  )
}
