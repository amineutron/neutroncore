import { useState } from 'react'
import { apiDelete, apiGet, apiPost, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { Btn, Card, Chip } from './ui'

type Declined = { request_id: number; kind: string; title: string; reason: string; declined_at: string }

// Refus automatiques de stalled_cleaner, avec « masquer » (liste seulement)
// et « supprimer » (retiré de Radarr/Sonarr et d'Overseerr, fichiers gardés).
export function DeclinedAuto() {
  const declined = usePoll<{ declined: Declined[]; stalled_watching: number }>(() => apiGet('/requests/declined-auto'), 300000)
  const [declBusy, setDeclBusy] = useState<number | null>(null)
  const [declMsg, setDeclMsg] = useState('')
  async function declinedAction(x: Declined, mode: 'hide' | 'delete') {
    if (mode === 'delete' && !window.confirm(
      `Supprimer « ${x.title} » ? Retiré de ${x.kind === 'tv' ? 'Sonarr' : 'Radarr'} et d'Overseerr (les fichiers déjà sur le disque sont gardés).`)) return
    setDeclBusy(x.request_id); setDeclMsg('')
    try {
      if (mode === 'hide') await apiPost(`/requests/declined-auto/${x.request_id}/hide`)
      else await apiDelete(`/requests/declined-auto/${x.request_id}`, await withConfirm('arr_delete'))
      setDeclMsg(`« ${x.title} » ${mode === 'hide' ? 'masqué' : 'supprimé'}`)
      declined.refresh()
    } catch (e) { setDeclMsg(`échec : ${(e as Error).message}`) } finally { setDeclBusy(null) }
  }
  return (
    <Card title="refusées automatiquement" lite="par stalled_cleaner">
      {declMsg && <div style={{ marginBottom: 8 }}><Chip tone={declMsg.startsWith('échec') ? 'crit' : 'ok'}>{declMsg}</Chip></div>}
      <table>
        <tbody>
          {(declined.data?.declined ?? []).slice(0, 8).map((x) => (
            <tr key={x.request_id}>
              <td>
                <b>{x.title}</b> <span style={{ color: 'var(--faint)', fontSize: 11 }}>{x.kind === 'tv' ? 'série' : 'film'}</span><br />
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{x.reason}</span>
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Btn sm disabled={declBusy === x.request_id} onClick={() => declinedAction(x, 'hide')}>masquer</Btn>{' '}
                <Btn sm danger disabled={declBusy === x.request_id} onClick={() => declinedAction(x, 'delete')}>supprimer</Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {declined.data && declined.data.stalled_watching > 0 && (
        <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10 }}>
          {declined.data.stalled_watching} torrent(s) à 0 seed sous surveillance.
        </p>
      )}
    </Card>
  )
}
