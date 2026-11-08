import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Vue } from '../../lib/vueMonde'
import { CLE_ELEMENTS, lireElements } from '../../lib/godeye/elements'
import { appliquer } from '../../lib/godeye/filtres'
import type { Boite } from '../../lib/godeye/modele'
import { alaUne } from '../../lib/godeye/une'
import { CLE_FILTRES_COURANTS, filtresCourants } from '../../lib/godeye/vues'
import { cadreTele, CLE_TELE, globePourMode, lireTele, MODES_TELE, VITESSES_TELE, vitesseDegres, type ModeTele, type ReglageTele } from '../../lib/godeye/tele'
import { Bandeau } from './Bandeau'
import { CarteGodEye } from './CarteGodEye'
import { Resume } from './Resume'
import { useListeZones } from './useAvance'
import { useDonnees } from './useDonnees'
import type { VueHandle } from './vues'
import './godeye.css'
import './stage.css'
import './avance.css'

const GlobeGodEye = lazy(() => import('./GlobeGodEye').then((m) => ({ default: m.GlobeGodEye })))
const lire = (cle: string): string | null => { try { return localStorage.getItem(cle) } catch { return null } }
const NIVEAU = 'ok' as const

/**
 * God Eye pour le tableau de bord de la télé. Trois modes : plan (carte à plat), rotation (globe qui tourne seul) et zone
 * (une zone surveillée précise, carte à plat cadrée dessus), plus le résumé du matin en surimpression. Les couches et filtres
 * sont ceux réglés en dernier dans l'écran God Eye ; aucune interaction n'est nécessaire.
 */
export function GodEyeTele({ reglages: initial }: { reglages?: ReglageTele }) {
  const [r, setR] = useState<ReglageTele>(() => initial ?? lireTele(lire(CLE_TELE)))
  const [filtres] = useState(() => filtresCourants(lire(CLE_FILTRES_COURANTS)))
  const [elements] = useState(() => lireElements(lire(CLE_ELEMENTS)))
  const [boite, setBoite] = useState<Boite | null>(null)
  const [globeKo, setGlobeKo] = useState(false)
  const zones = useListeZones()
  const vue = useRef<VueHandle>(null)
  const { donnees, maintenant } = useDonnees(filtres, boite)
  const ctx = useMemo(() => ({ maintenant, boite, niveauCyber: NIVEAU }), [maintenant, boite])
  const objets = useMemo(() => appliquer(donnees, filtres, ctx), [donnees, filtres, ctx])
  const une = useMemo(() => alaUne(objets, 12), [objets])
  const cadre = useMemo(() => cadreTele(r, zones), [r, zones])

  const regler = (p: Partial<ReglageTele>) => {
    const n = { ...r, ...p }
    setR(n)
    try { localStorage.setItem(CLE_TELE, JSON.stringify(n)) } catch { /* le choix ne survit pas sans stockage */ }
  }
  const globe = globePourMode(r.mode) && !globeKo
  // le cadrage suit le mode (et la zone quand elle arrive de l'API) ; une fois posé on laisse la scène tranquille
  const cle = `${r.mode}|${r.zone_id}|${cadre.vue.cx},${cadre.vue.cy},${cadre.vue.zoom}|${globe}`
  useEffect(() => {
    const t = window.setTimeout(() => vue.current?.appliquerVue(cadre.vue as Vue), 80)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])

  const props = { objets, choisi: null, onChoisir: () => {}, trace: null, onVue: (_v: Vue, b: Boite) => setBoite(b), etiquettes: [], maxEtiquettes: 0, elements }
  return (
    <div>
      <div className="ge-tele-barre">
        {MODES_TELE.map((m) => (
          <button key={m.id} type="button" className={r.mode === m.id ? 'on' : ''} aria-pressed={r.mode === m.id} onClick={() => regler({ mode: m.id as ModeTele })}>{m.nom}</button>
        ))}
        {r.mode === 'zone' && (
          <select value={r.zone_id} onChange={(e) => regler({ zone_id: e.target.value })} aria-label="zone affichée">
            <option value="">{zones.length ? 'choisir une zone' : 'aucune zone surveillée'}</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.nom}</option>)}
          </select>
        )}
        {r.mode === 'rotation' && (
          <select value={r.vitesse} onChange={(e) => regler({ vitesse: Number(e.target.value) })} aria-label="vitesse de rotation">
            {VITESSES_TELE.map((v) => <option key={v.v} value={v.v}>{`vitesse ${v.nom}`}</option>)}
            {!VITESSES_TELE.some((v) => v.v === r.vitesse) && <option value={r.vitesse}>{`vitesse ${r.vitesse}`}</option>}
          </select>
        )}
        <button type="button" className={r.resume ? 'on' : ''} aria-pressed={r.resume} onClick={() => regler({ resume: !r.resume })}>résumé</button>
        {cadre.zoneAbsente && <span className="ge-note err">zone introuvable : monde entier affiché</span>}
      </div>
      <div className="ge-tele-scene">
        {globe ? (
          <Suspense fallback={<div className="ge-attente">chargement du globe...</div>}>
            <GlobeGodEye ref={vue} {...props} rotation jourNuit vitesse={vitesseDegres(r.vitesse)} onErreur={() => setGlobeKo(true)} />
          </Suspense>
        ) : <CarteGodEye ref={vue} {...props} />}
        {r.resume && <div className="ge-tele-resume"><Resume tele /></div>}
        {elements.bandeau && <Bandeau items={une} onChoisir={() => {}} />}
      </div>
    </div>
  )
}

export default GodEyeTele
