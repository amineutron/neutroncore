import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiPost, withConfirm } from '../lib/api'
import { confirmDialog, toast } from '../lib/dialog'
import { ago, groupByDay, worstUnread, type Notif, type NotifList } from '../lib/notifs'

export function NotifBell({ data, open, onToggle }: { data: NotifList | null; open: boolean; onToggle: () => void }) {
  const unread = data?.unread ?? 0
  const tone = worstUnread(data?.entries ?? [])
  return (
    <button className={`nt-bell ${open ? 'on' : ''}`} onClick={onToggle}
      aria-label={unread > 0 ? `Notifications : ${unread} non lues` : 'Notifications'}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && <span className={`nt-count ${tone ?? ''}`}>{unread > 99 ? '99+' : unread}</span>}
    </button>
  )
}

// Fil persistant : alertes système (apparition, aggravation, résolution) et sessions Claude.
export function NotifCenter({ data, onClose, onOpenEntry, onChanged }: {
  data: NotifList | null; onClose: () => void; onOpenEntry: (n: Notif) => void; onChanged: () => void
}) {
  // ce qui était non lu à l'ouverture reste surligné, même une fois marqué lu côté serveur
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const sent = useRef(new Set<string>())
  // relevé frais à l'ouverture : la liste en mémoire peut avoir 30 s de retard
  useEffect(() => { onChanged() }, [onChanged])
  // on ne marque lues que les entrées réellement affichées (par identifiant),
  // y compris celles qui arrivent pendant que le tiroir est ouvert
  useEffect(() => {
    const seen = (data?.entries ?? []).filter((e) => !e.read && !sent.current.has(e.id)).map((e) => e.id)
    if (seen.length === 0) return
    seen.forEach((id) => sent.current.add(id))
    setFresh((f) => new Set([...f, ...seen]))
    apiPost('/notifications/read', { ids: seen }).then(onChanged).catch(() => { seen.forEach((id) => sent.current.delete(id)) })
  }, [data, onChanged])

  async function clear() {
    if (!await confirmDialog({ title: 'vider les notifications ?', body: 'Le fil est effacé. Les alertes toujours actives restent sur l’accueil.', ok: 'vider', danger: true })) return
    try {
      await apiDelete('/notifications', await withConfirm('notifications_clear'))
      onChanged()
    } catch (e) { toast(`échec : ${(e as Error).message}`, 'crit') }
  }

  const days = groupByDay(data?.entries ?? [], Date.now())
  return (
    <>
      <div className="drawer-bg nt-bg" onClick={onClose} />
      <aside className="nt-drawer" aria-label="Notifications">
        <div className="nt-head">
          <b>notifications</b>
          <span style={{ flex: 1 }} />
          {(data?.entries.length ?? 0) > 0 && <button className="btn sm danger" onClick={clear}>vider</button>}
          <button className="btn sm" onClick={onClose}>fermer</button>
        </div>
        {!data && <div className="nt-empty">chargement…</div>}
        {data && days.length === 0 && <div className="nt-empty">Rien à signaler. Les alertes et les sessions Claude apparaîtront ici.</div>}
        {days.map((d) => (
          <div key={d.label}>
            <div className="nt-day">{d.label}</div>
            {d.entries.map((n) => (
              <button key={n.id} className={`nt-row ${n.level} ${fresh.has(n.id) ? 'fresh' : ''}`} onClick={() => onOpenEntry(n)}>
                <span className={`dot ${n.level === 'info' ? 'off' : n.level}`} />
                <span className="nt-text">
                  <b>{n.title}{n.count > 1 && <span className="nt-times"> ×{n.count}</span>}</b>
                  {n.detail && <span>{n.detail}</span>}
                </span>
                <span className="nt-when">{ago(n.at, Date.now())}</span>
              </button>
            ))}
          </div>
        ))}
        {data && data.total > data.entries.length && (
          <div className="nt-empty">{data.total - data.entries.length} notifications plus anciennes ne sont pas affichées.</div>
        )}
      </aside>
    </>
  )
}
