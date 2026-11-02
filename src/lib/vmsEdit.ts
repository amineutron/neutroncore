// Edition des parametres d'une VM : logique pure (brouillon, bornes, difference).
// Miroir de lib/vms_console.validate_edit cote API ; l'API et l'outil vm_edit
// re-verifient tout, ici on evite seulement un aller-retour inutile.

export type EditLimits = { vcpus: [number, number]; memory_mib: [number, number]; description: number }
export type EditPayload = { vcpus?: number; memory_mib?: number; autostart?: boolean }
export type EditCurrent = { vcpus?: number | null; memory_mib?: number | null; autostart_on?: boolean | null }

/** Ce que l'utilisateur tape : texte pour les nombres, case pour le demarrage auto. */
export type EditDraft = { vcpus: string; memory_mib: string; autostart: boolean }
export type EditErrors = Partial<Record<'vcpus' | 'memory_mib', string>>

export const DEFAULT_LIMITS: EditLimits = { vcpus: [1, 32], memory_mib: [512, 65536], description: 256 }

export function draftFrom(cur: EditCurrent): EditDraft {
  return {
    vcpus: cur.vcpus != null ? String(cur.vcpus) : '',
    memory_mib: cur.memory_mib != null ? String(cur.memory_mib) : '',
    autostart: cur.autostart_on === true,
  }
}

function intIn(text: string, [lo, hi]: [number, number], unit: string): string | null {
  const t = text.trim()
  if (!/^\d{1,6}$/.test(t)) return 'un nombre entier'
  const n = Number(t)
  return n < lo || n > hi ? `entre ${lo} et ${hi} ${unit}`.trim() : null
}

/** Erreurs de saisie ; un champ vide est une erreur seulement s'il a une valeur d'origine. */
export function editErrors(d: EditDraft, lim: EditLimits = DEFAULT_LIMITS): EditErrors {
  const e: EditErrors = {}
  const v = intIn(d.vcpus, lim.vcpus, 'processeurs')
  if (v) e.vcpus = v
  const m = intIn(d.memory_mib, lim.memory_mib, 'Mio')
  if (m) e.memory_mib = m
  return e
}

/** Seuls les champs modifies (l'API refuse une demande vide). */
export function editPayload(initial: EditDraft, d: EditDraft): EditPayload {
  const p: EditPayload = {}
  if (d.vcpus.trim() !== initial.vcpus.trim()) p.vcpus = Number(d.vcpus)
  if (d.memory_mib.trim() !== initial.memory_mib.trim()) p.memory_mib = Number(d.memory_mib)
  if (d.autostart !== initial.autostart) p.autostart = d.autostart
  return p
}

/** Vrai si un changement demande exige que la VM soit arretee. */
export function needsStop(p: EditPayload, fields: string[] = ['vcpus', 'memory_mib']): boolean {
  return fields.some((f) => f in p)
}

/** Phrase de resume des changements, pour la confirmation. */
export function editSummary(p: EditPayload): string {
  const parts: string[] = []
  if (p.vcpus !== undefined) parts.push(`${p.vcpus} processeur${p.vcpus > 1 ? 's' : ''}`)
  if (p.memory_mib !== undefined) parts.push(`${p.memory_mib} Mio de memoire`)
  if (p.autostart !== undefined) parts.push(`demarrage auto ${p.autostart ? 'active' : 'desactive'}`)
  return parts.join(', ')
}
