// Résumé matinal et recherche globale de démonstration (données inventées). Les réglages se modifient
// et l'aperçu suit (sections, ordre, nombre d'éléments, introduction), en mémoire jusqu'au rechargement.
// Enregistrement : voir INTEGRATION.md (ajouter `...resume` à ROUTES dans src/mock/routes.ts).
import type { MockHandler } from '../router'
import type { Briefing, CatalogueSection, Ligne, Reglages, SectionBriefing } from '../../lib/resume'
import type { Hit } from '../../lib/recherche'

const CATALOGUE: CatalogueSection[] = [
  { id: 'meteo', label: 'météo', max: 1, reglable: false },
  { id: 'agenda', label: 'agenda du jour', max: 6, reglable: true },
  { id: 'alertes', label: 'alertes', max: 5, reglable: true },
  { id: 'notifications', label: 'notifications non lues', max: 5, reglable: true },
  { id: 'sorties', label: 'sorties du jour', max: 5, reglable: true },
  { id: 'disque', label: 'disques', max: 4, reglable: true },
  { id: 'sauvegardes', label: 'sauvegardes', max: 3, reglable: true },
  { id: 'majs', label: 'mises à jour', max: 3, reglable: true },
]
const SOL = (texte: string, ecran: string, bouton: string) => ({ texte, ecran, bouton })
const L = (text: string, level: Ligne['level'] = 'info', extra: Partial<Ligne> = {}): Ligne => ({ text, level, ...extra })
const LIGNES: Record<string, Ligne[]> = {
  meteo: [L('Paris : couvert, 12 °C (de 9 à 17 °C), pluie 40 %')],
  agenda: [L('03:00 snapshot timeshift', 'info', { detail: 'catégorie sauvegardes', solution: SOL("Prévu aujourd'hui : consulte l'agenda.", 'agenda', "ouvrir l'agenda") }), L('14:00 dentiste'), L('18:30 sport'), L('21:00 film avec Léa')],
  alertes: [
    L('disque /backups/fast presque plein', 'warn', { detail: 'famille : disk ; gravité moyenne', solution: SOL('Libère de la place : vide la corbeille, retire les anciens téléchargements, puis recontrôle.', 'menage', "ouvrir l'entretien") }),
    L('unité subsync en échec', 'warn', { detail: 'famille : unit ; gravité moyenne', solution: SOL("Une unité systemd est tombée : regarde le journal, puis relance-la si c'est sûr.", 'outils', 'ouvrir les services') }),
  ],
  notifications: [
    L('démo · attend ta réponse (x3)', 'warn', { depuis: 'il y a 2 h', detail: 'session neutroncore', solution: SOL('Lis la notification et marque-la comme lue une fois traitée.', 'notifications', 'ouvrir les notifications') }),
    L('démo · réponse prête', 'info', { depuis: 'il y a 20 min', solution: SOL('Lis la notification et marque-la comme lue une fois traitée.', 'notifications', 'ouvrir les notifications') }),
  ],
  sorties: [L('03:00 Severance S03E04'), L('20:00 Dune 3 (sortie numérique)')],
  disque: [L('/backups/fast : 86 % (10 Go libres)', 'warn', { detail: '86 % utilisé, 10 Go libres ; seuils : alerte 85 %, critique 95 %', solution: SOL("Le disque se remplit : prévois un ménage avant qu'il ne devienne critique.", 'menage', "ouvrir l'entretien") }), L('/mnt/media : 79 % (327 Go libres)', 'ok'), L('/ : 62 % (120 Go libres)', 'ok')],
  sauvegardes: [L('timeshift : il y a 5 h', 'ok', { depuis: 'il y a 5 h', detail: 'dernière sauvegarde il y a 5 h', solution: SOL('Sauvegarde récente : rien à faire.', 'sauvegardes', 'ouvrir les sauvegardes') }), L('borg : il y a 47 h', 'ok', { depuis: 'il y a 47 h', detail: 'dernière sauvegarde il y a 47 h', solution: SOL('Sauvegarde récente : rien à faire.', 'sauvegardes', 'ouvrir les sauvegardes') })],
  majs: [L('12 mise(s) à jour disponible(s), dont 1 sensible(s) (noyau, pilotes)', 'warn', { detail: 'kernel, vim, git', solution: SOL('Mise à jour sensible : sauvegarde avant, installe, redémarre.', 'mises', 'ouvrir les mises à jour') }), L('kernel', 'warn', { detail: 'paquet sensible : redémarrage probable' })],
}
const rang = { ok: 0, info: 0, warn: 1, crit: 2 } as const

let reglages: Reglages = {
  heure: '07:30', intro: '{salutation}, voici ton résumé du {date}.',
  sections: CATALOGUE.map((c) => ({ id: c.id, enabled: true, max: c.max })),
  meteo: { ville: 'Paris', lat: 48.85, lon: 2.35 }, envoi: { actif: false, telephone: true, centre: true },
  accueil: true, ia: { actif: false, modele: 'llama3.2:3b' },
}

function composer(r: Reglages): Briefing {
  const sections: SectionBriefing[] = r.sections.filter((s) => s.enabled).map((s) => {
    const all = LIGNES[s.id] ?? []
    const n = CATALOGUE.find((c) => c.id === s.id)?.reglable ? s.max : all.length
    const niveau = all.reduce<Ligne['level']>((w, l) => (rang[l.level] > rang[w] ? l.level : w), 'ok')
    return { id: s.id, titre: CATALOGUE.find((c) => c.id === s.id)?.label ?? s.id, niveau, lignes: all.slice(0, n), cachees: Math.max(0, all.length - n), total: all.length, tous: all, solution: all.find((l) => l.level === niveau && l.solution)?.solution ?? null }
  })
  const intro = r.intro.replace('{salutation}', 'Bonjour').replace('{date}', 'mardi 20 octobre').replace('{jour}', 'mardi').replace('{heure}', '07:30')
  return { date: '2026-10-20', genere_a: '07:30', intro, sections, court: 'Paris : couvert, 12 °C, 2 alertes, 4 événements', niveau: 'warn', texte: intro }
}

const hit = (source: Hit['source'], id: string, titre: string, detail: string, ecran: string, score = 30, ref = ''): Hit =>
  ({ source, id: `${source}:${id}`, titre, detail, score, ecran, ref, niveau: '' })
const BASE: Hit[] = [
  hit('films', 'f1', 'Dune: Part Two', 'film 2024 - disponible', 'films'),
  hit('films', 's1', 'Severance', 'série 2022 - disponible', 'films'),
  hit('sessions', 'x1', 'atelier boîte lego', 'en cours - neutroncore', 'lanceur', 30, 'demo-session'),
  hit('automatisations', 'a1', 'ambiance du soir', 'à une heure ; scène hue', 'automatisations'),
  hit('projets', 'p1', 'neutroncore', 'main', 'projets'),
  hit('notifications', 'n1', 'disque /backups/fast presque plein', '10 Go libres', 'disque'),
  hit('docs', 'd1', 'lyra / Pipeline', 'le micro envoie vers whisper puis le routeur choisit le modèle', '', 20, 'lyra/CLAUDE.md'),
]
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export const resume: [string, string, MockHandler][] = [
  ['GET', '/resume/reglages', () => ({ reglages, defaut: reglages, sections: CATALOGUE, intro_max: 240 })],
  ['PUT', '/resume/reglages', ({ body }) => { reglages = ((body as { reglages?: Reglages })?.reglages ?? reglages); return { success: true, reglages } }],
  ['POST', '/resume/apercu', ({ body }) => ({ resume: composer((body as { reglages: Reglages }).reglages ?? reglages) })],
  ['GET', '/resume/villes', ({ query }) => ({ villes: [{ nom: query.get('q') ?? 'Paris', zone: 'France', lat: 48.85, lon: 2.35 }] })],
  ['GET', '/resume', () => ({ resume: composer(reglages), accueil: reglages.accueil })],
  ['GET', '/recherche', ({ query }) => {
    const mots = fold(query.get('q') ?? '').split(/\s+/).filter(Boolean)
    const resultats = BASE.filter((h) => mots.every((m) => fold(`${h.titre} ${h.detail}`).includes(m)))
    const sources = Object.fromEntries(['films', 'sessions', 'automatisations', 'projets', 'notifications', 'docs'].map((s) => [s,
      { n: resultats.filter((h) => h.source === s).length, ms: 12, etat: 'ok', label: s }]))
    return { q: query.get('q') ?? '', resultats, sources }
  }],
]
