// Centre de notifications : types et mise en forme (logique pure).

export type NotifLevel = 'ok' | 'info' | 'warn' | 'crit'
export type Notif = {
  id: string; at: number; source: 'system' | 'session'; level: NotifLevel
  title: string; detail: string; action: string; ref: string; count: number; read: boolean
}
export type NotifList = { entries: Notif[]; unread: number; total: number }
export type NotifDay = { label: string; entries: Notif[] }

const DAY = 86_400_000
const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime() }

export function dayLabel(atMs: number, nowMs: number): string {
  const diff = Math.round((startOfDay(nowMs) - startOfDay(atMs)) / DAY)
  if (diff <= 0) return "aujourd'hui"
  if (diff === 1) return 'hier'
  return new Date(atMs).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Regroupe par jour en gardant l'ordre reçu (le plus récent en premier). */
export function groupByDay(entries: Notif[], nowMs: number): NotifDay[] {
  const days: NotifDay[] = []
  for (const e of entries) {
    const label = dayLabel(e.at * 1000, nowMs)
    const last = days[days.length - 1]
    if (last?.label === label) last.entries.push(e)
    else days.push({ label, entries: [e] })
  }
  return days
}

export function ago(atSec: number, nowMs: number): string {
  const s = Math.max(0, Math.round(nowMs / 1000 - atSec))
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  return new Date(atSec * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// niveau le plus grave parmi les non lues : couleur de la pastille de la cloche
export function worstUnread(entries: Notif[]): NotifLevel | null {
  const order: NotifLevel[] = ['crit', 'warn', 'info', 'ok']
  const levels = new Set(entries.filter((e) => !e.read).map((e) => e.level))
  return order.find((l) => levels.has(l)) ?? null
}
