import { useState } from 'react'
import { apiDelete, apiGet, apiPost, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import {
  LIBELLE_ETAT, LIBELLE_STATUT, phraseDate, phraseMode, phrasePlan, phraseProchaine, phraseSonde, tonEtat, tonStatut,
  type Element, type Passage,
} from '../../lib/rotation'
import { Btn, Chip } from '../ui'
import { RunSteps } from './RunSteps'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function RotationRow({ el, coffreOk, onChange }: { el: Element; coffreOk: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState('')
  const [run, setRun] = useState<Passage | null>(null)
  const [hist, setHist] = useState<Passage[] | null>(null)
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const now = Date.now() / 1000
  const s = el.suivi
  const attente = s.etat === 'en_attente'
  const occupe = busy !== '' || el.en_cours

  async function lancer(nom: string, f: () => Promise<Passage | void>) {
    setBusy(nom); setErr('')
    try {
      const r = await f()
      if (r) setRun(r)
      if (hist) setHist(null)
      onChange()
    } catch (e) { setErr(message(e)) } finally { setBusy('') }
  }

  const verifier = () => lancer('verifier', () => apiPost<Passage>(`/rotation/elements/${el.id}/verifier`))

  async function tourner() {
    const ok = await confirmDialog({
      title: `tourner maintenant : ${el.nom} ?`, ok: 'tourner', danger: true,
      body: `Va : ${phrasePlan(el)} Fais d'abord « vérifier maintenant » si ce n'est pas déjà fait.`,
    })
    if (ok) await lancer('tourner', async () => apiPost<Passage>(`/rotation/elements/${el.id}/tourner`, undefined, await withConfirm('rotation_executer')))
  }

  async function terminer(abandon: boolean) {
    const ok = await confirmDialog({
      title: abandon ? 'abandonner le nouveau secret ?' : 'terminer la rotation ?', ok: abandon ? 'abandonner' : 'terminer', danger: abandon,
      body: abandon ? "L'ancien secret reste le bon. La version en attente est effacée du coffre."
        : "Confirme que tu as appliqué le nouveau secret sur le service. Il devient alors le mot de passe du coffre (l'ancien est gardé).",
    })
    if (ok) await lancer('terminer', async () => apiPost<Passage>(`/rotation/elements/${el.id}/terminer`, { abandon }, await withConfirm('rotation_executer')))
  }

  async function autoReel() {
    const actif = !el.auto_reel
    const ok = await confirmDialog({
      title: actif ? 'laisser l\'app tourner seule ?' : 'repasser en vérification seule ?', ok: 'confirmer',
      body: actif ? "À l'échéance, l'app fera la rotation réelle sans te demander, si le contrôle préalable passe. Un échec critique l'arrête."
        : "À l'échéance, l'app fera seulement un essai à blanc et te préviendra.",
    })
    if (!ok) return
    try { await apiPost(`/rotation/elements/${el.id}/auto-reel`, { actif }, await withConfirm('rotation_executer')); onChange() } catch (e) { setErr(message(e)) }
  }

  async function retirer() {
    const ok = await confirmDialog({
      title: `retirer « ${el.nom} » ?`, ok: 'retirer', danger: true,
      body: "Seul le plan est supprimé : le mot de passe, le coffre et le service ne sont pas touchés. L'historique est conservé.",
    })
    if (!ok) return
    try { await apiDelete(`/rotation/elements/${el.id}`, await withConfirm('rotation_supprimer')); toast('rotation retirée'); onChange() } catch (e) { setErr(message(e)) }
  }

  async function voirHistorique() {
    if (hist) { setHist(null); return }
    try { setHist((await apiGet<{ passages: Passage[] }>(`/rotation/historique?element=${encodeURIComponent(el.id)}&limite=20`)).passages) } catch (e) { setErr(message(e)) }
  }

  return (
    <div className={`rot-el ${occupe ? 'busy' : ''}`}>
      <div className="rot-top">
        <h3>{el.nom}</h3>
        <Chip tone={tonEtat(s.etat)}>{LIBELLE_ETAT[s.etat]}</Chip>
        {el.gere_ailleurs && <Chip>gérée ailleurs</Chip>}
        {occupe && <Chip tone="gold">{busy === 'tourner' || el.en_cours ? 'en cours…' : 'vérification…'}</Chip>}
      </div>
      <p className="rot-note">{phraseMode(el)}</p>
      <dl className="rot-grid">
        <div><dt>prochaine rotation</dt><dd>{phraseProchaine(s, now)}</dd></div>
        <div><dt>dernière réussie</dt><dd>{phraseDate(s.derniere_reussite, now)}</dd></div>
        <div><dt>dernière en échec</dt><dd>{s.dernier_echec === null ? 'aucune' : phraseDate(s.dernier_echec, now)}</dd></div>
        <div><dt>sonde</dt><dd>{phraseSonde(el)}{s.sonde ? ` (${phraseDate(s.sonde.quand, now)})` : ''}</dd></div>
        <div><dt>consommateurs</dt><dd>{el.consommateurs.length ? `${el.consommateurs.filter((c) => c.type === 'blob_cred').length} fichier(s) .cred, ${el.consommateurs.filter((c) => c.type === 'unite').length} service(s) relancé(s)` : 'aucun déclaré'}</dd></div>
      </dl>
      <div className="rot-actions">
        <Btn sm onClick={verifier} disabled={occupe || !coffreOk}>vérifier maintenant</Btn>
        {attente
          ? (<>
            <Btn sm solid onClick={() => terminer(false)} disabled={occupe}>terminer la rotation</Btn>
            <Btn sm onClick={() => terminer(true)} disabled={occupe}>abandonner</Btn>
          </>)
          : <Btn sm solid onClick={tourner} disabled={occupe || !coffreOk}>{el.adaptateur === 'assiste' ? 'préparer un nouveau secret' : 'tourner maintenant'}</Btn>}
        {el.adaptateur !== 'assiste' && !el.gere_ailleurs && (
          <Btn sm onClick={autoReel} disabled={occupe}>{el.auto_reel ? 'ne plus tourner seule' : 'tourner seule à l\'échéance'}</Btn>
        )}
        <Btn sm onClick={voirHistorique}>{hist ? 'masquer l\'historique' : 'historique'}</Btn>
        <Btn sm danger onClick={retirer} disabled={occupe}>retirer</Btn>
      </div>
      {err && <p className="rot-err">{err}</p>}
      {run && <RunSteps run={run} />}
      {hist && (
        <div className="rot-hist">
          {hist.length === 0 && <span className="sec-muted">aucun passage pour l'instant</span>}
          {hist.map((h, i) => (
            <div key={`${h.fin}-${i}`}>
              <button className="row" onClick={() => setOuvert(ouvert === i ? null : i)} aria-expanded={ouvert === i}>
                <Chip tone={tonStatut(h.statut)}>{LIBELLE_STATUT[h.statut]}</Chip>
                <span>{new Date(h.fin * 1000).toLocaleString('fr-FR')}</span>
                <span className="sec-muted">{h.reel ? 'réelle' : 'à blanc'}{h.declencheur === 'planificateur' ? ', planifiée' : ''}</span>
              </button>
              {ouvert === i && <RunSteps run={h} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
