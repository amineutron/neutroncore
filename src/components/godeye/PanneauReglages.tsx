import { ELEMENTS, ELEMENTS_DEFAUT, type ElementId, type Elements } from '../../lib/godeye/elements'
import { FILTRES_DEFAUT, modifier, type Filtres } from '../../lib/godeye/filtres'
import { appliquerDepuis, depuisCourant, DEPUIS, HEURES_SEISMES, libelleHeures } from '../../lib/godeye/periode'
import { Case, Curseur } from './Champs'
import { SectionCarte } from './SectionCarte'
import { SectionAvance } from './SectionAvance'

type Props = { f: Filtres; onChange: (f: Filtres) => void; elements: Elements; onElements: (e: Elements) => void }

/** Une section qui se déplie (balise native : clavier et lecteur d'écran gérés par le navigateur). */
function Section({ titre, resume, ouvert = false, children }: { titre: string; resume?: string; ouvert?: boolean; children: React.ReactNode }) {
  return (
    <details className="ge-section" open={ouvert}>
      <summary><span className="ge-section-t">{titre}</span>{resume && <span className="ge-section-r">{resume}</span>}</summary>
      <div className="ge-section-c">{children}</div>
    </details>
  )
}

/** Réglages de la scène : depuis combien de temps on prend les données (par rapport à maintenant) et ce qui est affiché. */
export function PanneauReglages({ f, onChange, elements, onElements }: Props) {
  const depuis = depuisCourant(f)
  const d = FILTRES_DEFAUT
  const origine = f.infos.heures === d.infos.heures && f.seismes.heures === d.seismes.heures && f.evenements.jours === d.evenements.jours
  const masques = ELEMENTS.filter((e) => !elements[e.id]).length
  const basculer = (id: ElementId, v: boolean) => onElements({ ...elements, [id]: v })
  const coupee = (c: 'infos' | 'seismes' | 'evenements'): string => (f.couches[c] ? '' : ' (couche coupée)')
  return (
    <div className="ge-reglages">
      <Section titre="depuis combien de temps" resume={depuis ? `tout depuis ${libelleHeures(depuis)}` : origine ? 'durées d\'origine' : 'personnalisé'} ouvert>
        <p className="ge-note">Âge maximal des données, compté à partir de maintenant : plus rien de plus ancien n'est affiché.</p>
        <div className="ge-bloc-t">tout depuis</div>
        <div className="ge-seg" role="group" aria-label="durée commune">
          {DEPUIS.map((d) => (
            <button key={d.heures} type="button" className={depuis === d.heures ? 'on' : ''} aria-pressed={depuis === d.heures} onClick={() => onChange(appliquerDepuis(f, d.heures))}>{d.nom}</button>
          ))}
        </div>
        <div className="ge-bloc-t">ou source par source</div>
        <Curseur label={`actualités${coupee('infos')}`} valeur={f.infos.heures} min={1} max={72} pas={1} format={(v) => (v >= 72 ? '3 jours' : `${v} h`)}
          onChange={(heures) => onChange(modifier(f, 'infos', { heures }))} />
        <label className="ge-curseur"><span className="ge-curseur-t">{`séismes${coupee('seismes')}`}</span>
          <select value={f.seismes.heures} onChange={(e) => onChange(modifier(f, 'seismes', { heures: Number(e.target.value) }))}>
            {HEURES_SEISMES.map((h) => <option key={h} value={h}>{libelleHeures(h)}</option>)}
            {!HEURES_SEISMES.includes(f.seismes.heures) && <option value={f.seismes.heures}>{libelleHeures(f.seismes.heures)}</option>}
          </select>
        </label>
        <Curseur label={`événements${coupee('evenements')}`} valeur={f.evenements.jours} min={1} max={90} pas={1} format={(v) => (v === 1 ? '24 h' : `${v} jours`)}
          onChange={(jours) => onChange(modifier(f, 'evenements', { jours }))} />
        <p className="ge-note">Avions, navires et satellites sont toujours des positions du moment : rien à régler ici. Les actualités plafonnent à 3 jours (ce que gardent les flux).</p>
        <button type="button" className="ge-lien" onClick={() => onChange({ ...f, infos: { ...f.infos, heures: FILTRES_DEFAUT.infos.heures }, seismes: { ...f.seismes, heures: FILTRES_DEFAUT.seismes.heures }, evenements: { ...f.evenements, jours: FILTRES_DEFAUT.evenements.jours } })}>remettre les durées d'origine</button>
      </Section>
      <Section titre="éléments affichés" resume={masques ? `${masques} masqué${masques > 1 ? 's' : ''}` : 'tout'} ouvert>
        {ELEMENTS.map((e) => (
          <div key={e.id} className="ge-element">
            <Case label={e.nom} on={elements[e.id]} onChange={(v) => basculer(e.id, v)} title={e.aide} />
            <span className="ge-element-a">{e.aide}</span>
          </div>
        ))}
        <button type="button" className="ge-lien" disabled={masques === 0} onClick={() => onElements(ELEMENTS_DEFAUT)}>tout réafficher</button>
      </Section>
      <SectionCarte elements={elements} onElements={onElements} />
      <SectionAvance />
    </div>
  )
}
