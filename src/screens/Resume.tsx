import { useState } from 'react'
import { apiPost } from '../lib/api'
import { toast } from '../lib/dialog'
import { BriefingView } from '../components/resume/BriefingView'
import { ResumeEditor } from '../components/resume/ResumeEditor'
import { useResumeDraft } from '../components/resume/useResumeDraft'
import { Btn, Card, Chip, Loader, PageTitle } from '../components/ui'

// Résumé matinal : réglages à gauche, aperçu en direct (réglages non enregistrés compris) à droite.
export function Resume() {
  const d = useResumeDraft()
  const [sending, setSending] = useState(false)

  async function sendNow() {
    setSending(true)
    try {
      const r = await apiPost<{ success: boolean; centre?: boolean; telephone?: boolean; erreur?: string }>('/resume/envoyer')
      toast(r.success ? `envoyé${r.centre ? ' : centre' : ''}${r.telephone ? ' : téléphone' : ''}` : `non envoyé${r.erreur ? ` (${r.erreur})` : ''}`, r.success ? 'ok' : 'warn')
    } catch (e) { toast(`envoi impossible : ${(e as Error).message}`, 'crit') }
    finally { setSending(false) }
  }

  return (
    <>
      <PageTitle help="resume" title="résumé du matin" desc="Un briefing par gabarits : météo, agenda, alertes, sorties, système. Tu choisis le contenu." />
      {d.error && !d.draft && <Chip tone="crit">{d.error}</Chip>}
      {!d.draft || !d.meta ? <Loader /> : (
        <div className="rs-layout">
          <div>
            <ResumeEditor value={d.draft} catalogue={d.meta.sections} introMax={d.meta.intro_max} onChange={d.setDraft} />
            <div className="rs-actions">
              <Btn solid onClick={() => void d.save()} disabled={!d.dirty || d.busy}>{d.busy ? 'enregistrement…' : 'enregistrer'}</Btn>
              <Btn onClick={d.reset} disabled={!d.dirty}>annuler les changements</Btn>
              {d.dirty && <Chip tone="warn">non enregistré</Chip>}
            </div>
          </div>
          <div className="rs-side">
            <Card title="aperçu en direct" lite={d.previewing ? 'mise à jour…' : d.dirty ? 'avec tes changements' : 'tel qu\'enregistré'}>
              {d.preview ? <BriefingView b={d.preview} /> : <Loader />}
              {d.error && <p className="rs-note">{d.error}</p>}
              <div className="rs-actions">
                <Btn onClick={() => void sendNow()} disabled={sending || d.dirty}>{sending ? 'envoi…' : 'envoyer maintenant'}</Btn>
                {d.dirty && <span className="rs-note">enregistre d'abord : l'envoi utilise les réglages enregistrés</span>}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
