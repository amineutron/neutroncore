// Formulaire « me rappeler » d'un événement : moyens, délai, sonnerie choisie dans la banque
// (components/SonnerieBank.tsx), sortie, durée, volume. Listes lues sur GET /agenda/rappels.
import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { confirmDialog, toast } from '../lib/dialog'
import {
  AVANT, DUREES, MOYENS, VOLUMES, VOLUMES_SORTIE, avantLibelle, basculerMoyen, resultatsTexte,
  type Rappel, type RappelsEtat,
} from '../lib/rappels'
import { SonnerieBank } from './SonnerieBank'
import { Btn } from './ui'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function RappelForm({ value, titre, onChange }: { value: Rappel; titre: string; onChange: (r: Rappel) => void }) {
  const [etat, setEtat] = useState<RappelsEtat | null>(null)
  const actif = value.moyens.length > 0
  const sonne = value.moyens.includes('sonnerie')
  const charger = () => { apiGet<RappelsEtat>('/agenda/rappels').then(setEtat).catch(() => setEtat(null)) }
  useEffect(charger, [])

  const set = <K extends keyof Rappel>(k: K, v: Rappel[K]) => onChange({ ...value, [k]: v })

  async function essayer() {
    const tele = value.moyens.includes('tele')
    const ok = await confirmDialog({
      title: 'essayer ce rappel maintenant ?',
      body: `${tele ? 'La télé va s’allumer sur le PC. ' : ''}${sonne ? 'La sonnerie sonnera jusqu’à « arrêter » ou la durée réglée.' : ''}`,
      ok: 'essayer',
    })
    if (!ok) return
    try {
      const r = await apiPost<{ resultats: Record<string, string> }>('/agenda/rappels/essayer', { rappel: value, titre: titre || 'essai de rappel' })
      const echec = Object.values(r.resultats).some((v) => v !== 'ok')
      toast(resultatsTexte(r.resultats), echec ? 'warn' : 'ok')
    } catch (e) { toast(`essai impossible : ${message(e)}`, 'warn') }
  }

  const sorties = etat?.sorties ?? [{ id: 'tele', nom: 'la télé', tele: true, present: true }, { id: 'defaut', nom: 'sortie par défaut du PC', tele: false, present: true }]
  const nomSortie = (s: { nom: string; present: boolean }) => (s.present ? s.nom : `${s.nom} (absente)`)
  const volumeActuel = sorties.find((s) => s.id === value.sortie)?.volume ?? null

  return (
    <fieldset className="rp-form wide">
      <legend>me rappeler</legend>
      <div className="rp-moyens">
        {MOYENS.map((m) => (
          <label key={m.id} className="check">
            <input type="checkbox" checked={value.moyens.includes(m.id)} onChange={(e) => onChange(basculerMoyen(value, m.id, e.target.checked))} />
            {m.label}
          </label>
        ))}
      </div>
      {actif && (
        <label>quand
          <select value={value.minutes_avant} onChange={(e) => set('minutes_avant', Number(e.target.value))}>
            {AVANT.map((m) => <option key={m} value={m}>{avantLibelle(m)}</option>)}
          </select>
        </label>
      )}
      {sonne && (
        <>
          <label>sonne sur
            <select value={value.sortie} onChange={(e) => set('sortie', e.target.value)}>
              {sorties.map((s) => <option key={s.id} value={s.id}>{nomSortie(s)}</option>)}
            </select>
          </label>
          <label>sonne au plus
            <select value={value.duree_min} onChange={(e) => set('duree_min', Number(e.target.value))}>
              {DUREES.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
          <label>volume de la sortie son
            <select value={value.volume_sortie ?? ''} onChange={(e) => set('volume_sortie', e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">inchangé{volumeActuel != null ? ` (${volumeActuel} %)` : ''}</option>
              {VOLUMES_SORTIE.map((v) => <option key={v} value={v}>{v} %</option>)}
            </select>
          </label>
          {value.sortie === 'tele' && (
            <label>volume de l’ampli (télé)
              <select value={value.volume ?? ''} onChange={(e) => set('volume', e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">inchangé</option>
                {VOLUMES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          )}
          <label className="check rp-prog">
            <input type="checkbox" checked={value.progressif} onChange={(e) => set('progressif', e.target.checked)} />
            volume qui monte sur la première minute
          </label>
          {etat ? (
            <SonnerieBank sonneries={etat.sonneries} sorties={sorties} value={value.sonnerie} sortieRappel={value.sortie}
              onChoose={(id) => set('sonnerie', id)} onChanged={charger} />
          ) : <p className="rp-note wide">banque de sonneries injoignable</p>}
        </>
      )}
      {actif && (
        <div className="rp-ecoute wide">
          <span className="rp-note">Vérifié une heure avant : si la télé ou la sortie son ne répond pas, tu es prévenu à temps.{(value.volume != null || value.volume_sortie != null) && sonne ? ' Les volumes d’avant sont remis quand la sonnerie s’arrête.' : ''}</span>
          <Btn sm onClick={essayer}>essayer maintenant</Btn>
        </div>
      )}
    </fieldset>
  )
}
