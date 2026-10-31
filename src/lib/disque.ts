// Ce qui remplit un disque : types, mise en forme (logique pure) et ouverture de la fenêtre
// depuis n'importe où (alerte de l'accueil, notification, palette).

export type Dossier = { chemin: string; octets: number; jours: number; profondeur: number }
export type Analyse = {
  total: number; gros: Dossier[]; oublies: Dossier[]; critere: 'acces' | 'modification'
  at: number; duree_s?: number; illisibles?: number; erreur?: string
}
export type Disque = { path: string; total: number; free: number; used_pct: number; analyse_at: number | null; en_cours: boolean }
export type AnalyseReponse = { chemin: string; en_cours: boolean; depuis: number | null; resultat: Analyse | null }

/** 1536 -> « 1,5 Ko », 52 Go, 1,2 To (puissances de 1024, virgule française). */
export function taille(octets: number): string {
  const unites = ['o', 'Ko', 'Mo', 'Go', 'To']
  let v = Math.max(0, octets), i = 0
  while (v >= 1024 && i < unites.length - 1) { v /= 1024; i++ }
  const texte = v >= 100 || i === 0 ? Math.round(v).toString() : v.toFixed(1).replace('.', ',')
  return `${texte} ${unites[i]}`
}

/** Ancienneté du dernier accès : « aujourd'hui », « il y a 12 jours », « il y a 4 mois », « il y a 2 ans ». */
export function anciennete(jours: number): string {
  if (jours <= 0) return 'aujourd’hui'
  if (jours < 60) return `il y a ${jours} jour${jours > 1 ? 's' : ''}`
  if (jours < 730) return `il y a ${Math.round(jours / 30)} mois`
  return `il y a ${Math.floor(jours / 365)} ans`
}

/** Part d'un dossier dans le disque, pour la barre (0 à 100). */
export function part(octets: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((octets / total) * 1000) / 10) : 0
}

const EVENEMENT = 'neutroncore:disque'

/** Ouvre la fenêtre du disque (monté une fois dans App). `chemin` vide = le plus rempli. */
export function ouvrirDisque(chemin = ''): void {
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: chemin }))
}

export function surOuvrirDisque(cb: (chemin: string) => void): () => void {
  const ecoute = (e: Event) => cb(String((e as CustomEvent).detail ?? ''))
  window.addEventListener(EVENEMENT, ecoute)
  return () => window.removeEventListener(EVENEMENT, ecoute)
}
