import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOAST_MS, answerDialog, ask, confirmDialog, currentDialog, getToasts, subscribeDialogs, toast } from './dialog'

afterEach(() => {
  for (let d = currentDialog(); d; d = currentDialog()) answerDialog(d.id, { ok: false, checked: false })
  vi.useRealTimers()
})

describe('ask', () => {
  it('résout avec la réponse donnée et vide la file', async () => {
    const p = ask({ title: 'supprimer ?', check: 'aussi les fichiers' })
    const d = currentDialog()!
    expect(d.title).toBe('supprimer ?')
    answerDialog(d.id, { ok: true, checked: true })
    await expect(p).resolves.toEqual({ ok: true, checked: true })
    expect(currentDialog()).toBeNull()
  })

  it('affiche une question à la fois, dans l’ordre des demandes', async () => {
    const a = confirmDialog({ title: 'a' })
    const b = confirmDialog({ title: 'b' })
    expect(currentDialog()!.title).toBe('a')
    answerDialog(currentDialog()!.id, { ok: false, checked: false })
    expect(currentDialog()!.title).toBe('b')
    answerDialog(currentDialog()!.id, { ok: true, checked: false })
    await expect(a).resolves.toBe(false)
    await expect(b).resolves.toBe(true)
  })

  it('n’empile pas deux fois la même question (double clic)', async () => {
    const first = confirmDialog({ title: 'supprimer ?', body: 'film' })
    await expect(confirmDialog({ title: 'supprimer ?', body: 'film' })).resolves.toBe(false)
    answerDialog(currentDialog()!.id, { ok: true, checked: false })
    await expect(first).resolves.toBe(true)
    expect(currentDialog()).toBeNull()
  })

  it('ignore une réponse à un dialogue déjà fermé', () => {
    void ask({ title: 'x' })
    const id = currentDialog()!.id
    answerDialog(id, { ok: true, checked: false })
    expect(() => answerDialog(id, { ok: true, checked: false })).not.toThrow()
  })

  it('prévient les abonnés à l’ouverture et à la fermeture', () => {
    const fn = vi.fn()
    const off = subscribeDialogs(fn)
    void ask({ title: 'x' })
    answerDialog(currentDialog()!.id, { ok: false, checked: false })
    off()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('toast', () => {
  it('disparaît seul, deux fois plus tard pour une erreur', () => {
    vi.useFakeTimers()
    toast('fait')
    toast('raté', 'crit')
    expect(getToasts().map((t) => t.text)).toEqual(['fait', 'raté'])
    vi.advanceTimersByTime(TOAST_MS)
    expect(getToasts().map((t) => t.text)).toEqual(['raté'])
    vi.advanceTimersByTime(TOAST_MS)
    expect(getToasts()).toEqual([])
  })
})
