// Atelier 3D : dire un contrôle avec des mots. Le rapport du pipeline est écrit pour un
// programme (« resistance:pivot_matage », « 27.7 pour 48 admissible ; MPa… ») ; ici on en
// tire un titre, une phrase et ce que ça implique. Rien n'est inventé : les nombres sont
// ceux du rapport, et le détail d'origine reste consultable.

import type { Controle } from './atelier'

type Famille = { label: string; ko: string }
// ce que vérifie chaque famille (le mot avant « : » dans le nom du contrôle), et ce qu'un échec veut dire
const FAMILLES: Record<string, Famille> = {
  interference: { label: 'collision entre pièces', ko: 'Ces pièces se traversent : elles ne peuvent pas être montées ensemble telles quelles.' },
  maintien: { label: 'pièce tenue en place', ko: 'Cette pièce n’est pas assez tenue : elle peut bouger ou sortir de son logement.' },
  fermeture: { label: 'fermeture du boîtier', ko: 'Le boîtier ne ferme pas correctement à cet endroit.' },
  paroi: { label: 'épaisseur de paroi', ko: 'La paroi est trop fine ici : fragile, ou difficile à imprimer proprement.' },
  balayage: { label: 'mouvement d’une pièce mobile', ko: 'En bougeant, cette pièce en touche une autre.' },
  resistance: { label: 'solidité', ko: 'La marge de sécurité est plus faible que celle demandée.' },
  montage: { label: 'ordre de montage', ko: 'Cette pièce ne peut pas être mise en place comme le prévoit le montage.' },
  stabilite: { label: 'stabilité', ko: 'L’objet risque de basculer dans cette position.' },
  jeu: { label: 'jeu entre pièces', ko: 'Pas assez de jeu : les pièces risquent de forcer ou de ne pas s’emboîter.' },
  enveloppe: { label: 'encombrement', ko: 'L’objet dépasse la taille maximale prévue.' },
  format: { label: 'encombrement', ko: 'L’objet dépasse le format prévu.' },
  nomenclature: { label: 'liste des pièces', ko: 'La liste des pièces à acheter ne correspond pas au modèle.' },
  maillage: { label: 'fichier 3D', ko: 'Le fichier 3D de cette pièce a un défaut : il risque de mal s’imprimer.' },
  step: { label: 'fichier d’échange', ko: 'Le fichier d’échange de cette pièce a un défaut.' },
  solide: { label: 'pièce d’un seul bloc', ko: 'La pièce n’est pas d’un seul bloc.' },
  impression: { label: 'impression 3D', ko: 'La pièce est difficile à imprimer telle quelle.' },
  depoudrage: { label: 'nettoyage après impression', ko: 'Une cavité ne peut pas être vidée de sa poudre ou de ses supports.' },
  arrondi: { label: 'arêtes arrondies', ko: 'Une arête reste trop vive.' },
  gonflement: { label: 'place pour la batterie', ko: 'Il n’y a pas assez de place pour le gonflement normal de la cellule.' },
  aeration: { label: 'aération', ko: 'L’air ne circule pas assez à cet endroit.' },
  acces: { label: 'accès', ko: 'Cet élément n’est pas accessible une fois l’objet monté.' },
  verrou: { label: 'verrouillage', ko: 'Le verrou ne tient pas ou ne s’engage pas correctement.' },
  usage: { label: 'usage', ko: 'L’objet ne remplit pas cette condition d’utilisation.' },
  rangement: { label: 'rangement', ko: 'Cet élément ne se range pas comme prévu.' },
  logo: { label: 'gravure', ko: 'La gravure ne respecte pas cette règle.' },
  patin: { label: 'patins', ko: 'Un patin n’est pas posé comme prévu.' },
  diametre: { label: 'diamètre', ko: 'Ce diamètre est hors de ce qui est demandé.' },
  fente: { label: 'fente', ko: 'Cette fente est hors de ce qui est demandé.' },
  regle: { label: 'règle de conception', ko: 'Une cote choisie dans la spec ne respecte pas cette règle de conception.' },
  empilement: { label: 'empilement', ko: 'Les boîtes ne s’empilent pas comme prévu.' },
  sortie: { label: 'sortie de câble', ko: 'Le câble ne sort pas comme prévu.' },
}
const DEFAUT: Famille = { label: '', ko: 'Ce point n’est pas conforme à ce qui est demandé.' }

// les noms du rapport sont sans accent : on les remet pour la lecture
const ACCENTS: Record<string, string> = {
  bequille: 'béquille', etrier: 'étrier', cote: 'côté', epaisseur: 'épaisseur', ecran: 'écran', telephone: 'téléphone',
  matage: 'écrasement au bord du trou', deversement: 'déversement', cable: 'câble', cables: 'câbles', arete: 'arête', aretes: 'arêtes',
  resistance: 'résistance', securite: 'sécurité', interieur: 'intérieur', exterieur: 'extérieur', levre: 'lèvre', portee: 'portée',
  fenetre: 'fenêtre', fenetres: 'fenêtres', charge: 'chargé', regle: 'règle', piece: 'pièce', pieces: 'pièces',
}

// une limite minuscule (0,001) ne doit pas s'écrire « 0 » : deux chiffres significatifs sous le centième
const nombre = (v: number) => String(Number(v !== 0 && Math.abs(v) < 0.01 ? v.toPrecision(2) : v.toFixed(2))).replace('.', ',')
// Object.hasOwn : un mot comme « constructor » ne doit pas aller chercher dans le prototype
const humain = (texte: string) => texte.split(/[_\s]+/).filter(Boolean).map((m) => (Object.hasOwn(ACCENTS, m.toLowerCase()) ? ACCENTS[m.toLowerCase()] : m)).join(' ')

export type Lecture = {
  famille: string        // « solidité »
  sujet: string          // « béquille flexion »
  titre: string          // « solidité — béquille flexion »
  phrase: string         // les nombres, dits simplement
  consequence: string    // ce qu'un échec veut dire (vide si le contrôle passe)
  ratio: number | null   // mesure / limite quand il manque de la marge (0..1), pour une jauge
  points: string[]       // le détail du rapport, découpé
}

/** « resistance:bequille_flexion » → titre, phrase et conséquence lisibles. */
export function lireControle(c: Controle): Lecture {
  const morceaux = c.nom.split(':')
  // « couvercle:jeu:pire_cas » : le premier mot nomme la pièce, la famille vient ensuite
  const rang = Object.hasOwn(FAMILLES, morceaux[0]) ? 0 : Math.max(0, morceaux.findIndex((m) => Object.hasOwn(FAMILLES, m)))
  const prefixe = morceaux[rang]
  const reste = morceaux.filter((_, i) => i !== rang)
  const fam = Object.hasOwn(FAMILLES, prefixe) ? FAMILLES[prefixe] : { ...DEFAUT, label: humain(prefixe) }
  const sujet = reste.join(' ').split('/').map((p) => humain(p)).join(' et ')
  const m = typeof c.mesure === 'number' && Number.isFinite(c.mesure) ? c.mesure : null
  const l = typeof c.limite === 'number' && Number.isFinite(c.limite) ? c.limite : null
  let phrase = ''
  let ratio: number | null = null
  if (c.nature === 'indicateur') phrase = m === null ? 'Valeur publiée sans verdict.' : `Valeur relevée : ${nombre(m)}.`
  else if (c.ok) phrase = m !== null && l !== null && (m !== 0 || l !== 0) ? `Conforme : ${nombre(m)} pour une limite de ${nombre(l)}.` : 'Conforme.'
  else if (m === null || l === null) phrase = 'Non conforme.'
  else if (prefixe === 'resistance') {
    // la mesure est une marge de sécurité (× 1 = à la limite de la rupture) ; un échec dont la mesure
    // dépasse la limite n'en est pas une : on ne dit pas « ça tient », on donne les deux nombres
    phrase = m >= l ? `Mesuré ${nombre(m)} ; le maximum admis est ${nombre(l)}.`
      : m >= 1 ? `Ça tient, avec une marge de sécurité de × ${nombre(m)} ; il en faut × ${nombre(l)}.`
        : `Ça casserait : l’effort dépasse ce que la pièce supporte (marge × ${nombre(m)}, il en faut × ${nombre(l)}).`
    ratio = l > 0 ? Math.max(0, Math.min(1, m / l)) : null
  } else if (m < l) {
    phrase = `Mesuré ${nombre(m)} ; il faut au moins ${nombre(l)}.`
    ratio = l > 0 ? Math.max(0, Math.min(1, m / l)) : null
  } else if (m > l) phrase = `Mesuré ${nombre(m)} ; le maximum admis est ${nombre(l)}.`
  else phrase = `Mesuré ${nombre(m)} pour une limite de ${nombre(l)}.`
  return {
    famille: fam.label, sujet, titre: [fam.label, sujet].filter(Boolean).join(' — '), phrase,
    consequence: c.ok || c.nature === 'indicateur' ? '' : fam.ko, ratio,
    points: (c.detail ?? '').split(/\s*;\s*/).map((p) => p.trim()).filter(Boolean),
  }
}

/** Texte de départ d'une demande de correction pour la boucle d'agents. */
export function demandeCorrection(c: Controle): string {
  const l = lireControle(c)
  return `Corriger le contrôle en échec « ${c.nom} » (${l.titre}). ${l.phrase}`
}
