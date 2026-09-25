// Dates relatives au moment de l'affichage : la démo paraît toujours « vivante ».
const MIN = 60_000

export const nowMs = (): number => Date.now()
export const isoAgo = (minutes: number): string => new Date(Date.now() - minutes * MIN).toISOString()
export const isoIn = (minutes: number): string => new Date(Date.now() + minutes * MIN).toISOString()
export const unixAgo = (minutes: number): number => Math.floor((Date.now() - minutes * MIN) / 1000)
export const unixIn = (minutes: number): number => Math.floor((Date.now() + minutes * MIN) / 1000)
// format local "YYYY-MM-DDTHH:MM" attendu par l'agenda
export function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const dayAt = (offsetDays: number, hh: number, mm = 0): Date => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hh, mm, 0, 0)
  return d
}
