// Matrice de rythmes connus : tempo, mesure et premier temps trouvés avec et sans le cycle (hors typecheck de l'app : écrit un fichier).
// DJ_BENCH_OUT=<table.md> npx vitest run scripts/djBench.matrice.test.ts
import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { rejouer, suiteRythmee } from '../src/lib/djBench'
import { lireReglages } from '../src/lib/djReglages'

describe.skipIf(!process.env.DJ_BENCH_OUT)('matrice de rythmes connus', () => {
  it('écrit la table', () => {
    const tot: Record<string, { ok: number; n: number; un: number; nun: number; mesure: number }> = {}
    const lignes = ['| bpm | temps | grosses caisses absentes | methode | bpm trouve | ecart % | premier temps juste |', '|---|---|---|---|---|---|---|']
    for (const bpm of [78, 92, 105, 120, 128, 140, 150, 172]) for (const m of [3, 4] as const) for (const oubli of [0, 0.5, 0.75]) {
      for (const [nom, cycle] of [['grosses caisses seules', false], ['cycle', true]] as const) {
        const s = suiteRythmee(bpm, m, 40, { oubli, oubliUn: oubli > 0.6 ? 0.3 : 0 })
        s.reglages = lireReglages({ cycle: { actif: cycle } })
        const r = rejouer(s), fin = r.lectures[r.lectures.length - 1]
        const ecart = (Math.abs(fin.bpm - bpm) / bpm) * 100, P = 60 / bpm
        let bons = 0, essais = 0
        for (let k = 0; k < 40; k++) {
          const td = 0.31 + k * m * P + 0.4 * P, i = Math.round(td * 30)
          if (td < 25 || i >= r.lectures.length) continue
          essais++
          if (r.lectures[i].temps === 1) bons++
        }
        const t = (tot[nom] ??= { ok: 0, n: 0, un: 0, nun: 0, mesure: 0 })
        t.n++; if (ecart < 3) t.ok++; t.un += bons; t.nun += essais; if (fin.cycle?.mesure === m) t.mesure++
        lignes.push(`| ${bpm} | ${m} | ${Math.round(oubli * 100)} % | ${nom} | ${fin.bpm.toFixed(1)} | ${ecart.toFixed(1)} | ${essais ? Math.round((100 * bons) / essais) + ' %' : '-'} |`)
      }
    }
    const resume = Object.entries(tot).map(([k, t]) => `- ${k} : tempo juste (3 %) ${t.ok}/${t.n}${t.nun && k === 'cycle' ? `, mesure juste ${t.mesure}/${t.n}, premier temps juste ${Math.round((100 * t.un) / t.nun)} %` : ''}`)
    writeFileSync(process.env.DJ_BENCH_OUT!, [...resume, '', ...lignes].join('\n'))
    expect(lignes.length).toBeGreaterThan(10)
  }, 600000)
})
