import { ligneEtat, type EntreeEtat } from '../../lib/spatialSimple'

/** Une ligne qui dit ce que font les lampes : « 7 lampes reliées, son entendu, tempo 108, rien ne joue »,
 * puis, s'il y en a, ce qui cloche. */
export function EtatLigne({ etat }: { etat: EntreeEtat }) {
  const l = ligneEtat(etat)
  return (
    <div className="lu-etat" role="status" aria-label={l.phrase}>
      <div className="lu-etat-ligne">
        {l.pastilles.map((p) => <span key={p.texte} className={`chip ${p.ton === 'info' ? '' : p.ton}`}>{p.texte}</span>)}
      </div>
      {l.avertissements.map((a) => <p key={a.texte} className={`lu-etat-avert ${a.ton}`}>{a.texte}</p>)}
    </div>
  )
}
