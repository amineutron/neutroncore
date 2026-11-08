import { beforeEach, describe, expect, it, vi } from 'vitest'

// Chaque ecriture du hub doit demander son jeton sur /vms-console/token avec l'action ET la cible attendues
// (le backend refuse tout le reste : « Action inconnue »), puis envoyer ce jeton en X-Confirm.
const calls: { verb: string; path: string; body?: unknown; extra?: Record<string, string> }[] = []
vi.mock('./api', () => ({
  apiGet: vi.fn(async (path: string) => { calls.push({ verb: 'GET', path }); return { token: 'jeton-test' } }),
  apiPost: vi.fn(async (path: string, body?: unknown, extra?: Record<string, string>) => { calls.push({ verb: 'POST', path, body, extra }); return { success: true, error: null } }),
  apiPut: vi.fn(async (path: string, body: unknown) => { calls.push({ verb: 'PUT', path, body }); return { success: true } }),
  apiDelete: vi.fn(),
  // /auth/token ne sert qu'a l'alimentation (vm_<action>_<vm>) ; les ecritures de la console passent par /vms-console/token
  withConfirm: vi.fn(async (action: string) => { calls.push({ verb: 'AUTH', path: action }); return { 'X-Confirm': 'jeton-auth' } }),
}))

const { addVncDisplay, cloneVm, deployImage, editHardware, fetchView, importArchive, powerVm, saveMeta, setTemplate, viewToken } = await import('./vmHubApi')

beforeEach(() => { calls.length = 0 })

describe('alimentation : pause, reprise, redemarrage', () => {
  it.each(['start', 'stop', 'force_stop', 'pause', 'resume', 'reboot'] as const)('%s : jeton vm_%s_<vm> sur /auth/token puis POST /services/vms/<vm>/%s', async (a) => {
    await powerVm('kali-pentest', a)
    expect(calls).toEqual([
      { verb: 'AUTH', path: `vm_${a}_kali-pentest` },
      { verb: 'POST', path: `/services/vms/kali-pentest/${a}`, body: undefined, extra: { 'X-Confirm': 'jeton-auth' } },
    ])
  })
  it('un refus du backend devient une erreur lisible', async () => {
    const { apiPost } = await import('./api')
    ;(apiPost as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false, error: 'machine introuvable' })
    await expect(powerVm('x', 'pause')).rejects.toThrow('machine introuvable')
  })
})

describe('edition materielle', () => {
  it('jeton vm_edit_<vm> sur /vms-console/token, corps = seulement les champs envoyes', async () => {
    const res = await editHardware('debian-sandbox', { cpu_model: 'qemu64', boot_order: ['cdrom', 'hd'] })
    expect(calls[0]).toMatchObject({ verb: 'GET', path: '/vms-console/token?action=vm_edit_debian-sandbox' })
    expect(calls[1]).toEqual({ verb: 'POST', path: '/vms-console/debian-sandbox/edit', body: { cpu_model: 'qemu64', boot_order: ['cdrom', 'hd'] }, extra: { 'X-Confirm': 'jeton-test' } })
    expect(calls.some((c) => c.verb === 'AUTH')).toBe(false)
    expect(res).toEqual({ success: true, error: null })
  })
  it('un echec declare par l\'API est leve', async () => {
    const { apiPost } = await import('./api')
    ;(apiPost as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false, error: 'secure boot sans uefi' })
    await expect(editHardware('x', { secure_boot: true })).rejects.toThrow('secure boot sans uefi')
  })
})

describe('jetons des ecritures du hub', () => {
  it('modele : vm_template_<vm>', async () => {
    await setTemplate('debian-sandbox', true)
    expect(calls[0]).toMatchObject({ verb: 'GET', path: '/vms-console/token?action=vm_template_debian-sandbox' })
    expect(calls[1]).toMatchObject({ verb: 'POST', path: '/vms-console/debian-sandbox/template', body: { template: true }, extra: { 'X-Confirm': 'jeton-test' } })
  })
  it('clone : vm_clone_<source>, la cible du jeton est la source', async () => {
    await cloneVm('tpl', { new_name: 'tp-03', linked: true, network: 'default', autostart: false })
    expect(calls[0].path).toBe('/vms-console/token?action=vm_clone_tpl')
    expect(calls[1]).toMatchObject({ path: '/vms-console/tpl/clone', extra: { 'X-Confirm': 'jeton-test' }, body: { new_name: 'tp-03', linked: true } })
  })
  it('import : vm_import_<nouveau nom>', async () => {
    await importArchive('x-export-20261024-091500-exam.tar.gz', 'x-import')
    expect(calls[0].path).toBe('/vms-console/token?action=vm_import_x-import')
    expect(calls[1]).toMatchObject({ path: '/vms-console/import', body: { archive: 'x-export-20261024-091500-exam.tar.gz', new_name: 'x-import', dry_run: false } })
  })
  it('deploiement : vm_deploy_<nom>', async () => {
    await deployImage({ image: 'alpine', name: 'a1', vcpus: 2, ram_mb: 512, disk_gb: 4, network: 'default', profile: 'normal', env: null })
    expect(calls[0].path).toBe('/vms-console/token?action=vm_deploy_a1')
    expect(calls[1]).toMatchObject({ path: '/vms-console/deploy', extra: { 'X-Confirm': 'jeton-test' } })
  })
  it('un nom de machine avec caracteres speciaux est encode dans l\'URL', async () => {
    await cloneVm('a b/c', { new_name: 'z', linked: false, network: 'default', autostart: false })
    expect(calls[1].path).toBe('/vms-console/a%20b%2Fc/clone')
  })
  it('fiche : profil et notes, sans jeton (non destructif)', async () => {
    await saveMeta('x', { profile: 'examen', notes: 'n' })
    expect(calls).toEqual([{ verb: 'PUT', path: '/vms-console/meta/x', body: { profile: 'examen', notes: 'n' } }])
  })
})

describe('ecran et console serie', () => {
  it('viewToken demande vm_view_<vm> sur /vms-console/token et rend la chaine (elle va dans l\'adresse du WebSocket)', async () => {
    const t = await viewToken('tp-linux 01')
    expect(calls).toEqual([{ verb: 'GET', path: '/vms-console/token?action=vm_view_tp-linux%2001' }])
    expect(t).toBe('jeton-test')
  })
  it('fetchView lit GET /vms-console/<vm>/view sans jeton', async () => {
    await fetchView('a/b')
    expect(calls).toEqual([{ verb: 'GET', path: '/vms-console/a%2Fb/view' }])
  })
  it('addVncDisplay = edition materielle { display: vnc } avec le jeton vm_edit_<vm>', async () => {
    await addVncDisplay('debian-sandbox')
    expect(calls[0].path).toBe('/vms-console/token?action=vm_edit_debian-sandbox')
    expect(calls[1]).toMatchObject({ verb: 'POST', path: '/vms-console/debian-sandbox/edit', body: { display: 'vnc' }, extra: { 'X-Confirm': 'jeton-test' } })
  })
})
