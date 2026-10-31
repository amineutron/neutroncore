// Sauvegardes de démonstration : données inventées (aucune mesure réelle). Les réglages et le test de
// restauration se modifient comme sur la vraie app, retenus en mémoire jusqu'au rechargement.
import type { MockHandler } from '../router'
import type { Archive, Reglages, Snapshot, Tableau, Verif } from '../../lib/sauvegardes'

const JOUR = 86400
const GO = 1e9

function snapshots(now: number): Snapshot[] {
  return Array.from({ length: 14 }, (_, i) => {
    const ts = Math.floor(now - (13 - i) * JOUR / 2)
    const d = new Date(ts * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      nom: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-00-00`,
      ts, etiquette: i % 3 === 2 ? 'ondemand' : 'daily', commentaire: '', fichiers: 1_426_000 + i * 40,
      taille: Math.round((71.2 + i * 0.05) * GO), transfere: Math.round((0.4 + (i % 4) * 0.1) * GO), duree_s: 50 + (i % 5) * 20,
    }
  }).reverse()
}

function archives(now: number): Archive[] {
  return Array.from({ length: 12 }, (_, i) => {
    const debut = new Date((now - (11 - i) * 7 * JOUR) * 1000)
    return {
      archive: `backup-demo-${debut.toISOString().slice(0, 10)}`, debut: debut.toISOString().slice(0, 19), duree_s: 65 + (i % 4) * 12,
      fichiers: 310_000 + i * 900, original: Math.round((236 + i * 0.4) * GO), compresse: Math.round((210 + i * 0.3) * GO),
      nouveau: Math.round((1.1 + (i % 3) * 0.6) * GO),
    }
  }).reverse()
}

const moyenne = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null)
let reglages: Reglages = { timeshift_max_h: 36, borg_max_j: 9, verif_max_j: 45, liste_max: 30 }
let verifs: Verif[] = []
let travail: Tableau['travail'] = { actif: null, dernier: null }

function tableau(): Tableau {
  const now = Math.floor(Date.now() / 1000)
  const ts = snapshots(now), bg = archives(now)
  const dts = ts.map((s) => s.duree_s ?? 0), dbg = bg.map((a) => a.duree_s ?? 0)
  const dernierBorg = Date.parse(bg[0].debut) / 1000
  const base = { stable: { sens: 'stable' as const, pct: 0.8 }, hausse: { sens: 'hausse' as const, pct: 6.4 } }
  const derniere = verifs[verifs.length - 1] ?? null
  return {
    maintenant: now,
    timeshift: {
      total: ts.length, dernier_ts: ts[0].ts, age_jours: (now - ts[0].ts) / JOUR, liste: ts.slice(0, reglages.liste_max), regulier: ts.length,
      taille_tendance: base.hausse, duree: { moyenne_s: moyenne(dts), max_s: Math.max(...dts), tendance: base.stable },
      espace: { montage: '/backups/fast', total: 105 * GO, utilise: 90 * GO, libre: 15 * GO, libre_pct: 14.3 },
      planification: { unite: { state: 'ok' }, minuteur_actif: true, prochain: '2026-10-21T03:17:01' },
    },
    borg: {
      total: bg.length, dernier_ts: dernierBorg, age_jours: (now - dernierBorg) / JOUR, liste: bg.slice(0, reglages.liste_max),
      taille_tendance: base.stable, nouveau_tendance: base.stable, duree: { moyenne_s: moyenne(dbg), max_s: Math.max(...dbg), tendance: base.stable },
      depot: { depot_total: 3900 * GO, depot_compresse: 3410 * GO, depot_dedup: 244 * GO },
      espace: { montage: '/mnt/backup_cold', total: 880 * GO, utilise: 590 * GO, libre: 250 * GO, libre_pct: 28.4 },
      planification: { unite: { state: 'ok' }, minuteur_actif: true, prochain: '2026-10-25T02:26:05' },
    },
    verification: { derniere, historique: [...verifs].reverse().slice(0, 10), age_jours: derniere ? (now - derniere.ts) / JOUR : null },
    alertes: [], reglages, travail,
  }
}

export const sauvegardes: [string, string, MockHandler][] = [
  ['GET', '/sauvegardes', () => tableau()],
  ['PUT', '/sauvegardes/reglages', ({ body }) => {
    reglages = { ...reglages, ...(body as Partial<Reglages>) }
    return { reglages }
  }],
  ['POST', '/sauvegardes/verifier', ({ body }) => {
    const niveau = (body as { niveau?: string })?.niveau === 'profond' ? 'profond' : 'rapide'
    const now = Date.now() / 1000
    verifs = [...verifs, {
      ts: now, niveau, ok: true, duree_s: niveau === 'profond' ? 412 : 6, extrait: 'mode démo : rien n\'a été lu',
      controles: [{ nom: 'Repository valide', ok: true, ignore: false }, { nom: 'Test extraction', ok: true, ignore: false }],
    }]
    travail = { actif: null, dernier: { genre: 'verification', libelle: `verification ${niveau} du depot borg`, debut: now - 6, fin: now, ok: true, erreur: null, extrait: 'mode démo : rien n\'a été lu' } }
    return { demarre: true, niveau }
  }],
  ['POST', '/sauvegardes/lancer', ({ body }) => ({ demarre: true, ...(body as object), demo: true })],
]
