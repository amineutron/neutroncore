import { describe, expect, it } from 'vitest'
import { REFUSED_AT_OPEN, closeReason, normalizeState, resizeMessage, scaleFor, viewVerdict, wsUrl, type ViewRes } from './vmView'

const view = (o: Partial<ViewRes> = {}): ViewRes => ({ success: true, state: 'running', display: 'vnc', vnc: { host: '127.0.0.1', port: 5900 }, serial: true, reason: '', ...o })

describe('wsUrl : adresse du flux derivee de celle des appels HTTP', () => {
  it('http -> ws, chemin de l\'API a la racine, jeton dans l\'adresse', () => {
    expect(wsUrl('http://hote-tailnet:9876', 'tp-linux-01', 'vnc', 'abc')).toBe('ws://hote-tailnet:9876/vms-console/tp-linux-01/vnc?token=abc')
  })
  it('https -> wss', () => {
    expect(wsUrl('https://hub.exemple', 'vm', 'serial', 't')).toBe('wss://hub.exemple/vms-console/vm/serial?token=t')
  })
  it('la page servie sous /app/ ne change pas le chemin de l\'API (appels absolus)', () => {
    expect(wsUrl('http://hote:9876/app/', 'vm', 'vnc', 't')).toBe('ws://hote:9876/vms-console/vm/vnc?token=t')
    expect(wsUrl('http://hote:9876/app/index.html?screen=vms', 'vm', 'vnc', 't')).toBe('ws://hote:9876/vms-console/vm/vnc?token=t')
  })
  it('nom de machine et jeton encodes', () => {
    expect(wsUrl('http://h', 'a b/c', 'vnc', 'x&y=z')).toBe('ws://h/vms-console/a%20b%2Fc/vnc?token=x%26y%3Dz')
  })
  it('une base sans schema reconnaissable est gardee telle quelle, barre finale retiree', () => {
    expect(wsUrl('ws://deja/', 'vm', 'vnc', 't')).toBe('ws://deja/vms-console/vm/vnc?token=t')
  })
})

describe('viewVerdict : ce que l\'onglet ecran montre', () => {
  it('sans reponse : lecture en cours, aucune action', () => {
    expect(viewVerdict(null, 'running')).toMatchObject({ kind: 'loading', action: null })
  })
  it('spice + machine en marche : bouton « passer en VNC » grise avec la raison', () => {
    const v = viewVerdict(view({ display: 'spice', vnc: null }), 'running')
    expect(v).toMatchObject({ kind: 'spice', action: 'to-vnc', actionLabel: 'passer en VNC', actionOk: false })
    expect(v.actionReason).toMatch(/arrête la machine/)
  })
  it('spice + machine arretee : bouton actif (l\'affichage decide avant l\'etat)', () => {
    expect(viewVerdict(view({ display: 'spice', vnc: null, state: 'stopped' }), 'stopped')).toMatchObject({ kind: 'spice', action: 'to-vnc', actionOk: true, actionReason: '' })
  })
  it('aucun affichage : « ajouter un affichage VNC », meme regle', () => {
    expect(viewVerdict(view({ display: 'none', vnc: null }), 'stopped')).toMatchObject({ kind: 'none', action: 'add-vnc', actionOk: true })
    expect(viewVerdict(view({ display: 'none', vnc: null }), 'running')).toMatchObject({ kind: 'none', action: 'add-vnc', actionOk: false })
  })
  it('vnc + eteinte : « démarre-la pour la voir », sans action', () => {
    const v = viewVerdict(view({ state: 'stopped', vnc: null }), 'stopped')
    expect(v).toMatchObject({ kind: 'off', action: null })
    expect(v.text).toMatch(/démarre-la/)
  })
  it('vnc + en pause : image figee', () => {
    expect(viewVerdict(view(), 'paused')).toMatchObject({ kind: 'paused', action: null })
  })
  it('vnc + en marche : « se connecter », jamais de connexion automatique', () => {
    expect(viewVerdict(view(), 'running')).toMatchObject({ kind: 'vnc', action: 'connect', actionLabel: 'se connecter', actionOk: true })
  })
  it('vnc annonce mais port introuvable : indisponible avec la raison de l\'API', () => {
    const v = viewVerdict(view({ vnc: null, reason: 'port vnc non lu' }), 'running')
    expect(v).toMatchObject({ kind: 'unavailable', action: null })
    expect(v.text).toBe('port vnc non lu')
  })
  it('l\'etat du hub l\'emporte sur celui de la reponse ; sans etat du hub on lit la reponse', () => {
    expect(viewVerdict(view({ state: 'running' }), 'stopped').kind).toBe('off')
    expect(viewVerdict(view({ state: 'stopped', vnc: null }), '').kind).toBe('off')
  })
})

describe('scaleFor : l\'ecran distant tient dans son cadre', () => {
  it('reduit en gardant les proportions', () => {
    expect(scaleFor({ w: 800, h: 600 }, { w: 1600, h: 900 })).toEqual({ scale: 0.5, w: 800, h: 450 })
    expect(scaleFor({ w: 800, h: 300 }, { w: 1600, h: 900 })).toEqual({ scale: 1 / 3, w: 533, h: 300 })
  })
  it('ne grossit pas par defaut, grossit en plein ecran', () => {
    expect(scaleFor({ w: 1920, h: 1080 }, { w: 800, h: 600 })).toEqual({ scale: 1, w: 800, h: 600 })
    expect(scaleFor({ w: 1920, h: 1080 }, { w: 800, h: 600 }, true)).toEqual({ scale: 1.8, w: 1440, h: 1080 })
  })
  it('taille nulle : rien a dessiner, echelle 1', () => {
    expect(scaleFor({ w: 0, h: 0 }, { w: 800, h: 600 })).toEqual({ scale: 1, w: 0, h: 0 })
    expect(scaleFor({ w: 800, h: 600 }, { w: 0, h: 0 })).toEqual({ scale: 1, w: 0, h: 0 })
  })
})

describe('fermetures et messages', () => {
  it('codes du pont traduits (4401, 4404, 4409, 4503, 1009, 1000)', () => {
    expect(closeReason(4401)).toMatch(/jeton/)
    expect(closeReason(4404)).toMatch(/inconnue/)
    expect(closeReason(4409)).toMatch(/déjà ouverte/)
    expect(closeReason(4503)).toMatch(/éteinte/)
    expect(closeReason(1009)).toMatch(/trame/)
    expect(closeReason(1000)).toMatch(/inactivité/)
    expect(closeReason(4402)).toBe('connexion refusée (4402)')
  })
  it('un flux jamais ouvert (jeton refuse avant accept : error puis 1006) = refus a l\'ouverture, quel que soit le code', () => {
    expect(closeReason(1006, false, false)).toBe(REFUSED_AT_OPEN)
    expect(closeReason(1006, false, false)).toMatch(/jeton refusé ou expiré/)
    expect(closeReason(1006, false, true)).toBe('connexion perdue')
  })
  it('sans code : propre ou brutale', () => {
    expect(closeReason(null, true)).toBe('déconnecté')
    expect(closeReason(undefined, false)).toBe('connexion perdue')
  })
  it('etat brut de l\'API : « shut off » = eteinte', () => {
    expect(normalizeState('shut off')).toBe('stopped')
    expect(normalizeState('running')).toBe('running')
    expect(normalizeState('paused')).toBe('paused')
    expect(normalizeState('crashed')).toBe('crashed')
    expect(viewVerdict(view({ state: 'shut off', vnc: null }), '').kind).toBe('off')
    expect(viewVerdict(view({ state: 'running' }), 'shut off').kind).toBe('off')
  })
  it('resize : texte JSON, entiers >= 1', () => {
    expect(resizeMessage(80.7, 24)).toBe('{"resize":[80,24]}')
    expect(resizeMessage(0, -3)).toBe('{"resize":[1,1]}')
  })
})
