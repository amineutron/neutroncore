import { useEffect, useRef, useState } from 'react'
import { apiBinary } from '../../lib/api'
import type { Etats, Piece } from '../../lib/atelier'
import type { AtelierScene } from '../../lib/atelierScene'
import { camIso } from '../../lib/atelierFilm'

// Petite vue 3D d'une question : on tourne autour des pièces dont elle parle (glisser, molette, deux doigts).
// Sans le mode fantôme, elles sont seules ; avec, le reste de l'objet les entoure en transparence et elles
// sont mises en avant.
export function Mini3D({ modele, pieces, concernees, enAvant, fantome, haut }: {
  modele: string; pieces: Piece[]; concernees: string[]; fantome: boolean; haut: 'y' | 'z'
  enAvant: string[]       // en mode fantôme, seules celles-ci restent pleines : une pièce qui enveloppe les autres passe en décor
}) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<AtelierScene | null>(null)
  const [etat, setEtat] = useState<'charge' | 'pret' | 'erreur'>('charge')
  const utiles = pieces.filter((p) => p.groupe !== 'gabarits')
  const cle = `${modele}|${haut}|${utiles.map((p) => p.chemin).join(',')}|${concernees.join(',')}`
  const appliquer = (s: AtelierScene) => {
    s.setEtats(Object.fromEntries(utiles.map((p) => [p.nom, fantome ? (enAvant.includes(p.nom) ? 'shown' : 'ghost') : concernees.includes(p.nom) ? 'shown' : 'hidden'])) as Etats)
    s.setSelection(fantome ? enAvant : [])
  }

  // vue isométrique du côté où se trouvent les pièces mises en avant : rien ne passe devant elles
  const viser = (s: AtelierScene) => s.orbit(camIso(enAvant, s.bounds()), concernees)

  useEffect(() => {
    let dead = false
    let creee: AtelierScene | null = null
    setEtat('charge')
    void import('../../lib/atelierScene').then(async ({ AtelierScene: Scene }) => {
      if (dead || !host.current) return
      creee = new Scene(host.current, { onPick: () => { /* lecture seule */ }, onMeasure: () => { /* pas de mesure ici */ } })
      scene.current = creee
      const centres = await creee.load(utiles, (chemin) => apiBinary(`/modelisation/${modele}/fichier?chemin=${encodeURIComponent(chemin)}`), () => { /* petit modèle : pas de barre */ }, haut)
      if (dead || !centres) return
      appliquer(creee)
      viser(creee)
      setEtat(Object.keys(centres).length > 0 ? 'pret' : 'erreur')
    }).catch(() => { if (!dead) setEtat('erreur') })
    return () => { dead = true; creee?.dispose(); scene.current = null }
  }, [cle]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (scene.current && etat === 'pret') appliquer(scene.current) }, [fantome, etat]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="iz-3d">
      <div className="iz-3d-toile" ref={host} role="img" aria-label={`Vue 3D : ${concernees.join(', ')}`} />
      {etat === 'charge' && <span className="iz-3d-note">chargement de la vue 3D…</span>}
      {etat === 'erreur' && <span className="iz-3d-note err">la vue 3D n’a pas pu être chargée</span>}
      {etat === 'pret' && <button type="button" className="btn sm iz-3d-cadrer" onClick={() => { if (scene.current) viser(scene.current) }}>recadrer</button>}
    </div>
  )
}
