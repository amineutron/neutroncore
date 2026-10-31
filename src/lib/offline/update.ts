// Detection de mise a jour : compare le hash du bundle charge (BUILD_ID) a celui
// que l'index servi annonce. Independant du service worker : marche aussi sans.

const RE = /\/assets\/index-([\w-]+)\.js/

export function extractBuildId(html: string): string | null {
  return RE.exec(html)?.[1] ?? null
}

/** 'dev' (pas de bundle hashe) ou index illisible : jamais de fausse alerte. */
export function isUpdateAvailable(currentId: string, html: string): boolean {
  if (!currentId || currentId === 'dev') return false
  const served = extractBuildId(html)
  return served !== null && served !== currentId
}

/** Recupere l'index SANS cache (ni HTTP, ni service worker) ; false si injoignable. */
export async function checkForUpdate(
  fetchFn: typeof fetch,
  base: string,
  currentId: string,
): Promise<boolean> {
  try {
    const r = await fetchFn(base, { cache: 'no-store' })
    if (!r.ok) return false
    return isUpdateAvailable(currentId, await r.text())
  } catch {
    return false // hors ligne : on ne sait pas, donc on ne dit rien
  }
}
