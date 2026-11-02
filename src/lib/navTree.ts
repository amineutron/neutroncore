// Arbre de navigation : 11 entrées de menu qui regroupent les écrans en sous-onglets.
// Les identifiants d'écran ne changent pas (liens profonds, palette, notifications) :
// un écran « mises » s'ouvre simplement dans l'entrée « système », sous-onglet « mises à jour ».

export interface Tab<Id extends string = string> { id: Id; label: string }
export interface Hub<Id extends string = string> { id: string; label: string; group: string; tabs: Tab<Id>[] }

export function buildHubs<Id extends string>(): Hub<Id>[] {
  const t = (id: string, label: string): Tab<Id> => ({ id: id as Id, label })
  const h = (id: string, label: string, group: string, tabs: Tab<Id>[]): Hub<Id> => ({ id, label, group, tabs })
  return [
    h('accueil', 'accueil', 'pilotage', [t('accueil', 'accueil')]),
    h('agenda', 'agenda', 'pilotage', [t('agenda', 'agenda'), t('minuteurs', 'minuteurs & notes'), t('resume', 'résumé du matin')]),
    h('auto', 'automatisations', 'pilotage', [t('automatisations', 'automatisations'), t('reveil', 'réveil'), t('rampes', 'rampes de lumière')]),
    h('dev', 'dev', 'dev', [t('lanceur', 'lanceur'), t('projets', 'projets'), t('taches', 'tâches'), t('atelier', 'atelier 3d'), t('historique', 'historique')]),
    h('qualite', 'qualité', 'dev', [t('tests', 'tests'), t('qualite', 'qualité'), t('cideps', 'ci & dépendances')]),
    h('lyra', 'lyra', 'dev', [t('lyramemoire', 'mémoire'), t('sandbox', 'bac à sable')]),
    h('media', 'média', 'maison', [t('films', 'films & séries'), t('demandes', 'demandes'), t('dl', 'téléchargements'), t('dv', 'conversions dv'), t('menage', 'entretien')]),
    h('ambiance', 'ambiance', 'maison', [t('ambiance', 'scènes & tv'), t('lumiere', 'lumière 3d'), t('plan', 'plan de pièce'), t('zonesaudio', 'sono'), t('camera', 'caméra')]),
    h('veille', 'veille', 'maison', [t('worldmonitor', 'god eye'), t('cyber', 'cyber'), t('reseau', 'réseau'), t('securite', 'sécurité')]),
    h('systeme', 'système', 'système', [t('ressources', 'ressources'), t('outils', 'outils & vms'), t('vms', 'console vms'), t('sauvegardes', 'sauvegardes'), t('mises', 'mises à jour')]),
    h('reglages', 'réglages', 'système', [t('parametres', 'paramètres'), t('themes', 'thèmes'), t('reglages2', 'sauvegarde & journal')]),
  ]
}

export function hubOf<Id extends string>(hubs: Hub<Id>[], screen: string): Hub<Id> | undefined {
  return hubs.find((x) => x.tabs.some((tb) => tb.id === screen))
}

/** Écran à ouvrir en touchant une entrée du menu : le dernier sous-onglet vu s'il existe encore, sinon le premier. */
export function entryScreen<Id extends string>(hub: Hub<Id>, remembered: string | null): Id {
  const ok = remembered && hub.tabs.some((tb) => tb.id === remembered)
  return (ok ? remembered : hub.tabs[0].id) as Id
}

/** Entrées du menu regroupées par rubrique, dans l'ordre. */
export function groupHubs<Id extends string>(hubs: Hub<Id>[]): { group: string; hubs: Hub<Id>[] }[] {
  const out: { group: string; hubs: Hub<Id>[] }[] = []
  for (const x of hubs) {
    const g = out.find((o) => o.group === x.group)
    if (g) g.hubs.push(x)
    else out.push({ group: x.group, hubs: [x] })
  }
  return out
}

const KEY = (hub: string) => `neutroncore_hub_${hub}`

export function rememberTab(hub: string, tab: string): void {
  try { localStorage.setItem(KEY(hub), tab) } catch { /* stockage indisponible */ }
}

export function recalledTab(hub: string): string | null {
  try { return localStorage.getItem(KEY(hub)) } catch { return null }
}
