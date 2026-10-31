import { useContext, useState } from 'react'
import './resume.css'
import { NavContext } from '../../App'
import { aDetail, cibleSolution, ECRANS_SOLUTION, elementsDetail, ouvrirNotifications, pastille, type Briefing, type Ligne, type SectionBriefing } from '../../lib/resume'
import { toast } from '../../lib/dialog'
import { Btn, Dot } from '../ui'

const GRAVITE = { ok: 'ok', info: 'information', warn: 'à surveiller', crit: 'critique' } as const

// Détail d'une section : chaque élément concerné (gravité, depuis quand) et la solution proposée avec son bouton.
function Detail({ s, id, ligne }: { s: SectionBriefing; id: string; ligne: number | null }) {
  const aller = useContext(NavContext)
  const items = elementsDetail(s)
  function agir(sol: Ligne['solution']) {
    const c = cibleSolution(sol, ECRANS_SOLUTION)
    if (!c) return
    if (c.kind === 'ecran') aller(c.id)
    else if (!ouvrirNotifications()) toast('le centre de notifications est la cloche de la barre du haut', 'warn')
  }
  return (
    <div className="rs-detail" id={id} role="region" aria-label={`détail : ${s.titre}`}>
      <ul>
        {items.map((l, i) => (
          <li key={i} className={`lv-${l.level} ${ligne === i ? 'sel' : ''}`}>
            <span className="rs-d-text"><Dot s={pastille(l.level)} /> {l.text}</span>
            <small>gravité : {GRAVITE[l.level]}{l.depuis ? ` · ${l.depuis}` : ''}</small>
            {l.detail && <small className="rs-d-detail">{l.detail}</small>}
            {l.solution && (
              <div className="rs-sol">
                <span>{l.solution.texte}</span>
                {cibleSolution(l.solution, ECRANS_SOLUTION) && <Btn sm onClick={() => agir(l.solution)}>{l.solution.bouton}</Btn>}
              </div>
            )}
          </li>
        ))}
        {s.cachees > 0 && items.length <= s.lignes.length && <li className="more">+{s.cachees} autres non détaillés</li>}
      </ul>
    </div>
  )
}

function Section({ s, interactif, uid }: { s: SectionBriefing; interactif: boolean; uid: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [ligne, setLigne] = useState<number | null>(null)
  const peut = interactif && aDetail(s)
  const id = `rs-d-${uid}-${s.id}`
  function ouvrir(i: number | null) { setLigne(i); setOuvert(i === null ? !ouvert : true) }
  return (
    <section className={`rs-sec lv-${s.niveau} ${ouvert ? 'open' : ''}`}>
      <h4>
        {peut ? (
          <button type="button" className="rs-toggle" aria-expanded={ouvert} aria-controls={id} onClick={() => ouvrir(null)}>
            <Dot s={pastille(s.niveau)} /> {s.titre}{s.total > 0 && <small>{s.total}</small>}
            <span className="rs-chev" aria-hidden>{ouvert ? '-' : '+'}</span>
          </button>
        ) : <><Dot s={pastille(s.niveau)} /> {s.titre}{s.total > 0 && <small>{s.total}</small>}</>}
      </h4>
      <ul>
        {s.lignes.map((l, i) => (
          <li key={i} className={`lv-${l.level}`}>
            {peut ? <button type="button" className="rs-line" aria-expanded={ouvert} aria-controls={id} onClick={() => ouvrir(i)}>{l.text}</button> : l.text}
          </li>
        ))}
        {s.cachees > 0 && <li className="more">+{s.cachees} autres</li>}
      </ul>
      {peut && ouvert && <Detail s={s} id={id} ligne={ligne} />}
    </section>
  )
}

// Le briefing tel que l'API l'a fabriqué : introduction puis une carte par section.
// `tv` : grandes lignes, sans interaction (mode télé). Sinon chaque section se déplie en détail + solution.
export function BriefingView({ b, tv = false }: { b: Briefing; tv?: boolean }) {
  return (
    <div className={`rs-brief ${tv ? 'tv' : ''}`}>
      {b.intro && <p className="rs-intro">{b.intro}</p>}
      {b.ia && <p className="rs-ia" title="reformulé par le modèle local">{b.ia}</p>}
      {b.ia_erreur && <p className="rs-note">{b.ia_erreur}</p>}
      <div className="rs-secs">
        {b.sections.map((s) => <Section key={s.id} s={s} interactif={!tv} uid={b.date} />)}
        {b.sections.length === 0 && <p className="rs-note">aucune section activée : active-en dans les réglages</p>}
      </div>
    </div>
  )
}
