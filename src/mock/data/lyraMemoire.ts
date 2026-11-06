// Memoire et historique vocal de Lyra de demonstration : tout est invente. Les corrections et
// suppressions sont retenues en memoire jusqu'au rechargement. La demo simule un demon qui sait editer
// la memoire (edition_reelle) : une correction change le souvenir pour de bon, une suppression est definitive.
import type { MockHandler } from '../router'
import type { Evenement, Souvenir } from '../../lib/lyraMemoire'

const NOW = Math.floor(Date.now() / 1000)
const il_y_a = (h: number) => NOW - h * 3600
const THEMES: Record<string, string> = {
  machines: 'machines virtuelles et sauvegardes', tele: 'télé', lumieres: 'lumières', ampli: 'ampli',
  vocabulaire: 'mots que lyra comprend', divers: 'autres demandes',
}
const s = (id: string, genre: Souvenir['genre'], theme: string, texte: string, detail = '', h: number | null = null, outil = '', groupe = ''): Souvenir =>
  ({ id, genre, theme, texte, detail, at: h === null ? null : il_y_a(h), outil, groupe, corrige: false })

const BASE: Souvenir[] = [
  s('conv-1', 'demande', 'machines', 'démarre la vm de test', 'VM démarrée', 2, 'fedora.vm_start'),
  s('conv-2', 'demande', 'machines', 'fais une sauvegarde', 'sauvegarde lancée', 30, 'fedora.backup_create'),
  s('app-1', 'apprentissage', 'tele', 'mets la télé en veille', 'a compris : tv.power_off - fait', 5, 'tv.power_off'),
  s('app-2', 'apprentissage', 'ampli', 'sound only', "n'a pas su quoi faire", 70),
  s('app-3', 'apprentissage', 'lumieres', 'ambiance cinéma dans le salon', 'a compris : hue.activate_scene - fait', 26, 'hue.activate_scene'),
  s('voc-1', 'mot', 'vocabulaire', 'start', 'veut dire « démarre »', null, '', 'machines virtuelles'),
  s('voc-2', 'mot', 'vocabulaire', 'kill', 'veut dire « arrête »', null, '', 'machines virtuelles'),
  s('voc-3', 'mot', 'vocabulaire', 'télé', 'aussi dit : écran, tv, poste', null, '', 'appareils'),
]
let corrections: Record<string, string> = {}
let corbeille: Record<string, { item: Souvenir; at: number }> = {}
let reels: Record<string, string> = {}     // corrections appliquees chez lyra
let oublies: string[] = []                 // suppressions definitives chez lyra

const sens = (i: Souvenir) => i.detail.replace(/^veut dire « (.*) »$/, '$1').replace(/^aussi dit : /, '')
const detailMot = (i: Souvenir, v: string) => (i.detail.startsWith('aussi dit') ? `aussi dit : ${v}` : `veut dire « ${v} »`)
const reel = (i: Souvenir): Souvenir => {
  const v = reels[i.id]
  if (i.genre === 'mot') return { ...i, valeur: v ?? sens(i), detail: v ? detailMot(i, v) : i.detail }
  return v ? { ...i, texte: v } : i
}
const vue = (): Souvenir[] => BASE.filter((i) => !corbeille[i.id] && !oublies.includes(i.id)).map(reel)
  .map((i) => (corrections[i.id] ? { ...i, texte: corrections[i.id], original: i.texte, corrige: true } : i))
const norm = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const EV: Evenement[] = [
  [2, 'démarre la vm de test', 'fedora.vm_start', true, 0.78], [3, 'éteins le salon', 'hue.turn_off_light', true, 0.7],
  [26, 'sound only', '', false, 0.2], [27, 'coupe le son', 'denon.mute_toggle', true, 0.62],
  [50, 'redémarre la vm', 'fedora.vm_start', false, 0.55], [52, 'mets la télé en veille', 'tv.power_off', true, 0.81],
  [75, 'lance youtube sur la télé', 'catt.cast_youtube', true, 0.66],
].map(([h, phrase, outil, ok, conf], i) => ({
  id: `jr-${i}`, at: il_y_a(h as number), source: 'journal' as const, canal: i % 3 === 0 ? 'vocal' : 'texte', phrase: phrase as string, outil: outil as string,
  compris: !!outil, succes: ok as boolean, confiance: conf as number,
  detail: ok ? '' : outil ? "n'a pas abouti" : "n'a pas su quoi faire",
}))

const taux = (l: Evenement[]) => ({ total: l.length, reussis: l.filter((e) => e.succes).length, taux: l.length ? Math.round((1000 * l.filter((e) => e.succes).length) / l.length) / 10 : null })

export const lyraMemoire: [string, string, MockHandler][] = [
  ['GET', '/lyra/memoire/apercu', () => {
    const items = vue()
    const themes = Object.keys(THEMES).filter((t) => items.some((i) => i.theme === t)).map((t) => {
      const l = items.filter((i) => i.theme === t)
      return { id: t, libelle: THEMES[t], n: l.length, exemples: l.slice(0, 3).map((i) => i.texte) }
    })
    return { total: items.length, demandes: items.filter((i) => i.genre === 'demande').length, apprentissages: items.filter((i) => i.genre === 'apprentissage').length,
      mots: items.filter((i) => i.genre === 'mot').length, corrigees: Object.keys(corrections).length, corbeille: Object.keys(corbeille).length,
      derniere: il_y_a(2), themes, note: 'mode démo', edition_reelle: true }
  }],
  ['GET', '/lyra/memoire/corbeille', () => ({ items: Object.values(corbeille).map((v) => ({ ...v.item, supprime_le: v.at })) })],
  ['GET', '/lyra/memoire', ({ query }) => {
    const mots = norm(query.get('q') ?? '').split(/\s+/).filter(Boolean)
    const theme = query.get('theme') ?? ''
    const all = vue()
    const items = all.filter((i) => (!theme || i.theme === theme) && mots.every((m) => norm(`${i.texte} ${i.detail} ${i.groupe}`).includes(m)))
    const themes = Object.keys(THEMES).filter((t) => all.some((i) => i.theme === t)).map((t) => ({ id: t, libelle: THEMES[t], n: all.filter((i) => i.theme === t).length }))
    return { items, n: items.length, themes, corbeille: Object.keys(corbeille).length, appliquee_chez_lyra: true, edition_reelle: true,
      note: 'Tes corrections et suppressions modifient la vraie mémoire de Lyra. Les mots du vocabulaire ne comptent qu’après le redémarrage du démon.' }
  }],
  ['PUT', '/lyra/memoire/:id', ({ params, body }) => {
    const texte = String((body as { texte?: string })?.texte ?? '')
    reels = { ...reels, [params.id]: texte }
    return { success: true, texte, appliquee_chez_lyra: true, id: params.id, redemarrage_requis: params.id.startsWith('voc-') }
  }],
  ['DELETE', '/lyra/memoire/:id/definitif', ({ params }) => {
    oublies = [...oublies, params.id]
    return { success: true, appliquee_chez_lyra: true, definitif: true, redemarrage_requis: params.id.startsWith('voc-') }
  }],
  ['DELETE', '/lyra/memoire/corbeille', () => { corbeille = {}; return { success: true } }],
  ['DELETE', '/lyra/memoire/:id/correction', ({ params }) => { const { [params.id]: _, ...reste } = corrections; corrections = reste; return { success: true } }],
  ['POST', '/lyra/memoire/mots', ({ body }) => {
    const b = (body ?? {}) as { mot?: string; veut_dire?: string[] }
    return { success: true, appliquee_chez_lyra: false, id: `voc-demo-${(b.mot ?? '').length}`, mot: b.mot ?? '', veut_dire: b.veut_dire ?? [], redemarrage_requis: false, raison: 'démo : rien n’est enregistré' }
  }],
  ['POST', '/lyra/memoire/:id/restaurer', ({ params }) => { const { [params.id]: _, ...reste } = corbeille; corbeille = reste; return { success: true } }],
  ['DELETE', '/lyra/memoire/:id', ({ params }) => {
    const item = vue().find((i) => i.id === params.id)
    if (item) corbeille = { ...corbeille, [params.id]: { item, at: NOW } }
    return { success: true }
  }],
  ['GET', '/lyra/historique', ({ query }) => {
    const succes = query.get('succes') ?? ''
    const outil = query.get('outil') ?? ''
    const mots = norm(query.get('q') ?? '').split(/\s+/).filter(Boolean)
    const l = EV.filter((e) => (!outil || e.outil === outil) && (succes === '' || (succes === 'oui') === e.succes) && mots.every((m) => norm(`${e.phrase} ${e.outil}`).includes(m)))
    const jour = (e: Evenement) => new Date((e.at ?? 0) * 1000).toLocaleDateString('sv-SE')
    const groupe = <K extends string>(cle: (e: Evenement) => string, nom: K) =>
      [...new Set(l.map(cle))].map((k) => ({ [nom]: k, ...taux(l.filter((e) => cle(e) === k)) }))
    return { evenements: l, n: l.length, outils: [...new Set(EV.map((e) => e.outil).filter(Boolean))].sort(),
      stats: { ...taux(l), non_compris: l.filter((e) => !e.compris).length, erreurs: 0, sans_verdict: 0,
        par_jour: groupe(jour, 'jour'), par_outil: groupe((e) => e.outil, 'outil') },
      note: "Aucun son n'est gardé. Depuis que le démon tient son journal, chaque échange dit s'il est venu de la voix ou du clavier ; avant, le canal est inconnu." }
  }],
]
