import { describe, expect, it } from 'vitest'
import { BOOT_LABEL, CPU_MODEL_IDS, choiceHint, choiceLabel, describePayload, diffHardware, draftFromHardware, knownCpu, moveBoot, optionIds, stopFields, summarizeEdit, summarizeJob, toggleBoot, totalCapacity, validateHardware, type Hardware, type HardwareDraft } from './vmHardware'

const HW: Hardware = {
  cpu_model: 'host-passthrough', firmware: 'bios', secure_boot: false, tpm: false, boot_order: ['hd', 'cdrom'],
  display: 'spice', network: 'default', disks: [{ target: 'vda', path: '/var/lib/libvirt/images/x.qcow2', capacity_gb: 40 }], usb: [],
}
const base: HardwareDraft = draftFromHardware(HW)

describe('draftFromHardware', () => {
  it('reprend l\'etat reel', () => {
    expect(base).toEqual({ cpu_model: 'host-passthrough', firmware: 'bios', tpm: false, secure_boot: false, boot_order: ['hd', 'cdrom'], display: 'spice', network: 'default', usb_attach: '', usb_detach: '', disk_grow_gb: '' })
  })
  it('etat absent ou abime : valeurs neutres, ordre jamais vide, doublons retires', () => {
    expect(draftFromHardware(null)).toMatchObject({ cpu_model: '', firmware: 'bios', boot_order: ['hd'], display: 'spice', network: '' })
    expect(draftFromHardware({ ...HW, boot_order: ['hd', 'hd', 'floppy'], display: 'none' }).boot_order).toEqual(['hd'])
    expect(draftFromHardware({ ...HW, display: 'none' }).display).toBe('spice')
  })
})

describe('diffHardware', () => {
  it('rien de change : charge utile vide', () => expect(diffHardware(base, { ...base })).toEqual({}))
  it('seuls les champs modifies', () => {
    expect(diffHardware(base, { ...base, cpu_model: 'qemu64', display: 'vnc' })).toEqual({ cpu_model: 'qemu64', display: 'vnc' })
  })
  it('ordre de demarrage compare element par element', () => {
    expect(diffHardware(base, { ...base, boot_order: ['cdrom', 'hd'] })).toEqual({ boot_order: ['cdrom', 'hd'] })
    expect(diffHardware(base, { ...base, boot_order: ['hd', 'cdrom'] })).toEqual({})
  })
  it('secure boot active emporte le firmware uefi dans le meme envoi', () => {
    expect(diffHardware(base, { ...base, secure_boot: true })).toEqual({ secure_boot: true, firmware: 'uefi' })
    const uefi = draftFromHardware({ ...HW, firmware: 'uefi' })
    expect(diffHardware(uefi, { ...uefi, secure_boot: true })).toEqual({ secure_boot: true, firmware: 'uefi' })
    expect(diffHardware(base, { ...base, secure_boot: false })).toEqual({})
  })
  it('usb et agrandissement : seulement si saisis, usb en minuscules, reseau sans espaces', () => {
    expect(diffHardware(base, { ...base, usb_attach: ' 046D:C52B ', disk_grow_gb: '10', network: ' default ' })).toEqual({ usb_attach: '046d:c52b', disk_grow_gb: 10 })
    expect(diffHardware(base, { ...base, network: 'isole' })).toEqual({ network: 'isole' })
  })
  it('agrandissement : seuls les chiffres comptent (« 1e3 », « 0x10 », « 10.5 » donnent NaN, refuse ensuite)', () => {
    for (const t of ['1e3', '0x10', '10.5', ' 12 ', '-5']) {
      const p = diffHardware(base, { ...base, disk_grow_gb: t })
      if (t.trim() === '12') expect(p.disk_grow_gb).toBe(12)
      else { expect(Number.isNaN(p.disk_grow_gb)).toBe(true); expect(validateHardware(p, 'stopped').ok).toBe(false) }
    }
  })
  it('ne modifie pas ses entrees', () => {
    const d = { ...base, boot_order: ['cdrom', 'hd'] }
    const p = diffHardware(base, d)
    p.boot_order!.push('network')
    expect(d.boot_order).toEqual(['cdrom', 'hd'])
  })
})

describe('validateHardware', () => {
  const stop = ['vcpus', 'memory_mib', 'cpu_model', 'firmware', 'tpm', 'secure_boot', 'disk_grow_gb']
  it('vide : refuse', () => expect(validateHardware({}, 'stopped')).toEqual({ ok: false, reason: 'aucun changement à appliquer' }))
  it('valide sur une machine arretee', () => {
    expect(validateHardware({ cpu_model: 'x86-64-v2', firmware: 'uefi', secure_boot: true, tpm: true, boot_order: ['cdrom', 'hd'], display: 'vnc', network: 'default', usb_attach: '046d:c52b', disk_grow_gb: 20 }, 'stopped', { needsStop: stop })).toEqual({ ok: true })
  })
  it.each([
    [{ cpu_model: 'pentium' }, /inconnu/],
    [{ firmware: 'efi' as 'uefi' }, /bios ou uefi/],
    [{ display: 'sdl' as 'vnc' }, /spice ou vnc/],
    [{ secure_boot: true }, /uefi/],
    [{ secure_boot: true, firmware: 'bios' as const }, /uefi/],
    [{ boot_order: [] }, /vide/],
    [{ boot_order: ['hd', 'usb'] }, /inconnu/],
    [{ boot_order: ['hd', 'hd'] }, /deux fois/],
    [{ network: 'mon reseau' }, /lettres, chiffres/],
    [{ network: '' }, /réseau vide/],
    [{ usb_attach: '46d:c52b' }, /vvvv:pppp/],
    [{ usb_detach: 'zzzz:0001' }, /vvvv:pppp/],
    [{ usb_attach: '046d:c52b', usb_detach: '046d:c52b' }, /même périphérique/],
    [{ disk_grow_gb: 0 }, /entre 1 et 2048/],
    [{ disk_grow_gb: 2.5 }, /entier/],
    [{ disk_grow_gb: 5000 }, /2048/],
  ])('refuse %j', (p, rx) => {
    const v = validateHardware(p, 'stopped')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toMatch(rx)
  })
  it('bornes d\'agrandissement de l\'API', () => {
    expect(validateHardware({ disk_grow_gb: 100 }, 'stopped', { grow: [1, 50] })).toMatchObject({ ok: false })
    expect(validateHardware({ disk_grow_gb: 50 }, 'stopped', { grow: [1, 50] })).toEqual({ ok: true })
  })
  it('machine en marche : seuls les champs a chaud passent, les autres nomment ce qui bloque', () => {
    expect(validateHardware({ boot_order: ['cdrom', 'hd'], usb_attach: '046d:c52b', network: 'default', display: 'vnc' }, 'running', { needsStop: stop })).toEqual({ ok: true })
    const v = validateHardware({ cpu_model: 'qemu64', tpm: true }, 'running', { needsStop: stop })
    expect(v).toEqual({ ok: false, reason: 'arrête la machine pour changer : modèle de processeur, TPM' })
    expect(validateHardware({ cpu_model: 'qemu64' }, 'paused', { needsStop: stop }).ok).toBe(false)
  })
  it('les listes de choix de l\'API font foi, repli sur les constantes', () => {
    const choices = { cpu_models: [{ id: 'EPYC-Milan', label: 'EPYC Milan', hint: '' }, { id: 'host-passthrough', label: 'hôte', hint: '' }], displays: [{ id: 'sdl', label: 'SDL', hint: '' }] }
    expect(validateHardware({ cpu_model: 'EPYC-Milan' }, 'stopped', { choices }).ok).toBe(true)
    expect(validateHardware({ cpu_model: 'qemu64' }, 'stopped', { choices }).ok).toBe(false)
    expect(validateHardware({ display: 'sdl' as 'vnc' }, 'stopped', { choices })).toEqual({ ok: true })
    expect(validateHardware({ display: 'vnc' }, 'stopped', { choices }).ok).toBe(false)
    expect(validateHardware({ firmware: 'uefi' }, 'stopped', { choices })).toEqual({ ok: true })   // liste absente : constante
    expect(optionIds(undefined, CPU_MODEL_IDS)).toBe(CPU_MODEL_IDS)
    expect(optionIds([], CPU_MODEL_IDS)).toBe(CPU_MODEL_IDS)
    expect(optionIds(choices.cpu_models, CPU_MODEL_IDS)).toEqual(['EPYC-Milan', 'host-passthrough'])
  })
  it('knownCpu : hors liste ou absent = aucun segment actif', () => {
    expect(knownCpu('host-model')).toBe('host-model')
    expect(knownCpu('EPYC-Milan')).toBeNull()
    expect(knownCpu('Skylake-Client')).toBeNull()
    expect(knownCpu(null)).toBeNull()
    expect(knownCpu('')).toBeNull()
    expect(knownCpu('EPYC-Milan', ['EPYC-Milan'])).toBe('EPYC-Milan')
  })
  it('la liste needs_stop de l\'API fait foi (champ a chaud declare par elle)', () => {
    expect(validateHardware({ tpm: true }, 'running', { needsStop: ['cpu_model'] })).toEqual({ ok: true })
    expect(stopFields({ tpm: true, display: 'vnc' })).toEqual(['tpm'])
  })
})

describe('ordre de demarrage', () => {
  it('monter et descendre', () => {
    expect(moveBoot(['hd', 'cdrom', 'network'], 1, -1)).toEqual(['cdrom', 'hd', 'network'])
    expect(moveBoot(['hd', 'cdrom', 'network'], 1, 1)).toEqual(['hd', 'network', 'cdrom'])
  })
  it('hors bornes : copie inchangee, entree intacte', () => {
    const o = ['hd', 'cdrom']
    expect(moveBoot(o, 0, -1)).toEqual(o)
    expect(moveBoot(o, 1, 1)).toEqual(o)
    expect(moveBoot(o, 5, 1)).toEqual(o)
    expect(moveBoot(o, 0, 1)).not.toBe(o)
    expect(o).toEqual(['hd', 'cdrom'])
  })
  it('toggleBoot : ajoute en fin, retire, ne vide jamais', () => {
    expect(toggleBoot(['hd'], 'network')).toEqual(['hd', 'network'])
    expect(toggleBoot(['hd', 'network'], 'hd')).toEqual(['network'])
    expect(toggleBoot(['hd'], 'hd')).toEqual(['hd'])
  })
})

describe('resume', () => {
  it('phrases locales en francais, une par champ', () => {
    const lines = describePayload({ cpu_model: 'qemu64', firmware: 'uefi', tpm: true, secure_boot: false, boot_order: ['cdrom', 'hd'], display: 'vnc', network: 'isole', usb_attach: '046d:c52b', usb_detach: '0781:5583', disk_grow_gb: 10 })
    expect(lines).toHaveLength(10)
    expect(lines).toContain('démarrage : cdrom → disque')
    expect(lines).toContain('disque agrandi de 10 Go')
  })
  it('summarizeEdit : les changements de l\'outil gagnent, repli sur les phrases locales', () => {
    expect(summarizeEdit({ success: true, changes: ['cpu: qemu64'], needs_restart: true, hot: [] }, { cpu_model: 'qemu64' }, false)).toEqual({ changes: ['cpu: qemu64'], needsRestart: true, hot: [], skipped: [], fromTool: true })
    expect(summarizeEdit({ success: true, result: { changes: ['x'], needs_restart: false, hot: ['display'], skipped: ['usb_attach'] } }, { display: 'vnc' }, true)).toEqual({ changes: ['x'], needsRestart: false, hot: ['display'], skipped: ['usb_attach'], fromTool: true })
    expect(summarizeEdit({ success: true, job: 'abc' }, { display: 'vnc' }, true)).toEqual({ changes: ['affichage : vnc'], needsRestart: true, hot: [], skipped: [], fromTool: false })
    expect(summarizeEdit(null, {}, false)).toEqual({ changes: [], needsRestart: false, hot: [], skipped: [], fromTool: false })
  })
  it('summarizeJob : rien tant que le travail court ou sans resultat, puis le resultat de l\'outil', () => {
    expect(summarizeJob(undefined, { display: 'vnc' }, false)).toBeNull()
    expect(summarizeJob({ status: 'running', result: { changes: ['x'] } }, { display: 'vnc' }, false)).toBeNull()
    expect(summarizeJob({ status: 'ok' }, { display: 'vnc' }, false)).toBeNull()
    expect(summarizeJob({ status: 'ok', result: { changes: ['affichage spice → vnc'], needs_restart: false, hot: ['display'], skipped: [] } }, { display: 'vnc' }, true))
      .toEqual({ changes: ['affichage spice → vnc'], needsRestart: false, hot: ['display'], skipped: [], fromTool: true })
  })
  it('choix libelles : label affiche, id envoye, repli local puis identifiant', () => {
    const boot = [{ id: 'hd', label: 'disque dur', hint: 'le système' }, { id: 'cdrom', label: 'lecteur', hint: '' }]
    expect(choiceLabel(boot, 'hd')).toBe('disque dur')
    expect(choiceLabel(undefined, 'hd', BOOT_LABEL)).toBe('disque')
    expect(choiceLabel(undefined, 'floppy')).toBe('floppy')
    expect(choiceHint(boot, 'hd')).toBe('le système')
    expect(choiceHint(boot, 'network')).toBe('')
  })
  it('capacite totale des disques connus', () => {
    expect(totalCapacity([{ target: 'vda', path: '', capacity_gb: 40 }, { target: 'vdb', path: '', capacity_gb: 10 }])).toBe(50)
    expect(totalCapacity([{ target: 'vda', path: '', capacity_gb: null }])).toBeNull()
    expect(totalCapacity([])).toBeNull()
  })
})
