import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { courbeGamma, courbeLineaire } from '../../lib/rampes'
import { depuisModeleSimple } from '../../lib/rampesAssistant'
import type { Reveil, ReveilListe } from '../../lib/reveil'
import { AssistantReveil } from './AssistantReveil'
import { ModelesRampe, RampeSimple } from './RampeSimple'

const r: Reveil = {
  id: 'm', nom: 'semaine', enabled: true, duree_min: 20, lampes: ['1'], plafond_bri: 254,
  courbe: { bri: courbeGamma(1200, 1, 254), kelvin: courbeLineaire(1200, 2200, 5000) },
  tele: { actif: true, ecran: 'worldmonitor', source: 'hdmi1', moment: 'fin', avant_fin_min: 0 },
}
const liste = { ecrans: ['tele', 'worldmonitor'], sources: ['hdmi1'], moments: ['fin', 'debut'], worldmonitor_branche: true, limites: { duree_min: 5, duree_max: 90, essai_min_s: 20, essai_max_s: 600 } } as unknown as ReveilListe

describe('assistant du réveil et rampes simples', () => {
  it('l’assistant dit la phrase d’aperçu', () => {
    const out = renderToStaticMarkup(<AssistantReveil r={r} horaire={{ heure: '07:30', jours: [0, 1, 2, 3, 4] }} liste={liste} lampes={{ '1': { name: 'salon' } }} lecture={null} rampes={[]} onChange={() => {}} onHoraire={() => {}} onRampes={() => {}} />)
    expect(out).toContain('en semaine à 7h30 : la lumière monte de 7h10 à 7h30 sur salon, puis worldmonitor sur la télé.')
    expect(out).toContain('Je veux me réveiller')
  })
  it('quatre modèles nommés avec leur courbe', () => {
    const out = renderToStaticMarkup(<ModelesRampe onChoisir={() => {}} />)
    for (const n of ['lever de soleil', 'coucher de soleil', 'lecture', 'nuit douce']) expect(out).toContain(n)
    expect((out.match(/<svg/g) ?? []).length).toBe(4)
  })
  it('l’éditeur simple rend sa phrase et ses étapes', () => {
    const rampe = { id: 'x', ...depuisModeleSimple('lever', ['1'])! }
    const out = renderToStaticMarkup(<RampeSimple r={rampe} lampes={{ '1': { name: 'salon' } }} limites={{ duree_min_s: 30, duree_max_s: 43200, pistes: 8, points: 24, lampes_par_piste: 8, pas_min_s: 2, pas_max_s: 60 }} lecture={null} onChange={() => {}} />)
    expect(out).toContain('Pendant 20 min, la lumière monte de 1 % à 100 % sur salon')
    expect(out).toContain('4. la couleur de la lumière')
  })
})
