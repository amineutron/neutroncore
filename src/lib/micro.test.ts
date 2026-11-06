import { describe, expect, it } from 'vitest'
import { capability, cleanTranscript, MAX_TEXT, micError, pickMime, sendable, tooShort } from './micro'

describe('pickMime', () => {
  it('prend le premier format supporte', () => {
    expect(pickMime((m) => m === 'audio/webm')).toBe('audio/webm')
    expect(pickMime((m) => m === 'audio/mp4')).toBe('audio/mp4')   // Safari
    expect(pickMime(() => true)).toBe('audio/webm;codecs=opus')
  })
  it('rend vide si rien n est supporte ou si le test plante', () => {
    expect(pickMime(() => false)).toBe('')
    expect(pickMime(() => { throw new Error('x') })).toBe('')
  })
})

describe('capability', () => {
  const ok = { isSecureContext: true, hasGetUserMedia: true, hasRecorder: true }
  it('accepte un contexte complet', () => expect(capability(ok).ok).toBe(true))
  it.each([
    [{ ...ok, isSecureContext: false }, 'http'],
    [{ ...ok, hasGetUserMedia: false }, 'accès au micro'],
    [{ ...ok, hasRecorder: false }, 'enregistrer'],
  ])('refuse avec une raison lisible', (env, mot) => {
    const c = capability(env)
    expect(c.ok).toBe(false)
    if (!c.ok) expect(c.reason).toContain(mot)
  })
})

describe('micError', () => {
  it.each([
    ['NotAllowedError', 'refusé'],
    ['NotFoundError', 'aucun micro'],
    ['NotReadableError', 'autre application'],
    ['Inconnue', 'impossible'],
    [undefined, 'impossible'],
  ])('%s', (name, mot) => expect(micError(name)).toContain(mot))
})

describe('cleanTranscript / sendable', () => {
  it('nettoie et borne', () => {
    expect(cleanTranscript('  allume \n la   télé ')).toBe('allume la télé')
    expect(cleanTranscript('a'.repeat(MAX_TEXT + 50))).toHaveLength(MAX_TEXT)
  })
  it.each([
    ['allume la télé', true],
    ['   ', false],
    ['/mode performance', false],
  ])('sendable(%j)', (t, ok) => expect(sendable(t).ok).toBe(ok))
  it('appui trop court', () => {
    expect(tooShort(120)).toBe(true)
    expect(tooShort(900)).toBe(false)
  })
})
