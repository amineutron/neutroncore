import { describe, expect, it } from 'vitest'
import { stepLabel, durationText, fallbackTitle, filterTasks, kindOfJob, progressOf, runningFor, sortTasks, stateOf, titleOf, type TaskJob } from './vmTasks'

const job = (id: string, o: Partial<TaskJob> = {}): TaskJob => ({
  id, action: 'export', vm: 'x', status: 'ok', message: null, error: null, started: 100, ended: 130, ...o,
})

describe('nom des taches', () => {
  it('le titre de l\'API prime', () => { expect(titleOf(job('a', { title: 'Export de x · mode examen' }))).toBe('Export de x · mode examen') })
  it('un titre vide retombe sur le repli', () => { expect(titleOf(job('a', { title: '  ' }))).toBe('Export de x') })
  it.each([
    ['snapshot_create', 'Snapshot de x'], ['snapshot_restore', 'Restauration d\'un snapshot sur x'], ['clone', 'Clonage de x'],
    ['import', 'Import de x'], ['destroy', 'Suppression de x'], ['edit', 'Modification de x'], ['exec', 'Commande sur x'],
  ])('%s -> %s', (action, t) => { expect(fallbackTitle({ action, vm: 'x' })).toBe(t) })
  it('action inconnue : lisible quand meme', () => { expect(fallbackTitle({ action: 'zzz', vm: 'x' })).toBe('zzz : x') })
  it('type de tache', () => {
    expect(kindOfJob({ action: 'snapshot_restore' })).toBe('snapshot')
    expect(kindOfJob({ action: 'clone', kind: 'clone' })).toBe('clone')
  })
})

describe('etat et avancement', () => {
  it('statuts de l\'API', () => {
    expect(stateOf({ status: 'running' })).toBe('run')
    expect(stateOf({ status: 'ok' })).toBe('ok')
    expect(stateOf({ status: 'fail' })).toBe('error')
  })
  it('sans etapes connues : indetermine tant que ca tourne', () => {
    expect(progressOf({ status: 'running' })).toBeNull()
    expect(progressOf({ status: 'running', steps: [] })).toBeNull()
  })
  it('etapes terminees + moitie de l\'etape en cours, jamais 100 tant que ca tourne', () => {
    const s = (st: 'done' | 'run' | 'wait') => ({ n: 'e', st })
    expect(progressOf({ status: 'running', steps: [s('done'), s('run'), s('wait'), s('wait')] })).toBe(38)
    expect(progressOf({ status: 'running', steps: [s('done'), s('done')] })).toBe(99)
  })
  it('terminee ou echouee : 100', () => {
    expect(progressOf({ status: 'ok' })).toBe(100)
    expect(progressOf({ status: 'fail' })).toBe(100)
  })
  it('duree lisible', () => {
    expect(durationText({ started: 100, ended: 100.2 })).toBe('< 1 s')
    expect(durationText({ started: 100, ended: 130 })).toBe('30 s')
    expect(durationText({ started: 100, ended: 225 })).toBe('2 min 5 s')
    expect(durationText({ started: 100, ended: null }, 112)).toBe('12 s')
  })
})

describe('liste', () => {
  const jobs = [job('a', { started: 1 }), job('b', { status: 'running', started: 2 }), job('c', { status: 'fail', started: 3 }), job('d', { status: 'running', started: 0 })]
  it('filtres', () => {
    expect(filterTasks(jobs, 'toutes')).toHaveLength(4)
    expect(filterTasks(jobs, 'en cours').map((j) => j.id)).toEqual(['b', 'd'])
    expect(filterTasks(jobs, 'terminées').map((j) => j.id)).toEqual(['a'])
    expect(filterTasks(jobs, 'échouées').map((j) => j.id)).toEqual(['c'])
  })
  it('en cours d\'abord, puis les plus recentes ; l\'entree n\'est pas modifiee', () => {
    const copy = [...jobs]
    expect(sortTasks(jobs).map((j) => j.id)).toEqual(['b', 'd', 'c', 'a'])
    expect(jobs).toEqual(copy)
  })
  it('machine occupee', () => {
    expect(runningFor([job('a', { status: 'running', vm: 'y' })], 'y')?.id).toBe('a')
    expect(runningFor([job('a', { status: 'ok', vm: 'y' })], 'y')).toBeUndefined()
  })
})

describe('etapes', () => {
  it('un numero (backend qui ne nomme pas ses etapes) devient « etape n », un nom reste tel quel', () => {
    expect(stepLabel(3)).toBe('étape 3')
    expect(stepLabel('archivage tar.gz')).toBe('archivage tar.gz')
  })
})
