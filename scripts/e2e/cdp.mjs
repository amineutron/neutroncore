// Mini pilote Chrome sans dependance (protocole DevTools via WebSocket, global dans Node 22) :
// sert un dossier statique, lance Chrome sans interface et expose evaluer / cliquer / taper / capturer.
// Utilise par scripts/e2e/*.e2e.mjs. Rien n'est installe, rien ne touche au vrai backend.
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const freePort = () => new Promise((res, rej) => {
  const s = createServer()
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)) })
  s.on('error', rej)
})

/** Sert `dir` sous le prefixe `base` (ex. /neutroncore/), avec repli sur index.html. */
export async function serveStatic(dir, base) {
  const port = await freePort()
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    if (!url.startsWith(base)) { res.writeHead(404).end(); return }
    let p = normalize(join(dir, url.slice(base.length)))
    if (!p.startsWith(dir)) { res.writeHead(403).end(); return }
    if (!existsSync(p) || statSync(p).isDirectory()) p = join(dir, 'index.html')
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    createReadStream(p).pipe(res)
  })
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  return { port, close: () => new Promise((r) => server.close(r)) }
}

async function getJson(url) {
  const r = await fetch(url)
  return r.json()
}

export async function launchChrome({ width = 1440, height = 900, chrome = process.env.CHROME_BIN || 'google-chrome' } = {}) {
  const port = await freePort()
  const dir = mkdtempSync(join(tmpdir(), 'nc-e2e-'))
  const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' })
  let version
  for (let i = 0; i < 80 && !version; i++) {
    try { version = await getJson(`http://127.0.0.1:${port}/json/version`) } catch { await sleep(150) }
  }
  if (!version) { proc.kill(); throw new Error('Chrome ne repond pas') }
  const targets = await getJson(`http://127.0.0.1:${port}/json/list`)
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })

  let id = 0
  const pending = new Map()
  const errors = []
  const listeners = new Map()
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result)
      return
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
    ;(listeners.get(msg.method) ?? []).forEach((f) => f(msg.params))
  }
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  const once = (method) => new Promise((r) => { const l = listeners.get(method) ?? []; const f = (p) => { listeners.set(method, (listeners.get(method) ?? []).filter((x) => x !== f)); r(p) }; listeners.set(method, [...l, f]) })
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Network.setCacheDisabled', { cacheDisabled: true })

  const api = {
    errors,
    send,
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    },
    async init(script) { await send('Page.addScriptToEvaluateOnNewDocument', { source: script }) },
    async goto(url) { const loaded = once('Page.loadEventFired'); await send('Page.navigate', { url }); await loaded; await sleep(250) },
    async viewport(w, h, mobile = false) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }) },
    async waitFor(expr, { timeout = 8000, what = expr } = {}) {
      const t0 = Date.now()
      let last
      while (Date.now() - t0 < timeout) {
        try { last = await api.eval(expr); if (last) return last } catch (e) { last = e.message }
        await sleep(100)
      }
      throw new Error(`delai depasse : ${what} (dernier : ${JSON.stringify(last)})`)
    },
    async click(sel) { await api.waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, { what: `present ${sel}` }); await api.eval(`document.querySelector(${JSON.stringify(sel)}).click()`) },
    /** clique le premier element de `sel` dont le texte contient `text` */
    async clickText(sel, text) {
      const js = `(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.textContent.includes(${JSON.stringify(text)}));if(!e)return false;e.click();return true})()`
      await api.waitFor(js, { what: `clic « ${text} » dans ${sel}` })
    },
    async text(sel) { return api.eval(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent||''`) },
    async count(sel) { return api.eval(`document.querySelectorAll(${JSON.stringify(sel)}).length`) },
    async focus(sel) { await api.eval(`document.querySelector(${JSON.stringify(sel)}).focus()`) },
    async type(text) { for (const ch of text) { await send('Input.insertText', { text: ch }); await sleep(30) } },
    async backspace() {
      for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
      await sleep(30)
    },
    async press(key, code = key) {
      for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, code })
      await sleep(30)
    },
    async shot(path) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      mkdirSync(join(path, '..'), { recursive: true })
      writeFileSync(path, Buffer.from(data, 'base64'))
    },
    async close() { try { ws.close() } catch { /* deja ferme */ } proc.kill(); await sleep(150); rmSync(dir, { recursive: true, force: true }) },
  }
  return api
}
