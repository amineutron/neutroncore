import { apiGet, apiPost, apiPut } from '../../lib/api'
import { toast } from '../../lib/dialog'
import type { Notif, Reglages } from '../../lib/minuteurs'
import { usePoll } from '../../lib/poll'
import { Btn, Card } from '../ui'
import './minuteurs.css'

type Banque = { sonneries: { id: string; nom: string; categorie: string }[]; sorties: { id: string; nom: string; present: boolean }[] }
const NOMS: Record<keyof Notif, string> = {
  centre: 'centre de notifications', navigateur: 'notification du navigateur', ntfy: 'téléphone (ntfy)', sonnerie: 'sonnerie',
}

// Réglages par défaut des nouveaux minuteurs : annonce, sonnerie (banque de l'agenda), pomodoro.
export function ReglagesMinuteurs({ reglages, onSaved }: { reglages: Reglages; onSaved: () => void }) {
  // le panneau n'est monté que déplié : le bouton « réglages » vit dans l'en-tête de l'écran
  const banque = usePoll<Banque>(() => apiGet('/agenda/rappels'), 300000)

  async function enregistrer(patch: Record<string, unknown>) {
    try {
      await apiPut('/minuteurs/reglages', patch)
      onSaved()
    } catch (e) {
      toast((e as Error).message, 'crit')
    }
  }

  async function ecouter() {
    try { await apiPost('/agenda/rappels/ecouter', { sonnerie: reglages.sonnerie, sortie: reglages.sortie }) }
    catch (e) { toast((e as Error).message, 'crit') }
  }

  async function demanderPermission() {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
  }

  const nombre = (cle: 'travail_min' | 'pause_min' | 'longue_min' | 'cycles', label: string, min: number, max: number) => (
    <label key={cle}>{label}
      <input type="number" min={min} max={max} defaultValue={reglages.pomodoro[cle]} style={{ width: 70 }}
        onBlur={(e) => {
          const v = Number(e.target.value)
          if (Number.isInteger(v) && v >= min && v <= max && v !== reglages.pomodoro[cle]) void enregistrer({ pomodoro: { [cle]: v } })
          else e.target.value = String(reglages.pomodoro[cle])
        }} />
    </label>
  )

  return (
    <Card title="réglages" lite="valeurs par défaut des nouveaux minuteurs" style={{ marginBottom: 14 }}>
      {(
        <div className="mn-reglages">
          <div>à la fin, prévenir par :</div>
          {(Object.keys(NOMS) as (keyof Notif)[]).map((k) => (
            <label key={k}>
              <input type="checkbox" checked={reglages.notif[k]}
                onChange={(e) => { if (k === 'navigateur' && e.target.checked) void demanderPermission(); void enregistrer({ notif: { [k]: e.target.checked } }) }} />
              {NOMS[k]}
            </label>
          ))}
          <div className="grid2">
            <label>sonnerie
              <select value={reglages.sonnerie} onChange={(e) => enregistrer({ sonnerie: e.target.value })}>
                {(banque.data?.sonneries ?? [{ id: reglages.sonnerie, nom: reglages.sonnerie, categorie: '' }]).map((s) =>
                  <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </label>
            <label>sortie son
              <select value={reglages.sortie} onChange={(e) => enregistrer({ sortie: e.target.value })}>
                {(banque.data?.sorties ?? [{ id: reglages.sortie, nom: reglages.sortie, present: true }]).filter((s) => s.present).map((s) =>
                  <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </label>
          </div>
          <div className="mn-row">
            <label>sonne au plus
              <input type="number" min={3} max={300} defaultValue={reglages.duree_sonnerie_s} style={{ width: 80 }}
                onBlur={(e) => { const v = Number(e.target.value); if (v >= 3 && v <= 300) void enregistrer({ duree_sonnerie_s: v }) }} /> s
            </label>
            <Btn sm onClick={ecouter}>écouter</Btn>
          </div>
          <div>pomodoro :</div>
          <div className="mn-row">
            {nombre('travail_min', 'travail (min)', 1, 120)}
            {nombre('pause_min', 'pause (min)', 1, 60)}
            {nombre('longue_min', 'longue pause (min, 0 = aucune)', 0, 120)}
            {nombre('cycles', 'cycles', 1, 12)}
          </div>
        </div>
      )}
    </Card>
  )
}
