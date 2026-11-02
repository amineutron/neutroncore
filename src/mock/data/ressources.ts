// Ressources de démonstration : 24 h de courbes générées autour de l'heure courante, carte graphique
// avec deux modèles Ollama dont on peut décharger un (en mémoire jusqu'au rechargement), seuils retenus.
import type { MockHandler } from '../router'

const GO = 1024 ** 3
const MO = 1024 ** 2

const SEUILS_DEFAUT = {
  actif: true, soutenu: 3,
  cpu: { warn: 90, crit: 98 }, ram: { warn: 85, crit: 95 }, swap: { warn: 50, crit: 80 },
  tcpu: { warn: 85, crit: 95 }, tnvme: { warn: 70, crit: 80 }, tgpu: { warn: 80, crit: 88 },
  vram: { warn: 90, crit: 97 }, gpu: { warn: 98, crit: 100 },
}
let seuils: Record<string, unknown> = structuredClone(SEUILS_DEFAUT)

const METRIQUES = {
  cpu: { libelle: 'processeur', unite: '%', max: 100 }, ram: { libelle: 'mémoire vive', unite: '%', max: 100 },
  swap: { libelle: 'swap', unite: '%', max: 100 }, tcpu: { libelle: 'température du processeur', unite: '°C', max: 120 },
  tnvme: { libelle: 'température du nvme', unite: '°C', max: 120 }, tgpu: { libelle: 'température de la carte graphique', unite: '°C', max: 120 },
  vram: { libelle: 'mémoire de la carte graphique', unite: '%', max: 100 }, gpu: { libelle: 'charge de la carte graphique', unite: '%', max: 100 },
}

type P = Record<string, unknown> & { t: number }
const r1 = (n: number) => Math.round(n * 10) / 10

function point(t: number, i: number): P {
  const jour = Math.sin((i / 1440) * Math.PI * 2 - 1.2)          // cycle de 24 h
  const rafale = Math.max(0, Math.sin(i / 37)) ** 3
  const gpu = Math.max(2, 20 + 25 * Math.sin(i / 90) + 40 * rafale)
  return {
    t, cpu: r1(Math.min(100, 18 + 10 * jour + 45 * rafale)), ram: r1(38 + 6 * jour + 2 * Math.sin(i / 11)), swap: r1(4 + 2 * jour),
    tcpu: r1(48 + 4 * jour + 20 * rafale), tnvme: r1(41 + 3 * jour + 4 * rafale), tgpu: r1(41 + 0.3 * gpu),
    gpu: r1(gpu), vram: r1(13 + 25 * (gpu > 40 ? 1 : 0.1)), gw: r1(60 + gpu * 2.2),
    rx: Math.round(40_000 + 700_000 * Math.max(0, Math.sin(i / 53)) ** 4), tx: Math.round(15_000 + 90_000 * rafale),
    d: { '/': 77.2, '/data': 64.8, '/backups': 49.3 },
  }
}

function serie(): P[] {
  const maintenant = Math.floor(Date.now() / 1000)
  return Array.from({ length: 1440 }, (_, k) => point(maintenant - (1439 - k) * 60, 1439 - (1439 - k)))
}

function resume(points: P[]) {
  const out: Record<string, unknown> = {}
  for (const c of ['cpu', 'ram', 'swap', 'tcpu', 'tnvme', 'tgpu', 'gpu', 'vram', 'gw', 'rx', 'tx']) {
    const v = points.map((p) => p[c] as number)
    out[c] = { min: Math.min(...v), moy: r1(v.reduce((a, b) => a + b, 0) / v.length), max: Math.max(...v), dernier: v[v.length - 1] }
  }
  return out
}

function reduire(points: P[], cible: number): P[] {
  if (points.length <= cible) return points
  const taille = Math.ceil(points.length / cible)
  const out: P[] = []
  for (let i = 0; i < points.length; i += taille) {
    const lot = points.slice(i, i + taille)
    const moy: P = { t: lot[Math.floor(lot.length / 2)].t, d: lot[lot.length - 1].d }
    for (const c of Object.keys(lot[0])) if (c !== 't' && c !== 'd') moy[c] = r1(lot.reduce((a, p) => a + (p[c] as number), 0) / lot.length)
    out.push(moy)
  }
  return out
}

let modeles = [
  { nom: 'qwen2.5-coder:7b', taille: 6.1 * GO, vram: 6.1 * GO, sur_gpu_pct: 100, parametres: '7.6B', quantification: 'Q4_K_M', expire: '' },
  { nom: 'llama3.2:3b', taille: 2.6 * GO, vram: 2.6 * GO, sur_gpu_pct: 100, parametres: '3.2B', quantification: 'Q4_K_M', expire: '' },
].map((m) => ({ ...m, taille: Math.round(m.taille), vram: Math.round(m.vram) }))

export const ressources: [string, string, MockHandler][] = [
  ['GET', '/ressources/maintenant', () => {
    const p = serie().slice(-1)[0]
    return { point: p, seuils, alertes: [], metriques: METRIQUES }
  }],
  ['GET', '/ressources/courbes', ({ query }) => {
    const heures = Math.min(Math.max(Number(query.get('heures')) || 24, 0.1), 24)
    const pts = serie().filter((p) => p.t >= Date.now() / 1000 - heures * 3600)
    return { points: reduire(pts, Math.min(Number(query.get('points')) || 240, 720)), resume: resume(pts), echantillon_s: 60, nombre: pts.length }
  }],
  ['GET', '/ressources/gpu', () => {
    const occupe = modeles.reduce((s, m) => s + m.vram, 0)
    const utilisee = occupe + 420 * MO
    return {
      gpu: {
        nom: 'NVIDIA GeForce RTX 3080 Ti', vram_utilisee: utilisee, vram_total: 12 * GO, vram_pct: r1((utilisee / (12 * GO)) * 100),
        utilisation: modeles.length ? 31 : 4, utilisation_memoire: 9, temperature: modeles.length ? 54 : 41, puissance: modeles.length ? 118.4 : 36.2, puissance_max: 300,
        horloge_sm: 1215, horloge_sm_max: 2115, horloge_mem: 5001, horloge_mem_max: 9501, ventilateur: 38, pstate: 'P3',
      },
      processus: [
        ...(modeles.length ? [{ pid: 4120, vram: occupe, nom: 'ollama', proprietaire: 'ollama' }] : []),
        { pid: 27825, vram: 242 * MO, nom: 'chrome', proprietaire: 'navigateur' },
        { pid: 13648, vram: 177 * MO, nom: 'quickshell', proprietaire: 'bureau' },
      ],
      occupation: [
        ...(modeles.length ? [{ proprietaire: 'ollama', libelle: 'ollama', vram: occupe }] : []),
        { proprietaire: 'navigateur', libelle: 'navigateur', vram: 242 * MO }, { proprietaire: 'bureau', libelle: 'bureau', vram: 177 * MO },
      ],
      ollama: { modeles, erreur: '' },
    }
  }],
  ['GET', '/ressources/seuils', () => ({ seuils, defaut: SEUILS_DEFAUT })],
  ['PUT', '/ressources/seuils', ({ body }) => {
    const patch = (body ?? {}) as Record<string, unknown>
    const next = structuredClone(seuils)
    for (const [k, v] of Object.entries(patch)) {
      const cur = next[k]
      next[k] = cur && typeof cur === 'object' && v && typeof v === 'object' ? { ...cur, ...v } : v
    }
    seuils = next
    return { seuils }
  }],
  ['DELETE', '/ressources/seuils', () => { seuils = structuredClone(SEUILS_DEFAUT); return { seuils } }],
  ['POST', '/ressources/ollama/decharger', ({ body }) => {
    const nom = (body as { modele?: string } | undefined)?.modele
    modeles = modeles.filter((m) => m.nom !== nom)
    return { success: true, modele: nom }
  }],
]
