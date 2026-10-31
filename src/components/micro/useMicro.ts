import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, DEMO, apiGet, getApiKey } from '../../lib/api'
import { getSettings } from '../../lib/settings'
import { MAX_MS, capability, cleanTranscript, micError, pickMime, tooShort, type Capability } from '../../lib/micro'

export type MicState = 'idle' | 'recording' | 'transcribing' | 'review' | 'error'

function environment(): Capability {
  return capability({
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext,
    hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
    hasRecorder: typeof MediaRecorder !== 'undefined',
  })
}

async function openStream(): Promise<MediaStream> {
  const wanted = getSettings().audioInput
  const audio = { echoCancellation: true, noiseSuppression: true, ...(wanted ? { deviceId: { exact: wanted } } : {}) }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio })
  } catch (e) {
    // micro configure absent (telephone debranche...) : on retombe sur l'entree par defaut avant d'abandonner
    if (wanted && (e as DOMException).name === 'OverconstrainedError') return navigator.mediaDevices.getUserMedia({ audio: true })
    throw e
  }
}

// Appui-pour-parler : start() a l'appui, stop() au relachement. Le texte transcrit passe par l'etat
// `review` : rien n'est envoye tant que l'appelant n'a pas confirme (le hook ne sait pas envoyer).
export function useMicro() {
  const [state, setState] = useState<MicState>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [serverStt, setServerStt] = useState<boolean | null>(null)   // null = pas encore sonde
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const timer = useRef<number | null>(null)
  const alive = useRef(true)
  const wantStop = useRef(false)   // relache avant l'ouverture du micro

  const env = environment()
  useEffect(() => { alive.current = true; return () => { alive.current = false; release() } }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (DEMO || !env.ok) return
    apiGet<{ available: boolean }>('/lyra/stt').then((s) => setServerStt(s.available)).catch(() => setServerStt(false))
  }, [env.ok])

  function release() {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach((t) => t.stop())   // coupe le voyant du micro
    stream.current = null
  }

  const fail = useCallback((msg: string) => { release(); setError(msg); setState('error') }, [])

  const transcribe = useCallback(async (blob: Blob) => {
    setState('transcribing')
    try {
      const r = await fetch('/lyra/stt', { method: 'POST', headers: { Authorization: `Bearer ${getApiKey()}`, 'Content-Type': blob.type || 'audio/webm' }, body: blob })
      if (!r.ok) throw new ApiError(r.status, r.statusText)
      const body = await r.json() as { success: boolean; text?: string; error?: string }
      if (!alive.current) return
      if (!body.success) return fail(body.error ?? 'transcription impossible')
      const clean = cleanTranscript(body.text ?? '')
      if (!clean) return fail('rien n’a été compris : réessaie plus près du micro')
      setText(clean)
      setState('review')
    } catch (e) {
      if (alive.current) fail(`transcription impossible : ${(e as Error).message}`)
    }
  }, [fail])

  const start = useCallback(async () => {
    if (state === 'recording' || state === 'transcribing') return
    if (!env.ok) return fail(env.reason)
    if (serverStt === false) return fail('transcription locale indisponible sur le serveur (faster-whisper de lyra introuvable)')
    setError('')
    wantStop.current = false
    recorder.current = null
    setState('recording')
    try {
      const s = await openStream()
      if (!alive.current || wantStop.current) { s.getTracks().forEach((t) => t.stop()); if (alive.current) setState('idle'); return }
      stream.current = s
      const mime = pickMime((m) => MediaRecorder.isTypeSupported(m))
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      rec.onstop = () => {
        const ms = Date.now() - startedAt.current
        const blob = new Blob(chunks.current, { type: rec.mimeType || mime || 'audio/webm' })
        release()
        if (tooShort(ms)) { setState('idle'); return }   // appui involontaire : on jette sans rien dire
        void transcribe(blob)
      }
      recorder.current = rec
      startedAt.current = Date.now()
      rec.start()
      timer.current = window.setTimeout(() => stop(), MAX_MS)
    } catch (e) {
      fail(micError((e as DOMException).name))
    }
  }, [state, env.ok, serverStt, fail, transcribe])  // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    const rec = recorder.current
    if (rec && rec.state !== 'inactive') rec.stop()
    else wantStop.current = true
  }, [])

  const reset = useCallback(() => { release(); setText(''); setError(''); setState('idle') }, [])

  return { state, text, setText, error, start, stop, reset, supported: env.ok, unsupportedReason: env.ok ? '' : env.reason }
}
