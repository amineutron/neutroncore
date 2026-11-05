// Jeux de couleurs personnalisés : des palettes nommées que l'on compose une fois (à la main, depuis une pochette, une
// photo...) puis que l'on repose d'un clic sur n'importe quel pad (une scène enregistrée). Logique pure, testée dans
// jeuxCouleurs.test.ts ; seule la dernière section touche au stockage du navigateur, et sans jamais planter.
import { ecrireStocke, lireStocke } from './ciDeps'
import { MAX_COULEURS } from './spatialPalette'

export type JeuCouleurs = { id: string; nom: string; couleurs: string[] }

export const CLE_JEUX = 'neutroncore_jeux_couleurs'
export const MAX_JEUX = 24
export const NOM_MAX = 24

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Ne garde que de vraies couleurs, en `#rrggbb` minuscule (le `#` manquant est ajouté, `#rgb` est développé), au plus MAX_COULEURS. */
export function nettoyerCouleurs(brutes: readonly unknown[]): string[] {
  const sortie: string[] = []
  for (const c of brutes) {
    if (typeof c !== 'string') continue
    const m = HEX.exec(c.trim())
    if (!m) continue
    const v = m[1].toLowerCase()
    sortie.push(`#${v.length === 3 ? [...v].map((x) => x + x).join('') : v}`)
    if (sortie.length === MAX_COULEURS) break
  }
  return sortie
}

const nettoyerNom = (nom: string): string => nom.trim().slice(0, NOM_MAX).trim()
const cleDeNom = (nom: string): string => nom.trim().toLocaleLowerCase('fr')

/** Identifiant lisible tiré du nom, rendu unique parmi `existants` (« ete », « ete-2 »...). */
function idUnique(nom: string, existants: readonly string[]): string {
  const base = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'jeu'
  let id = base
  for (let n = 2; existants.includes(id); n++) id = `${base}-${n}`
  return id
}

/** La liste avec ce jeu en plus ; un jeu du même nom (casse et espaces ignorés) est remplacé à sa place. N'altère pas `jeux`. */
export function ajouterJeu(jeux: readonly JeuCouleurs[], nom: string, couleurs: readonly string[]): JeuCouleurs[] {
  const propre = nettoyerNom(nom)
  if (!propre) throw new Error('donne un nom à ce jeu de couleurs')
  const valides = nettoyerCouleurs(couleurs)
  if (valides.length === 0) throw new Error('il faut au moins une couleur valide')
  const rang = jeux.findIndex((j) => cleDeNom(j.nom) === cleDeNom(propre))
  if (rang >= 0) return jeux.map((j, i) => (i === rang ? { id: j.id, nom: propre, couleurs: valides } : j))
  if (jeux.length >= MAX_JEUX) throw new Error(`limite de ${MAX_JEUX} jeux atteinte : retires-en un d’abord (trop de jeux)`)
  return [...jeux, { id: idUnique(propre, jeux.map((j) => j.id)), nom: propre, couleurs: valides }]
}

export const retirerJeu = (jeux: readonly JeuCouleurs[], id: string): JeuCouleurs[] => jeux.filter((j) => j.id !== id)

// ── Persistance (localStorage) ──────────────────────────────────────────────────────────────────────────────────────

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Relit les jeux gardés ; ignore les entrées abîmées sans perdre les bonnes. */
export function charger(cle: string = CLE_JEUX, stockage?: Pick<Storage, 'getItem'> | null): JeuCouleurs[] {
  const lu = lireStocke(cle, { jeux: [] as unknown[] }, stockage)   // `undefined` : le localStorage du navigateur
  const sortie: JeuCouleurs[] = []
  for (const e of lu.jeux) {
    if (!estObjet(e) || typeof e.id !== 'string' || typeof e.nom !== 'string' || !Array.isArray(e.couleurs)) continue
    const nom = nettoyerNom(e.nom)
    const couleurs = nettoyerCouleurs(e.couleurs)
    if (!e.id || !nom || couleurs.length === 0 || sortie.some((j) => j.id === e.id)) continue
    sortie.push({ id: e.id, nom, couleurs })
    if (sortie.length === MAX_JEUX) break
  }
  return sortie
}

export function enregistrer(cle: string, jeux: readonly JeuCouleurs[], stockage?: Pick<Storage, 'setItem'> | null): void {
  ecrireStocke(cle, { jeux }, stockage)
}
