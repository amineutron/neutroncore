import { useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { usePoll } from '../../lib/poll'
import { Btn, Card, Chip } from '../ui'

const SOURCES = ['hdmi1', 'hdmi2', 'hdmi3', 'hdmi4']
const CLE_SOURCE = 'neutroncore_worldmonitor_source'
type Affichage = { avant: { power?: string; window?: string | null } | null; ecrans: string[] }

function sourceMemorisee(): string {
  try { const s = localStorage.getItem(CLE_SOURCE); return s && SOURCES.includes(s) ? s : 'hdmi1' } catch { return 'hdmi1' }
}

/** Affiche God Eye sur la télé (plein écran, sans barre d'outils) avec les derniers filtres utilisés ici. */
export function SurLaTele() {
  const [source, setSource] = useState(sourceMemorisee)
  const [occupe, setOccupe] = useState(false)
  const etat = usePoll(() => apiGet<Affichage>('/tv/affichage'), 10_000)
  const dispo = etat.data?.ecrans.includes('monde') ?? false
  const affiche = Boolean(etat.data?.avant?.window)

  const agir = async (chemin: string, corps?: unknown) => {
    setOccupe(true)
    try {
      const r = await apiPost<{ success: boolean; error?: string | null }>(chemin, corps)
      toast(r.success ? 'fait' : (r.error ?? 'échec'), r.success ? 'ok' : 'crit')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'échec', 'crit')
    } finally { setOccupe(false); etat.refresh() }
  }
  const choisir = (v: string) => { setSource(v); try { localStorage.setItem(CLE_SOURCE, v) } catch { /* le choix ne survit pas sans stockage */ } }

  return (
    <Card title="sur la télé">
      <p className="muted">Allume la télé, la passe sur l'entrée du PC et ouvre God Eye en plein écran, avec les couches et filtres réglés ici en dernier. « remettre » ferme la fenêtre et relance ce que la télé montrait avant.</p>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip tone={affiche ? 'ok' : undefined}>{affiche ? 'affiché' : 'pas affiché'}</Chip>
        {etat.data && !dispo && <Chip tone="warn">vue inconnue de l'api : la redémarrer</Chip>}
        <label>entrée du pc{' '}
          <select value={source} onChange={(e) => choisir(e.target.value)}>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </label>
        <Btn solid disabled={occupe || !dispo} onClick={() => void agir('/tv/afficher', { source, ecran: 'monde' })}>afficher god eye</Btn>
        <Btn disabled={occupe} onClick={() => void agir('/tv/remettre')}>remettre</Btn>
      </div>
    </Card>
  )
}
