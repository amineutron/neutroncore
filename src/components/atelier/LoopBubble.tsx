import { useEffect, useState } from 'react'
import { apiPost, withConfirm } from '../../lib/api'
import { fmtAgo } from '../../lib/poll'
import { toast } from '../../lib/dialog'
import { pieceLabel } from '../../lib/atelier'
import { autresEnAttente, boucleAffichee, derniereRecente, etatBoucle, trierBoucles, type Recente } from '../../lib/atelierSessions'
import type { Boucles, Launch } from './useBoucles'
import { SessionChat } from '../SessionChat'

const OPEN_STORAGE = 'neutroncore_atelier_bulle'

// Les boucles d'agents, toujours à portée : une languette sur le flanc droit de l'atelier, qui s'ouvre
// en volet. Chaque projet peut avoir sa session : en changeant de projet on retrouve la sienne, ou on
// s'en voit proposer une nouvelle. Toutes les sessions sont listées en haut, celles du projet affiché marquées.
export function LoopBubble({ modele, boucles: data, launch, ouvrir, onNew, onProject }: {
  modele: string; boucles: Boucles; launch: Launch | null; ouvrir: number       // `ouvrir` : compteur, chaque hausse déplie la bulle
  onNew: () => void; onProject: (modele: string) => void
}) {
  const [open, setOpenState] = useState(() => { try { return localStorage.getItem(OPEN_STORAGE) === '1' } catch { return false } })
  const setOpen = (o: boolean) => { setOpenState(o); try { localStorage.setItem(OPEN_STORAGE, o ? '1' : '0') } catch { /* préférence de confort */ } }
  const [choisie, setChoisie] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { lives, boucles, duProjet, attendue } = data
  const sessions = { refresh: data.refresh }, carte = { refresh: data.refresh, data: { cwd: data.cwd, recentes: data.recentes } }
  // changer de projet : on revient à la session de ce projet
  useEffect(() => { setChoisie(null) }, [modele])
  const affichee = boucleAffichee(boucles, modele, choisie)
  const session = lives.find((s) => s.sessionId === affichee?.sessionId)
  const ailleurs = autresEnAttente(boucles, modele)
  const attend = Boolean(duProjet?.waiting)
  useEffect(() => { if (attend || attendue) setOpen(true) }, [attend, attendue]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ouvrir > 0) setOpen(true) }, [ouvrir]) // eslint-disable-line react-hooks/exhaustive-deps

  const etat = etatBoucle(duProjet, attendue)
  const recente = duProjet ? null : derniereRecente(carte.data?.recentes ?? [], modele)
  const reprendre = async (r: Recente) => {
    setBusy(true)
    try {
      await apiPost('/launcher/sessions/resume', { sessionId: r.sessionId, cwd: carte.data?.cwd ?? '' }, await withConfirm('launcher_claude'))
      toast('session reprise : elle apparaît ici dans quelques secondes')
      sessions.refresh(); carte.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'reprise impossible', 'crit') } finally { setBusy(false) }
  }
  return (
    <aside className={`at-bulle ${open ? 'open' : ''} ${ailleurs > 0 && etat.tone !== 'wait' ? 'wait' : etat.tone}`} aria-label="Boucles d'agents">
      <button type="button" className="at-bulle-tab" aria-expanded={open} onClick={() => setOpen(!open)} title={open ? 'Replier les boucles' : 'Voir les boucles d’agents'}>
        <i aria-hidden /><span>boucle · {etat.texte}{ailleurs > 0 ? ` · ${ailleurs} autre${ailleurs > 1 ? 's' : ''} en attente` : ''}</span>
      </button>
      {open && (
        <div className="at-bulle-body">
          <header>
            <b>boucles d'agents</b><span className="at-bulle-etat">{boucles.length === 0 ? 'aucune en cours' : `${boucles.length} en cours`}</span>
            <button type="button" className="btn sm" onClick={() => setOpen(false)} aria-label="Replier">→</button>
          </header>
          {boucles.length > 0 && (
            <div className="at-bulle-liste" role="tablist" aria-label="Sessions en cours">
              {trierBoucles(boucles, modele).map((b) => {
                const e = etatBoucle(b)
                const ici = b.modele === modele
                return (
                  <button key={b.sessionId} type="button" role="tab" aria-selected={affichee?.sessionId === b.sessionId} className={`${affichee?.sessionId === b.sessionId ? 'on' : ''} ${ici ? 'ici' : ''}`}
                    onClick={() => setChoisie(b.sessionId)} title={ici ? 'Session du projet affiché' : 'Session d’un autre projet'}>
                    <i className={e.tone} aria-hidden />
                    <span>{b.modele ? pieceLabel(b.modele) : 'hors boucle'}</span>
                    <em>{ici ? 'ce projet' : e.texte}</em>
                  </button>
                )
              })}
            </div>
          )}
          {!duProjet && (
            <div className="at-bulle-vide">
              <p>{attendue ? `Itération ${launch!.numero} : la session démarre, elle apparaît ici dans quelques secondes.` : `Aucune session en cours pour « ${pieceLabel(modele)} ».`}</p>
              {!attendue && (
                <div className="at-row">
                  <button type="button" className="btn sm solid" onClick={onNew}>nouvelle session</button>
                  {recente && <button type="button" className="btn sm" disabled={busy} onClick={() => void reprendre(recente)} title={recente.title}>reprendre la dernière ({fmtAgo(recente.updatedAt)})</button>}
                </div>
              )}
            </div>
          )}
          {session && affichee && (
            <>
              {affichee.modele !== modele && (
                <p className="at-ctx">Conversation d'un autre projet{affichee.modele ? ` : ${pieceLabel(affichee.modele)}` : ''}.
                  {affichee.modele && <> <button type="button" className="btn sm" onClick={() => onProject(affichee.modele)}>aller à ce projet</button></>}</p>
              )}
              <SessionChat key={session.sessionId} session={session} onSent={sessions.refresh} />
              <button type="button" className="btn sm at-bulle-term" onClick={() => void apiPost('/modelisation/atelier/montrer').catch(() => toast('fenêtre injoignable', 'crit'))}
                title="Les sessions tournent aussi dans des fenêtres de terminal rangées à part">afficher ou ranger les terminaux</button>
            </>
          )}
        </div>
      )}
    </aside>
  )
}
