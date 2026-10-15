import { useEffect, useState } from 'react'
import { apiBinary } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { piecesDuPoint, piecesEnAvant, pieceLabel, type Etats, type Piece, type PointAttente } from '../../lib/atelier'
import { camIso } from '../../lib/atelierFilm'
import type { Boites } from '../../lib/atelierMontage'
import type { ViewerHandle } from './Viewer'
import { ImageZoom } from '../ImageZoom'
import { Mini3D } from './Mini3D'

// Vignette d'une question, en vue isométrique : les pièces dont on parle, seules et nettes — ou, « avec le
// contexte », tout le reste en fantôme autour pour situer la zone.
function etatVignette(p: Piece, concernees: string[], contexte: boolean): 'shown' | 'ghost' | 'hidden' {
  if (concernees.includes(p.nom)) return 'shown'
  return contexte && p.groupe !== 'gabarits' ? 'ghost' : 'hidden'
}

// image ouverte en grand : un fichier de la boucle (`url`), ou la vue 3D d'une question (`question`), qui suit
// alors le réglage « avec le contexte »
type Grand = { url: string; titre: string; aLiberer?: boolean; clair?: boolean; question?: number; auto?: boolean; option?: string }      // `auto` : l'image est la vue 3D de la question, pas un fichier de la boucle

// Image d'une question, lue par l'API authentifiée (png ou gif). Rien ne s'affiche si elle manque.
function ImageQuestion({ modele, chemin, alt, question, option, onGrand }: { modele: string; chemin: string; alt: string; question: number; option?: string; onGrand: (g: Grand) => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let dead = false
    let cree = ''
    setUrl('')
    void apiBinary(`/modelisation/${modele}/fichier?chemin=${encodeURIComponent(chemin)}`).then((octets) => {
      if (dead) return
      cree = URL.createObjectURL(new Blob([octets], { type: chemin.endsWith('.gif') ? 'image/gif' : 'image/png' }))
      setUrl(cree)
    }).catch(() => { /* image absente : la question reste lisible sans elle */ })
    return () => { dead = true; if (cree) URL.revokeObjectURL(cree) }
  }, [modele, chemin])
  if (!url) return null
  return <button type="button" className="at-q-img plan" title="Agrandir" onClick={() => onGrand({ url, titre: alt, clair: true, question, option })}><img src={url} alt={alt} /></button>
}

// Les questions de la boucle, illustrées : le mini-plan fourni par la boucle, sinon une vue 3D des pièces
// dont la question parle (les autres en fantôme). Chaque solution proposée a sa carte et son image.
export function Questions({ modele, points, pieces, boites, haut, viewer, pret, onFocus }: {
  modele: string; points: PointAttente[]; pieces: Piece[]; boites: Boites; haut: 'y' | 'z'; viewer: React.RefObject<ViewerHandle | null>; pret: boolean
  onFocus: (noms: string[]) => void
}) {
  const noms = pieces.filter((p) => p.groupe !== 'gabarits').map((p) => p.nom)
  const liees = points.map((p) => piecesDuPoint(p, noms))
  // deux vues 3D par question qui nomme des pièces, même si la boucle a fourni son image : les pièces seules, puis
  // la vue fantôme (le reste de l'objet en transparence, les pièces en question mises en avant)
  const [vues, setVues] = useState<{ key: string; images: { seules: string; contexte: string }[] }>({ key: '', images: [] })
  const [contexte, setContexte] = useState<number[]>([])
  const [grand, setGrandEtat] = useState<Grand | null>(null)
  const [fantome, setFantome] = useState(false)       // vue fantôme dans la fenêtre ouverte
  const [mode3d, setMode3d] = useState(false)         // dans la fenêtre : l'image, ou une vraie vue 3D qu'on fait tourner
  const setGrand = (g: Grand | null) => { setGrandEtat(g); setMode3d(false); setFantome(g?.question !== undefined && g.auto === true && contexte.includes(g.question)) }
  const key = pret ? `${modele}|${liees.map((l) => l.join(',')).join('|')}|${noms.join(',')}` : ''
  useEffect(() => {
    if (!key || vues.key === key) return
    const t = window.setTimeout(() => {
      const aFaire = liees.map((l) => (l.length === 0 ? null : l))
      const poses = aFaire.flatMap((l) => (l ? [false, true].map((ctx) => ({
        etats: Object.fromEntries(pieces.map((p) => [p.nom, etatVignette(p, ctx ? piecesEnAvant(l, boites) : l, ctx)])) as Etats, cam: camIso(ctx ? piecesEnAvant(l, boites) : l, boites), cible: l, accent: ctx ? piecesEnAvant(l, boites) : [],
      })) : []))
      const rendues = poses.length ? viewer.current?.thumbnails(poses, 1200, 800) ?? [] : []
      let rang = 0
      setVues({ key, images: aFaire.map((l) => (l ? { seules: rendues[rang++] ?? '', contexte: rendues[rang++] ?? '' } : { seules: '', contexte: '' })) })
    }, 500)
    return () => window.clearTimeout(t)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // plan détaillé de la boucle : chargé à la demande, libéré à la fermeture
  const ouvrirDetail = async (chemin: string, titre: string, question: number) => {
    try {
      const octets = await apiBinary(`/modelisation/${modele}/fichier?chemin=${encodeURIComponent(chemin)}`)
      setGrand({ url: URL.createObjectURL(new Blob([octets], { type: chemin.endsWith('.gif') ? 'image/gif' : 'image/png' })), titre, aLiberer: true, clair: true, question })
    } catch { toast('plan détaillé illisible', 'crit') }
  }
  const fermer = () => { if (grand?.aLiberer) URL.revokeObjectURL(grand.url); setGrand(null) }

  const basculer = (i: number) => setContexte((c) => (c.includes(i) ? c.filter((n) => n !== i) : [...c, i]))

  return (
    <ol className="at-questions">
      {points.map((p, i) => {
        const paire = vues.key === key ? vues.images[i] : undefined
        const avecContexte = contexte.includes(i)
        const vue = (avecContexte ? paire?.contexte : paire?.seules) ?? ''
        return (
          <li key={`${i}-${p.texte}`} className={p.image || vue ? 'illustree' : ''}>
            {p.image && !(avecContexte && paire?.contexte)
              ? <ImageQuestion modele={modele} chemin={p.image} alt={`Mini-plan de la question ${i + 1}`} question={i} onGrand={setGrand} />
              : vue && <button type="button" className="at-q-img" title="Agrandir" onClick={() => setGrand({ url: vue, titre: `Question ${i + 1} : ${liees[i].map(pieceLabel).join(', ')}`, question: i, auto: true })}><img src={vue} alt={`Pièces concernées : ${liees[i].map(pieceLabel).join(', ')}`} /></button>}
            <div className="at-q-corps">
              <p><b>{i + 1}.</b> {p.texte}</p>
              {liees[i].length > 0 && (
                <div className="at-row">
                  <button type="button" className="btn sm" onClick={() => onFocus(liees[i])} title="Ces pièces restent nettes dans la vue 3D, le reste passe en fantôme">voir dans la vue</button>
                  {paire?.contexte && (
                    <button type="button" className={`btn sm ${avecContexte ? 'solid' : ''}`} aria-pressed={avecContexte} title="Vue 3D : le reste de l'objet en fantôme, les pièces en question mises en avant"
                      onClick={() => basculer(i)}>vue fantôme</button>
                  )}
                  {p.detail && <button type="button" className="btn sm" onClick={() => void ouvrirDetail(p.detail, `Plan détaillé de la question ${i + 1}`, i)}>plan détaillé</button>}
                  <span className="at-q-pieces">{liees[i].map(pieceLabel).join(' · ')}</span>
                </div>
              )}
              {liees[i].length === 0 && p.detail && <div className="at-row"><button type="button" className="btn sm" onClick={() => void ouvrirDetail(p.detail, `Plan détaillé de la question ${i + 1}`, i)}>plan détaillé</button></div>}
              {p.options.length > 0 && (
                <div className="at-q-options">
                  {p.options.map((o) => (
                    <figure key={o.nom || o.texte} className={p.recommande && o.nom === p.recommande ? 'conseillee' : ''}>
                      {o.image && <ImageQuestion modele={modele} chemin={o.image} alt={`Option ${o.nom} de la question ${i + 1}`} question={i} option={o.nom || o.texte} onGrand={setGrand} />}
                      <figcaption>{o.nom && <b>{o.nom}</b>}{p.recommande && o.nom === p.recommande && <i>conseillée</i>}<span>{o.texte}</span></figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </li>
        )
      })}
      {grand && (() => {
        const q = grand.question
        const point = q !== undefined ? points[q] : undefined
        const concernees = q !== undefined ? liees[q] : []
        const paire = q !== undefined && vues.key === key ? vues.images[q] : undefined
        const en3d = mode3d && concernees.length > 0
        const option = point?.options.find((o) => (o.nom || o.texte) === grand.option)
        return (
          <ImageZoom url={(grand.auto && (fantome ? paire?.contexte : paire?.seules)) || grand.url} titre={grand.titre} clair={grand.auto ? false : grand.clair} onClose={fermer}
            corps={en3d ? <Mini3D modele={modele} pieces={pieces} concernees={concernees} enAvant={piecesEnAvant(concernees, boites)} fantome={fantome} haut={haut} /> : undefined}
            texte={point && <>
              <h4>question {q! + 1}</h4>
              <p>{point.texte}</p>
              {option && <div className={`iz-option ${point.recommande && option.nom === point.recommande ? 'conseillee' : ''}`}>
                <b>option {option.nom}{point.recommande && option.nom === point.recommande ? ' · conseillée' : ''}</b><p>{option.texte}</p></div>}
              {concernees.length > 0 && <p className="iz-pieces">pièces : {concernees.map(pieceLabel).join(' · ')}</p>}
            </>}
            outils={concernees.length > 0 ? <>
              <span className="at-seg iz-mode" role="group" aria-label="Ce que montre la fenêtre">
                <button type="button" className={en3d ? '' : 'on'} aria-pressed={!en3d} onClick={() => setMode3d(false)}>image</button>
                <button type="button" className={en3d ? 'on' : ''} aria-pressed={en3d} title="Vue 3D des pièces : glisser pour tourner, molette pour zoomer" onClick={() => setMode3d(true)}>3d</button>
              </span>
              <button type="button" className={`btn sm iz-fantome ${fantome && (en3d || grand.auto) ? 'solid' : ''}`} aria-pressed={fantome && (en3d || Boolean(grand.auto))}
                title="Le reste de l'objet en fantôme autour des pièces en question, qui sont mises en avant"
                onClick={() => { if (!en3d && !grand.auto) { setMode3d(true); setFantome(true) } else setFantome(!fantome) }}>mode fantôme</button>
            </> : undefined} />
        )
      })()}
    </ol>
  )
}
