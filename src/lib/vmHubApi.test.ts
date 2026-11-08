import { beforeEach, describe, expect, it, vi } from 'vitest'

// Chaque ecriture du hub doit demander son jeton sur /vms-console/token avec l'action ET la cible attendues
// (le backend refuse tout le reste : « Action inconnue »), puis envoyer ce jeton en X-Confirm.
const calls: { verb: string; path: string; body?: unknown; extra?: Record<string, string> }[] = []
vi.mock('./api', () => ({
  apiGet: vi.fn(async (path: string) => { calls.push({ verb: 'GET', path }); return { token: 'jeton-test' } }),
  apiPost: vi.fn(async (path: string, body?: unknown, extra?: Record<string, string>) => { calls.push({ verb: 'POST', path, body, extra }); return { success: true, error: null } }),
  apiPut: vi.fn(async (path: string, body: unknown) => { calls.push({ verb: 'PUT', path, body }); return { success: true } }),
  apiDelete: vi.fn(),
  withConfirm: vi.fn(async () => { throw new Error('withConfirm ne doit pas etre utilise : /auth/token refuse ces actions') }),
}))

const { cloneVm, deployImage, importArchive, saveMeta, setTemplate } = await import('./vmHubApi')

beforeEach(() => { calls.length = 0 })

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
