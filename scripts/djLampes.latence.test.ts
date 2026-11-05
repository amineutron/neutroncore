// Mesure la latence LOGICIELLE de la chaîne DJ Light -> vraies lampes, sans toucher aucune lampe.
//   moteur audio (signal de mire, cadencé en temps réel) -> moteur TS + calcul des couleurs -> WebSocket -> API (mini) -> socket de huebeat (faux)
// Pour chaque image : heure d'émission par le moteur (champ `t`) -> heure d'arrivée de la trame au faux huebeat.
// Hors typecheck de l'application (lance des processus). Lancement :
//   DJ_LATENCE=<dossier de travail> DJ_API_DIR=<dossier de lyra-control-api> npx vitest run scripts/djLampes.latence.test.ts
import { describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { DjMoteur } from '../src/lib/djMoteur'
import { CONFIG_DEPART } from '../src/lib/djCouches'
import { COMMUN_DEFAUT, type Scene } from '../src/lib/spatialFx'
import { couleursCanaux, encoderTrame, lireCanaux } from '../src/lib/djLampes'
import { LiaisonLampes } from '../src/lib/djLiaison'
import type { ImageAudio } from '../src/lib/djSignaux'

const DOSSIER = process.env.DJ_LATENCE
// Dossier de lyra-control-api (son virtualenv fournit le Python de la mini API) : à fournir, aucun chemin en dur.
const API = process.env.DJ_API_DIR ?? ''
const PORT = 9911
const DIMS = { w: 400, h: 400, d: 250 }
const SCENE: Scene = { id: 's', nom: 'vague', effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 50, z: 50 }, intensite: 100 }
const CANAUX = { 0: [-150, -100, 120], 1: [-60, 0, 120], 2: [0, 100, 120], 3: [60, 0, 120], 4: [150, -100, 120], 5: [150, 100, 40], 6: [-150, 100, 40] }
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
const centile = (t: number[], p: number) => [...t].sort((a, b) => a - b)[Math.min(t.length - 1, Math.floor(p * t.length))]

async function attendrePort(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/djlight/reel`); if (r.status) return } catch { /* pas encore */ }
    await pause(100)
  }
  throw new Error('mini API non démarrée')
}

describe.skipIf(!DOSSIER)('latence logicielle DJ Light -> lampes', () => {
  it('mesure émission du moteur -> arrivée chez huebeat', async () => {
    const journal = `${DOSSIER}/arrivees.jsonl`
    const mini = spawn(`${API}/.venv/bin/python`, [`${DOSSIER}/mini_api.py`, String(PORT), `/tmp/djl-essai-${PORT}.sock`, journal], { stdio: ['ignore', 'inherit', 'inherit'] })
    try {
      await attendrePort()
      const moteur = new DjMoteur()
      const profil = CONFIG_DEPART().profils[0]
      const canaux = lireCanaux(CANAUX)
      const liaison = new LiaisonLampes({
        reel: async () => ({ success: true, canaux: CANAUX }),
        ouvrir: () => { const ws = new WebSocket(`ws://127.0.0.1:${PORT}/djlight/lampes`); ws.binaryType = 'arraybuffer'; return ws as never },
        cle: () => 'cle-essai',
        surEtat: () => {},
      })
      await liaison.demarrer()
      for (let i = 0; i < 100 && !liaison.prete; i++) await pause(50)
      expect(liaison.prete).toBe(true)

      const images = 600                                           // 20 s
      const emissions: number[] = [], tickMs: number[] = [], envoyes: number[] = []
      const proc = spawn('/usr/bin/python3', [`${API}/djlight/moteur.py`, '--source', 'mire', '--images', String(images)], { stdio: ['ignore', 'pipe', 'inherit'] })
      const fini = new Promise<void>((ok) => proc.on('exit', () => ok()))
      const lignes = createInterface({ input: proc.stdout! })
      lignes.on('line', (l) => {
        const o = JSON.parse(l) as { type: string; t?: number }
        if (o.type !== 'frame') return
        const t0 = performance.now()
        moteur.pousser(o as unknown as ImageAudio, t0)
        const lum = moteur.lumiere(t0, { profil, scene: SCENE, scenes: [SCENE], commun: COMMUN_DEFAUT, dims: DIMS })
        const trame = encoderTrame(couleursCanaux(canaux, lum.sortie.effets, lum.sortie.params, DIMS, lum.beat, false))
        const ok = liaison.envoyer(trame)
        tickMs.push(performance.now() - t0)
        if (ok) { emissions.push((o.t as number) * 1000); envoyes.push(Date.now()) }
      })
      await fini
      await pause(500)

      const arrivees = readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { t: number; n: number })
      expect(arrivees.length).toBe(emissions.length)               // aucune trame perdue en route
      expect(arrivees.every((a) => a.n === 7 * 7)).toBe(true)      // 7 canaux, 49 octets
      const chaine = arrivees.map((a, i) => a.t * 1000 - emissions[i])                // émission moteur -> huebeat
      const reseau = arrivees.map((a, i) => a.t * 1000 - envoyes[i])                  // envoi navigateur -> huebeat (WebSocket + API + socket)
      const stats = (t: number[]) => `médiane ${centile(t, 0.5).toFixed(1)} ms, p95 ${centile(t, 0.95).toFixed(1)} ms, max ${Math.max(...t).toFixed(1)} ms`
      const rapport = [
        `images émises par le moteur : ${images}, trames arrivées chez huebeat : ${arrivees.length}`,
        `émission du moteur -> arrivée chez huebeat : ${stats(chaine)}`,
        `  dont moteur TS + calcul des couleurs : ${stats(tickMs)}`,
        `  dont WebSocket + API + socket jusqu'à huebeat : ${stats(reseau)}`,
      ].join('\n')
      writeFileSync(`${DOSSIER}/latence.txt`, rapport + '\n')
      console.log(rapport)
      expect(centile(chaine, 0.95)).toBeLessThan(40)
    } finally {
      mini.kill('SIGTERM')
    }
  }, 60_000)
})
