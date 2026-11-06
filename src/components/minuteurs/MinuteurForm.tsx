import { useState } from 'react'
import { apiPost } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { lireDuree, PRESETS, type Reglages } from '../../lib/minuteurs'
import { Btn, Card } from '../ui'
import './minuteurs.css'

// Création d'un minuteur : durées en un geste, saisie libre (« 1h30 »), nom, ou une phrase (« minuteur pâtes 8 min »).
export function MinuteurForm({ reglages, onDone }: { reglages: Reglages; onDone: () => void }) {
  const [nom, setNom] = useState('')
  const [duree, setDuree] = useState('')
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const p = reglages.pomodoro

  async function envoyer(corps: Record<string, unknown>, route = ''): Promise<boolean> {
    setBusy(true)
    try {
      await apiPost(`/minuteurs${route}`, corps)
      onDone()
      return true
    } catch (e) {
      toast((e as Error).message, 'crit')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function lancerDuree(secondes: number | null) {
    if (!secondes) { toast('durée illisible : essaie « 10 », « 1h30 » ou « 90 s »', 'warn'); return }
    if (await envoyer({ nom: nom.trim() || undefined, duree_s: secondes })) { setNom(''); setDuree('') }
  }

  async function lancerPhrase() {
    if (!phrase.trim()) return
    if (await envoyer({ texte: phrase }, '/phrase')) setPhrase('')
  }

  return (
    <Card title="nouveau minuteur">
      <div className="mn-form">
        <div className="mn-row">
          <input className="grow" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60}
            placeholder="nom (facultatif) : cuisine, thé…" aria-label="nom du minuteur" />
        </div>
        <div className="mn-row">
          {PRESETS.map((x) => <Btn key={x.label} sm disabled={busy} onClick={() => lancerDuree(x.secondes)}>{x.label}</Btn>)}
        </div>
        <div className="mn-row">
          <input value={duree} onChange={(e) => setDuree(e.target.value)} placeholder="autre durée : 1h30, 90 s…" aria-label="durée"
            onKeyDown={(e) => e.key === 'Enter' && lancerDuree(lireDuree(duree))} style={{ width: 190 }} />
          <Btn sm solid disabled={busy || !duree.trim()} onClick={() => lancerDuree(lireDuree(duree))}>lancer</Btn>
        </div>
        <div className="mn-row">
          <Btn sm disabled={busy} onClick={() => envoyer({ type: 'pomodoro', nom: nom.trim() || undefined })}>
            pomodoro {p.travail_min}/{p.pause_min} x{p.cycles}
          </Btn>
          <span className="lite">durées modifiables dans « réglages »</span>
        </div>
        <div className="mn-row">
          <input className="grow" value={phrase} onChange={(e) => setPhrase(e.target.value)} aria-label="phrase"
            placeholder="ou une phrase : minuteur pâtes 8 min · pomodoro 50/10 x3"
            onKeyDown={(e) => e.key === 'Enter' && lancerPhrase()} />
          <Btn sm disabled={busy || !phrase.trim()} onClick={lancerPhrase}>créer</Btn>
        </div>
      </div>
    </Card>
  )
}
