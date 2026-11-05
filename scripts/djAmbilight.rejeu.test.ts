// Rejoue des images audio réelles (enregistrées depuis GET /djlight/flux) dans le vrai moteur DJ puis dans le calcul du niveau de
// l'Ambilight, hors navigateur : sert à voir si le niveau varie avec la musique. Hors typecheck de l'application. Lancement :
//   DJ_FRAMES=<fichier json d'images> npx vitest run scripts/djAmbilight.rejeu.test.ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { DjMoteur } from '../src/lib/djMoteur'
import { REGLAGES_DEFAUT } from '../src/lib/djReglages'
import { CADENCE_DEPART, ETAT_DEPART, REGLAGES_AMBILIGHT, avancer, couleurDeNiveau, decider } from '../src/lib/djAmbilight'
import type { ImageAudio, SignalId } from '../src/lib/djSignaux'

const FICHIER = process.env.DJ_FRAMES

describe.skipIf(!FICHIER)('rejeu : images audio réelles -> niveau Ambilight', () => {
  const images = (FICHIER ? JSON.parse(readFileSync(FICHIER, 'utf-8')) : []) as ImageAudio[]

  for (const signal of ['volume', 'volume_court', 'basses'] as SignalId[]) {
    it(`signal « ${signal} » avec les réglages de départ`, () => {
      const moteur = new DjMoteur()
      moteur.regler(REGLAGES_DEFAUT)
      const r = { ...REGLAGES_AMBILIGHT, signal }
      let etat = ETAT_DEPART, cadence = CADENCE_DEPART
      const signaux: number[] = [], niveaux: number[] = [], envois: string[] = []
      images.forEach((img, i) => {
        const t = i * (1000 / 30)
        moteur.pousser(img, t)
        const s = img.silence ? 0 : moteur.lecture(t).signaux[signal]
        const a = avancer(etat, s, t, r)
        etat = a.etat
        const d = decider(cadence, t, a.niveau, r.cadence)
        if (d.envoyer) { cadence = d.cadence; const c = couleurDeNiveau(a.niveau, r.couleur); envois.push(`${c.r},${c.g},${c.b}`) }
        signaux.push(s); niveaux.push(a.niveau)
      })
      const stats = (v: number[]) => ({ min: Math.min(...v).toFixed(3), max: Math.max(...v).toFixed(3), moy: (v.reduce((a, b) => a + b, 0) / v.length).toFixed(3) })
      console.log(`${signal} : signal ${JSON.stringify(stats(signaux))} niveau ${JSON.stringify(stats(niveaux))} envois ${envois.length} (distincts ${new Set(envois).size}) ; exemples ${envois.slice(0, 8).join(' | ')}`)
      expect(images.length).toBeGreaterThan(0)
    })
  }
})
