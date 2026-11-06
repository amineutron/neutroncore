// Journal de l'écran tâches : mélange les événements des sessions Claude Code ([DEV])
// et ceux du système ; un filtre masque les premiers.

export type JournalLine = { timestamp: string; message: string; session: string }

export const isDevSession = (name: string): boolean => name.trim().startsWith('[DEV]')

export function journalLines(
  sessions: { name: string; logs: { timestamp: string; message: string }[] }[],
  hideDev: boolean,
  max = 8,
): JournalLine[] {
  return sessions
    .filter((s) => !(hideDev && isDevSession(s.name)))
    .flatMap((s) => s.logs.map((l) => ({ ...l, session: s.name })))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, max)
}
