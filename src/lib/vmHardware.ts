// Edition materielle etendue d'une VM : logique pure (brouillon, difference, validation, ordre
// de demarrage). Miroir du contrat POST /vms-console/{vm}/edit (14 champs) cote lyra-control-api ;
// l'API et l'outil vm_edit re-verifient tout, ici on evite un aller-retour inutile et on explique.

import { NAME_RE } from './vmsConsole'

export const CPU_MODEL_IDS = ['host-passthrough', 'host-model', 'x86-64-v2', 'qemu64'] as const
export const FIRMWARES = ['bios', 'uefi'] as const
export const DISPLAYS = ['spice', 'vnc'] as const
export const BOOT_DEVICES = ['hd', 'cdrom', 'network'] as const
export type CpuModelId = typeof CPU_MODEL_IDS[number]
export type Firmware = typeof FIRMWARES[number]
export type Display = typeof DISPLAYS[number]
export type BootDevice = typeof BOOT_DEVICES[number]

export const USB_RE = /^[0-9a-f]{4}:[0-9a-f]{4}$/i

export type HardwareDisk = { target: string; path: string; capacity_gb: number | null }
/** Etat materiel renvoye par GET /vms-console/{vm} (`settings.hardware`). */
export type Hardware = {
  cpu_model: string | null; firmware: Firmware; secure_boot: boolean; tpm: boolean
  boot_order: string[]; display: Display | 'none'; network: string | null; disks: HardwareDisk[]; usb: string[]
}
export type Choice = { id: string; label: string; hint: string }
export type HardwareChoices = { cpu_models: Choice[]; firmware: Choice[]; displays: string[]; boot_devices: string[] }
export type HardwareLimits = { vcpus: [number, number]; memory_mib: [number, number]; description: number; disk_grow_gb: [number, number] }

/** Ce que l'utilisateur regle ; les nombres restent du texte jusqu'a la validation. */
export type HardwareDraft = {
  cpu_model: string; firmware: Firmware; tpm: boolean; secure_boot: boolean; boot_order: string[]
  display: Display; network: string; usb_attach: string; usb_detach: string; disk_grow_gb: string
}
export type HardwarePayload = {
  cpu_model?: string; firmware?: Firmware; tpm?: boolean; secure_boot?: boolean; boot_order?: string[]
  display?: Display; network?: string; usb_attach?: string; usb_detach?: string; disk_grow_gb?: number
}
export type HardwareField = keyof HardwarePayload
export type Verdict = { ok: true } | { ok: false; reason: string }

export const HARDWARE_NEEDS_STOP: string[] = ['cpu_model', 'firmware', 'tpm', 'secure_boot', 'disk_grow_gb']
export const DEFAULT_GROW: [number, number] = [1, 2048]

export const FIELD_LABEL: Record<HardwareField, string> = {
  cpu_model: 'modèle de processeur', firmware: 'firmware', tpm: 'TPM', secure_boot: 'secure boot', boot_order: 'ordre de démarrage',
  display: 'affichage', network: 'réseau', usb_attach: 'USB branché', usb_detach: 'USB débranché', disk_grow_gb: 'disque agrandi',
}
export const BOOT_LABEL: Record<string, string> = { hd: 'disque', cdrom: 'cdrom', network: 'réseau' }

/** Brouillon initial depuis l'etat reel ; un etat absent (lecture impossible) donne des valeurs neutres. */
export function draftFromHardware(hw: Hardware | null): HardwareDraft {
  const bootOk = (hw?.boot_order ?? []).filter((d) => (BOOT_DEVICES as readonly string[]).includes(d))
  return {
    cpu_model: hw?.cpu_model ?? '',
    firmware: hw?.firmware === 'uefi' ? 'uefi' : 'bios',
    tpm: hw?.tpm === true,
    secure_boot: hw?.secure_boot === true,
    boot_order: bootOk.length ? [...new Set(bootOk)] : ['hd'],
    display: hw?.display === 'vnc' ? 'vnc' : 'spice',
    network: hw?.network ?? '',
    usb_attach: '', usb_detach: '', disk_grow_gb: '',
  }
}

const sameList = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])

/** Seuls les champs modifies ; `secure_boot: true` emporte `firmware: 'uefi'` (le contrat l'exige dans le meme envoi). */
export function diffHardware(initial: HardwareDraft, d: HardwareDraft): HardwarePayload {
  const p: HardwarePayload = {}
  if (d.cpu_model !== initial.cpu_model && d.cpu_model) p.cpu_model = d.cpu_model
  if (d.firmware !== initial.firmware) p.firmware = d.firmware
  if (d.tpm !== initial.tpm) p.tpm = d.tpm
  if (d.secure_boot !== initial.secure_boot) p.secure_boot = d.secure_boot
  if (!sameList(d.boot_order, initial.boot_order)) p.boot_order = [...d.boot_order]
  if (d.display !== initial.display) p.display = d.display
  if (d.network.trim() !== initial.network.trim()) p.network = d.network.trim()
  if (d.usb_attach.trim()) p.usb_attach = d.usb_attach.trim().toLowerCase()
  if (d.usb_detach.trim()) p.usb_detach = d.usb_detach.trim().toLowerCase()
  if (d.disk_grow_gb.trim()) p.disk_grow_gb = Number(d.disk_grow_gb.trim())
  return p.secure_boot === true && p.firmware !== 'uefi' ? { ...p, firmware: 'uefi' } : p
}

/** Champs du brouillon qui exigent la machine arretee (liste de l'API, repli sur la notre). */
export function stopFields(p: HardwarePayload, needsStop: string[] = HARDWARE_NEEDS_STOP): HardwareField[] {
  return (Object.keys(p) as HardwareField[]).filter((k) => needsStop.includes(k))
}

/** Regles du contrat + etat de la machine. Une raison en francais, la premiere trouvee. */
export function validateHardware(p: HardwarePayload, state: string, opts: { needsStop?: string[]; grow?: [number, number] } = {}): Verdict {
  const keys = Object.keys(p) as HardwareField[]
  if (keys.length === 0) return { ok: false, reason: 'aucun changement à appliquer' }
  if (p.cpu_model !== undefined && !(CPU_MODEL_IDS as readonly string[]).includes(p.cpu_model)) return { ok: false, reason: `modèle de processeur inconnu : ${p.cpu_model}` }
  if (p.firmware !== undefined && !(FIRMWARES as readonly string[]).includes(p.firmware)) return { ok: false, reason: 'firmware : bios ou uefi' }
  if (p.display !== undefined && !(DISPLAYS as readonly string[]).includes(p.display)) return { ok: false, reason: 'affichage : spice ou vnc' }
  if (p.secure_boot === true && p.firmware !== 'uefi') return { ok: false, reason: 'le secure boot demande le firmware uefi' }
  if (p.boot_order !== undefined) {
    if (p.boot_order.length === 0) return { ok: false, reason: 'ordre de démarrage vide' }
    if (p.boot_order.some((d) => !(BOOT_DEVICES as readonly string[]).includes(d))) return { ok: false, reason: 'périphérique de démarrage inconnu' }
    if (new Set(p.boot_order).size !== p.boot_order.length) return { ok: false, reason: 'un périphérique de démarrage apparaît deux fois' }
  }
  if (p.network !== undefined && !NAME_RE.test(p.network)) return { ok: false, reason: 'nom de réseau : lettres, chiffres, - et _' }
  for (const k of ['usb_attach', 'usb_detach'] as const) {
    const v = p[k]
    if (v !== undefined && !USB_RE.test(v)) return { ok: false, reason: `identifiant USB attendu : vvvv:pppp (hexadécimal), reçu « ${v} »` }
  }
  if (p.usb_attach !== undefined && p.usb_attach === p.usb_detach) return { ok: false, reason: 'brancher et débrancher le même périphérique n\'a pas de sens' }
  if (p.disk_grow_gb !== undefined) {
    const [lo, hi] = opts.grow ?? DEFAULT_GROW
    if (!Number.isInteger(p.disk_grow_gb) || p.disk_grow_gb < lo || p.disk_grow_gb > hi) return { ok: false, reason: `agrandissement : un entier entre ${lo} et ${hi} Go` }
  }
  const blocked = stopFields(p, opts.needsStop)
  if (blocked.length && state !== 'stopped') return { ok: false, reason: `arrête la machine pour changer : ${blocked.map((k) => FIELD_LABEL[k]).join(', ')}` }
  return { ok: true }
}

/** Deplace l'element i d'un cran (dir -1 = monter, +1 = descendre) ; hors bornes : liste inchangee. */
export function moveBoot<T>(order: readonly T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (i < 0 || i >= order.length || j < 0 || j >= order.length) return [...order]
  const out = [...order]
  out[i] = order[j]
  out[j] = order[i]
  return out
}

/** Ajoute ou retire un peripherique de l'ordre (jamais vide, jamais en double). */
export function toggleBoot(order: readonly string[], dev: string): string[] {
  if (order.includes(dev)) return order.length > 1 ? order.filter((d) => d !== dev) : [...order]
  return [...order, dev]
}

/** Phrases du resume local (avant l'envoi, ou quand l'outil ne renvoie pas `changes`). */
export function describePayload(p: HardwarePayload): string[] {
  const out: string[] = []
  if (p.cpu_model !== undefined) out.push(`processeur : ${p.cpu_model}`)
  if (p.firmware !== undefined) out.push(`firmware : ${p.firmware}`)
  if (p.tpm !== undefined) out.push(`TPM ${p.tpm ? 'ajouté' : 'retiré'}`)
  if (p.secure_boot !== undefined) out.push(`secure boot ${p.secure_boot ? 'activé' : 'désactivé'}`)
  if (p.boot_order !== undefined) out.push(`démarrage : ${p.boot_order.map((d) => BOOT_LABEL[d] ?? d).join(' → ')}`)
  if (p.display !== undefined) out.push(`affichage : ${p.display}`)
  if (p.network !== undefined) out.push(`réseau : ${p.network}`)
  if (p.usb_attach !== undefined) out.push(`USB branché : ${p.usb_attach}`)
  if (p.usb_detach !== undefined) out.push(`USB débranché : ${p.usb_detach}`)
  if (p.disk_grow_gb !== undefined) out.push(`disque agrandi de ${p.disk_grow_gb} Go`)
  return out
}

/** Reponse d'une edition : ce que l'outil a vraiment change (contrat : `changes`, `needs_restart`, `hot`). */
export type EditResult = { success?: boolean; error?: string | null; needs_restart?: boolean; hot?: string[]; changes?: string[]; result?: { needs_restart?: boolean; hot?: string[]; changes?: string[] } }
export type EditSummary = { changes: string[]; needsRestart: boolean; hot: string[] }

export function summarizeEdit(res: EditResult | null | undefined, sent: HardwarePayload, localNeedsRestart: boolean): EditSummary {
  const r = res?.result ?? res ?? {}
  const changes = Array.isArray(r.changes) && r.changes.length ? r.changes.map(String) : describePayload(sent)
  return { changes, needsRestart: typeof r.needs_restart === 'boolean' ? r.needs_restart : localNeedsRestart, hot: Array.isArray(r.hot) ? r.hot.map(String) : [] }
}

/** Capacite totale des disques connus, pour afficher « taille actuelle ». */
export const totalCapacity = (disks: HardwareDisk[]): number | null => {
  const known = disks.map((d) => d.capacity_gb).filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  return known.length ? known.reduce((s, x) => s + x, 0) : null
}
