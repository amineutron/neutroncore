import { ALT_MAX_FT, basculerDans, modifier, type Filtres } from '../../lib/godeye/filtres'
import { CATEGORIES_EVENEMENT, COUCHES, GROUPES_SAT, THEMES, type CoucheId, type SourceInfo } from '../../lib/godeye/modele'
import { Bloc, Case, Curseur, Puces } from './Champs'

type Props = { f: Filtres; onChange: (f: Filtres) => void; couvreAvions: string; sourcesInfos: SourceInfo[] }
const niveauVol = (ft: number): string => `FL${String(Math.round(ft / 100)).padStart(3, '0')}`

/** Réglages propres à chaque couche : n'apparaissent que pour une couche allumée. */
export function FiltresCouche({ id, f, onChange, couvreAvions, sourcesInfos }: Props & { id: CoucheId }) {
  const set = <K extends keyof Filtres>(cle: K, v: Partial<Filtres[K]>) => onChange(modifier(f, cle, v))
  switch (id) {
    case 'infos':
      return (
        <Bloc>
          <Puces options={THEMES.map((t) => ({ id: t.id, nom: t.nom }))} actives={f.infos.themes}
            onBasculer={(t) => set('infos', { themes: basculerDans(f.infos.themes, t) })} />
          <label className="ge-curseur"><span className="ge-curseur-t">importance</span>
            <select value={f.infos.niveauMin} onChange={(e) => set('infos', { niveauMin: e.target.value === 'crit' ? 'crit' : e.target.value === 'warn' ? 'warn' : 'info' })}>
              <option value="info">tout</option><option value="warn">importantes et critiques</option><option value="crit">critiques seulement</option>
            </select>
          </label>
          <Curseur label="fraîcheur max." valeur={f.infos.heures} min={1} max={72} pas={1} format={(v) => (v >= 72 ? '3 jours' : `${v} h`)} onChange={(heures) => set('infos', { heures })} />
          {sourcesInfos.length > 0 && (
            <>
              <div className="ge-bloc-t">sources {f.infos.sources.length ? `(${f.infos.sources.length} choisie${f.infos.sources.length > 1 ? 's' : ''})` : '(toutes)'}</div>
              <Puces options={sourcesInfos.map((s) => ({ id: s.id, nom: s.ok ? s.nom : `${s.nom} (en panne)` }))} actives={f.infos.sources}
                onBasculer={(s) => set('infos', { sources: basculerDans(f.infos.sources, s) })} />
            </>
          )}
          <Case label="avec un lieu seulement (sur la carte)" on={f.infos.avecLieu} onChange={(avecLieu) => set('infos', { avecLieu })} />
          <p className="ge-note">Les titres sont classés par mots-clés (guerre, diplomatie, économie, cyber, sécurité, catastrophes) et placés sur le pays le plus cité. Sans lieu connu, un article reste dans le fil mais pas sur la carte. Aucune source choisie = toutes.</p>
        </Bloc>
      )
    case 'seismes':
      return (
        <Bloc>
          <Curseur label="magnitude min." valeur={f.seismes.magMin} min={2.5} max={8} pas={0.5} format={(v) => `M${v}+`} onChange={(magMin) => set('seismes', { magMin })} />
          <Curseur label="profondeur max." valeur={f.seismes.profMax} min={10} max={700} pas={10} format={(v) => (v >= 700 ? 'toutes' : `${v} km`)} onChange={(profMax) => set('seismes', { profMax })} />
          <label className="ge-curseur"><span className="ge-curseur-t">période</span>
            <select value={f.seismes.periode} onChange={(e) => set('seismes', { periode: e.target.value === 'semaine' ? 'semaine' : 'jour' })}>
              <option value="jour">24 h</option><option value="semaine">7 jours</option>
            </select>
          </label>
        </Bloc>
      )
    case 'avions':
      return (
        <Bloc>
          <label className="ge-curseur"><span className="ge-curseur-t">origine</span>
            <select value={f.avions.mode} onChange={(e) => set('avions', { mode: e.target.value === 'militaires' ? 'militaires' : 'zone' })}>
              <option value="zone">autour de la zone visible</option>
              <option value="militaires">militaires du monde entier</option>
            </select>
          </label>
          {f.avions.mode === 'zone' && <p className="ge-note">Les avions sont lus dans un cercle de 250 milles au plus autour du centre de la carte : zoomer pour couvrir une région.{couvreAvions && ` Actuellement : ${couvreAvions}.`}</p>}
          <Curseur label="altitude min." valeur={f.avions.altMin} min={0} max={ALT_MAX_FT} pas={1000} format={niveauVol} onChange={(altMin) => set('avions', { altMin })} />
          <Curseur label="altitude max." valeur={f.avions.altMax} min={0} max={ALT_MAX_FT} pas={1000} format={niveauVol} onChange={(altMax) => set('avions', { altMax })} />
          <Curseur label="vitesse min." valeur={f.avions.vitesseMin} min={0} max={700} pas={25} format={(v) => `${v} kt`} onChange={(vitesseMin) => set('avions', { vitesseMin })} />
          <div className="ge-cases">
            <Case label="militaires seulement" on={f.avions.militairesSeuls} onChange={(militairesSeuls) => set('avions', { militairesSeuls })} />
            <Case label="urgences seulement (7500, 7600, 7700)" on={f.avions.urgencesSeules} onChange={(urgencesSeules) => set('avions', { urgencesSeules })} />
            <Case label="avions au sol" on={f.avions.sol} onChange={(sol) => set('avions', { sol })} />
          </div>
        </Bloc>
      )
    case 'satellites':
      return (
        <Bloc>
          <Puces options={GROUPES_SAT} actives={f.satellites.groupes} onBasculer={(g) => set('satellites', { groupes: basculerDans(f.satellites.groupes, g) })} />
          <Curseur label="altitude max." valeur={f.satellites.altMaxKm} min={300} max={40_000} pas={100} format={(v) => (v >= 40_000 ? 'toutes' : `${v} km`)} onChange={(altMaxKm) => set('satellites', { altMaxKm })} />
          <p className="ge-note">Touche un satellite : sa trace au sol sur les 100 prochaines minutes s'affiche.</p>
        </Bloc>
      )
    case 'navires':
      return (
        <Bloc>
          <Curseur label="vitesse min." valeur={f.navires.vitesseMin} min={0} max={40} pas={1} format={(v) => (v === 0 ? 'tous' : `${v} nœuds`)} onChange={(vitesseMin) => set('navires', { vitesseMin })} />
          <p className="ge-note">Seule source libre sans clé : la Baltique et le golfe de Finlande (Digitraffic).</p>
        </Bloc>
      )
    case 'evenements':
      return (
        <Bloc>
          <Puces options={CATEGORIES_EVENEMENT} actives={f.evenements.categories} onBasculer={(c) => set('evenements', { categories: basculerDans(f.evenements.categories, c) })} />
          <Curseur label="ancienneté max." valeur={f.evenements.jours} min={1} max={90} pas={1} format={(v) => `${v} j`} onChange={(jours) => set('evenements', { jours })} />
        </Bloc>
      )
    case 'cyber':
      return (
        <Bloc>
          <label className="ge-curseur"><span className="ge-curseur-t">afficher dès</span>
            <select value={f.cyber.niveauMin} onChange={(e) => set('cyber', { niveauMin: e.target.value === 'crit' ? 'crit' : e.target.value === 'warn' ? 'warn' : 'info' })}>
              <option value="info">tous les niveaux</option><option value="warn">attention</option><option value="crit">critique</option>
            </select>
          </label>
        </Bloc>
      )
  }
}

export const nomCouche = (id: CoucheId): string => COUCHES.find((c) => c.id === id)?.nom ?? id
