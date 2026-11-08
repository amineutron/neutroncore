// Demo de l'ecran et de la console serie : aucun WebSocket. L'ecran est une toile animee (« démo : flux simulé »,
// horloge qui bouge) ; le terminal rend une invite `demo login:` et fait l'echo de ce qu'on tape.
import { throwIfAborted, type ScreenSource, type SerialSource } from '../lib/vmViewSources'

const W = 1024
const H = 640

function drawFrame(ctx: CanvasRenderingContext2D, t0: number, vm: string, now: number, typed: string): void {
  const t = (now - t0) / 1000
  ctx.fillStyle = '#10141c'
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W * 0.5 + Math.sin(t / 3) * 120, H * 0.45, 40, W * 0.5, H * 0.5, W * 0.7)
  g.addColorStop(0, '#2a3a5a'); g.addColorStop(1, '#10141c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // barre du haut du « bureau »
  ctx.fillStyle = '#0b0e14'
  ctx.fillRect(0, 0, W, 34)
  ctx.fillStyle = '#c9d2e3'
  ctx.font = '600 16px JBM, monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${vm} — démo : flux simulé`, 16, 17)
  const d = new Date(now)
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0'), ss = String(d.getSeconds()).padStart(2, '0')
  const clock = `${hh}:${mm}:${ss}`
  ctx.textAlign = 'right'
  ctx.fillText(clock, W - 16, 17)
  ctx.textAlign = 'left'
  // une fenetre de terminal qui defile
  ctx.fillStyle = 'rgba(5,7,12,.85)'
  ctx.fillRect(80, 90, 620, 380)
  ctx.fillStyle = '#82d69c'
  ctx.font = '15px JBM, monospace'
  const lines = Math.floor(t * 2) % 14
  for (let i = 0; i < lines; i++) ctx.fillText(`[${(i * 7.3 + t).toFixed(3).padStart(10)}] service ${i % 3 === 0 ? 'démarré' : 'ok'} · unité demo-${i}.service`, 96, 116 + i * 24)
  ctx.fillStyle = '#f6c177'
  ctx.fillText(`demo@${vm}:~$ ${typed}${Math.floor(t * 2) % 2 ? '█' : ' '}`, 96, 116 + lines * 24)   // ce que le clavier virtuel a tape
  // grande horloge
  ctx.fillStyle = 'rgba(246,193,119,.9)'
  ctx.font = '700 64px JBM, monospace'
  ctx.textAlign = 'right'
  ctx.fillText(clock, W - 60, H - 80)
  ctx.textAlign = 'left'
  ctx.font = '14px JBM, monospace'
  ctx.fillStyle = '#9c8ea6'
  ctx.fillText('mode démonstration : aucune machine réelle derrière cet écran', 80, H - 40)
}

export const demoScreenSource: ScreenSource = async (target, vm, h, signal) => {
  await new Promise((r) => setTimeout(r, 120))   // latence d'un jeton
  throwIfAborted(signal)
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  canvas.className = 'vh-demo-canvas'
  canvas.dataset.demo = 'ecran'
  canvas.setAttribute('aria-label', 'écran simulé')
  canvas.tabIndex = 0
  canvas.style.maxWidth = '100%'
  canvas.style.maxHeight = '100%'
  canvas.style.display = 'block'
  target.replaceChildren(canvas)
  const ctx = canvas.getContext('2d')
  const t0 = performance.now()
  let raf = 0
  let on = true
  let typed = ''   // touches recues par `key` : montrees sur l'ecran et exposees (data-typed) pour verifier le chemin du clavier
  const tick = (now: number) => { if (!on) return; if (ctx) drawFrame(ctx, t0, vm, now, typed); raf = requestAnimationFrame(tick) }
  const stop = (clean: boolean, why: string) => {
    if (!on) return
    on = false
    cancelAnimationFrame(raf)
    target.replaceChildren()
    h.onDisconnect(why, clean)
  }
  setTimeout(() => { if (on) { h.onName(`${vm} (démo)`); h.onConnect(); raf = requestAnimationFrame(tick) } }, 400)
  return {
    disconnect: () => stop(true, 'déconnecté'),
    sendCtrlAltDel: () => { /* rien a redemarrer en demo */ },
    paste: () => { /* pas de presse-papiers distant en demo */ },
    key: (keysym, _code, down) => {
      if (down === false) return
      if (keysym === 0xff0d) typed = ''                                   // Entree : la « commande » part
      else if (keysym === 0xff08) typed = typed.slice(0, -1)             // Retour arriere
      else if (keysym >= 0x20 && keysym <= 0xff) typed += String.fromCodePoint(keysym)
      else if ((keysym & 0x01000000) !== 0) typed += String.fromCodePoint(keysym & 0x00ffffff)
      canvas.dataset.typed = typed
    },
    setScale: (scale) => { canvas.style.maxWidth = scale ? '100%' : 'none'; canvas.style.maxHeight = scale ? '100%' : 'none' },
  }
}

const enc = new TextEncoder()
const PROMPT = '\r\ndemo login: '

export const demoSerialSource: SerialSource = async (vm, h, signal) => {
  await new Promise((r) => setTimeout(r, 120))
  throwIfAborted(signal)
  let line = ''
  let on = true
  const say = (s: string) => { if (on) h.onData(enc.encode(s)) }
  setTimeout(() => {
    if (!on) return
    h.onOpen()
    say(`\x1b[1;33mconsole série simulée — ${vm}\x1b[0m\r\n(démo : tout ce que tu tapes revient en écho)\r\n`)
    say(PROMPT)
  }, 300)
  return {
    send: (data) => {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data)
      for (const ch of text) {
        if (ch === '\r' || ch === '\n') {
          const cmd = line.trim()
          line = ''
          if (!cmd) { say(PROMPT); continue }
          say(`\r\n${cmd === 'help' ? 'commandes de la démo : help, date, uname' : cmd === 'date' ? new Date().toString() : cmd === 'uname' ? `Linux ${vm} 7.2.0-demo x86_64` : `écho : ${cmd}`}`)
          say(PROMPT)
        } else if (ch === '\x7f' || ch === '\b') {
          if (line.length) { line = line.slice(0, -1); say('\b \b') }
        } else if (ch >= ' ') { line += ch; say(ch) }
      }
    },
    resize: () => { /* la demo ne reflue pas */ },
    close: () => { if (on) { on = false; h.onClose('déconnecté', true) } },
  }
}
