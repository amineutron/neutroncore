import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { setNavGuard } from '../../lib/navGuard'
import { memesReglages, type Briefing, type Reglages, type ReglagesReponse } from '../../lib/resume'

const PREVIEW_DELAY_MS = 350

// Brouillon des réglages du résumé : chargement, aperçu en direct (POST /resume/apercu, anti-rebond,
// les réponses périmées sont ignorées), enregistrement, garde de navigation si non enregistré.
export function useResumeDraft() {
  const [meta, setMeta] = useState<ReglagesReponse | null>(null)
  const [saved, setSaved] = useState<Reglages | null>(null)
  const [draft, setDraft] = useState<Reglages | null>(null)
  const [preview, setPreview] = useState<Briefing | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    apiGet<ReglagesReponse>('/resume/reglages')
      .then((r) => { setMeta(r); setSaved(r.reglages); setDraft(r.reglages) })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!draft) return
    const mine = ++seq.current
    setPreviewing(true)
    const t = setTimeout(() => {
      apiPost<{ resume: Briefing }>('/resume/apercu', { reglages: draft })
        .then((r) => { if (mine === seq.current) { setPreview(r.resume); setError('') } })
        .catch((e: Error) => { if (mine === seq.current) setError(e.message) })
        .finally(() => { if (mine === seq.current) setPreviewing(false) })
    }, PREVIEW_DELAY_MS)
    return () => clearTimeout(t)
  }, [draft])

  const dirty = Boolean(draft && saved && !memesReglages(draft, saved))
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    setNavGuard(() => confirmDialog({ title: 'quitter sans enregistrer ?', body: 'Les réglages du résumé ont été modifiés.', ok: 'quitter', cancel: 'rester', danger: true }))
    return () => { window.removeEventListener('beforeunload', warn); setNavGuard(null) }
  }, [dirty])

  const save = useCallback(async () => {
    if (!draft) return
    setBusy(true)
    try {
      const r = await apiPut<{ success: boolean; reglages: Reglages }>('/resume/reglages', { reglages: draft })
      setSaved(r.reglages); setDraft(r.reglages)
      toast('résumé enregistré')
    } catch (e) { toast(`enregistrement refusé : ${(e as Error).message}`, 'crit') }
    finally { setBusy(false) }
  }, [draft])

  return { meta, saved, draft, setDraft, preview, previewing, error, busy, dirty, save, reset: () => setDraft(saved) }
}
