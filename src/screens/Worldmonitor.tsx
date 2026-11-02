import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPut } from '../lib/api'
import { toast } from '../lib/dialog'
import { usePoll } from '../lib/poll'
import { niveauCyber, VUE_DEPART, type Vue } from '../lib/vueMonde'
import type { ListeCyber } from '../lib/cyber'
import { CLE_AFFICHAGE, candidatsEtiquettes, lireAffichage, maxEtiquettes, rotationEffective } from '../lib/godeye/affichage'
import { COULEURS_COUCHE, COULEURS_THEME } from '../lib/godeye/couleurs'
import { appliquer, FILTRES_DEFAUT, infosFiltrees, lireFiltres, type Filtres, type VueEnregistree } from '../lib/godeye/filtres'
import type { Boite, Info, Objet } from '../lib/godeye/modele'
import { trace as traceSat } from '../lib/godeye/orbites'
import { alaUne, compter } from '../lib/godeye/une'
import { CLE_FILTRES_COURANTS, corpsVue, filtresCourants, lireVues } from '../lib/godeye/vues'
import { partDuMonde } from '../lib/godeye/zone'
import { Bandeau } from '../components/godeye/Bandeau'
import { CarteGodEye } from '../components/godeye/CarteGodEye'
import { BarreStage, RailCouches, type Affichage, type Onglet } from '../components/godeye/ControlesStage'
import { Detail } from '../components/godeye/Detail'
import { SurLaTele } from '../components/godeye/SurLaTele'
import { Synthese } from '../components/godeye/Synthese'
import { Failles, Marches } from '../components/godeye/Tableaux'
import { Tiroir } from '../components/godeye/Tiroir'
import { useDonnees } from '../components/godeye/useDonnees'
import type { VueHandle } from '../components/godeye/vues'
import '../components/ctl.css'
import '../components/vuemonde/vuemonde.css'
import '../components/godeye/godeye.css'
import '../components/godeye/stage.css'
import { PageTitle } from '../components/ui'

// le globe (three.js) ne se charge que si on l'affiche
const GlobeGodEye = lazy(() => import('../components/godeye/GlobeGodEye').then((m) => ({ default: m.GlobeGodEye })))

const TITRE = <PageTitle help="worldmonitor" title="god eye" desc="La planète en direct : actualités classées, avions, satellites, séismes, catastrophes, cyber et marchés, sur un globe ou une carte, avec des filtres que l'on enregistre en vues." />
const EN_TELE = (() => { try { return new URLSearchParams(window.location.search).get('plein') === '1' } catch { return false } })()
const lire = (cle: string): string | null => { try { return localStorage.getItem(cle) } catch { return null } }
const calme = (): boolean => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

export function Worldmonitor() {
  const [f, setF] = useState<Filtres>(() => filtresCourants(lire(CLE_FILTRES_COURANTS)))
  const [aff, setAff] = useState<Affichage>(() => (EN_TELE ? { mode: 'globe', rotation: true, jourNuit: true, tiroir: null } : lireAffichage(lire(CLE_AFFICHAGE), calme())))
  const [plein, setPlein] = useState(EN_TELE)
  const [choisi, setChoisi] = useState<string | null>(null)
  const [boite, setBoite] = useState<Boite | null>(null)
  const [zoom, setZoom] = useState(1)
  const [perso, setPerso] = useState<VueEnregistree[]>([])
  const [active, setActive] = useState<VueEnregistree | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreurVues, setErreurVues] = useState('')
  const vue = useRef<VueHandle>(null)
  const dernierCadre = useRef<Vue>(VUE_DEPART)
  const scene = useRef<HTMLDivElement>(null)

  const changer = useCallback((n: Filtres) => {
    setF(n)
    try { localStorage.setItem(CLE_FILTRES_COURANTS, JSON.stringify(n)) } catch { /* sans stockage : le réglage ne survit pas */ }
  }, [])
  const changerAff = useCallback((a: Affichage) => {
    setAff(a)
    try { localStorage.setItem(CLE_AFFICHAGE, JSON.stringify(a)) } catch { /* idem */ }
  }, [])

  const cyber = usePoll(() => apiGet<ListeCyber>('/cyber?limit=8'), 60_000, f.couches.cyber)
  const niveau = niveauCyber(cyber.data?.niveau)
  const { donnees, maintenant, etats, couvreAvions, orbites, sourcesInfos } = useDonnees(f, boite)
  const ctx = useMemo(() => ({ maintenant, boite, niveauCyber: niveau }), [maintenant, boite, niveau])
  const objets = useMemo(() => appliquer(donnees, f, ctx), [donnees, f, ctx])
  const nombres = useMemo(() => compter(objets), [objets])
  const fil = useMemo(() => (f.couches.infos ? infosFiltrees(donnees.infos, f, ctx) : []), [donnees.infos, f, ctx])
  const une = useMemo(() => alaUne(objets, 12), [objets])
  const etiquettes = useMemo(() => candidatsEtiquettes(objets, choisi), [objets, choisi])
  const objet = objets.find((o) => o.id === choisi) ?? null

  // trace au sol du satellite touché (100 prochaines minutes), recalculée à la sélection seulement
  const orbiteChoisie = objet?.couche === 'satellites' ? orbites.find((o) => `sat:${o.id}` === objet.id) ?? null : null
  const traceSelection = useMemo(() => (orbiteChoisie ? traceSat(orbiteChoisie, new Date(), 100) : null), [orbiteChoisie])

  const rechargerVues = useCallback(async () => {
    try { setPerso(lireVues(await apiGet('/godeye/vues'))); setErreurVues('') } catch (e) { setErreurVues(e instanceof Error ? `vues indisponibles (${e.message})` : 'vues indisponibles') }
  }, [])
  useEffect(() => { void rechargerVues() }, [rechargerVues])

  const surVue = useCallback((v: Vue, b: Boite) => { dernierCadre.current = v; setBoite(b); setZoom(v.zoom) }, [])
  // changer de mode garde le cadrage : la nouvelle vue se place là où était l'ancienne
  useEffect(() => { const t = window.setTimeout(() => vue.current?.appliquerVue(dernierCadre.current), 60); return () => window.clearTimeout(t) }, [aff.mode])

  const appliquerVue = (v: VueEnregistree) => {
    changer(v.filtres); setActive(v); setChoisi(null)
    vue.current?.appliquerVue(v.camera ?? VUE_DEPART)
  }
  const enregistrer = async (nom: string, id?: string) => {
    setOccupe(true)
    try {
      const r = await apiPut<{ vues: unknown; id: string }>('/godeye/vues', corpsVue(nom, f, vue.current?.lireVue() ?? null, id))
      const vues = lireVues(r)
      setPerso(vues); setErreurVues('')
      setActive(vues.find((v) => v.id === r.id) ?? null)
      toast(`vue « ${nom.trim()} » enregistrée`, 'ok')
    } catch (e) { toast(e instanceof Error ? e.message : 'enregistrement impossible', 'crit') } finally { setOccupe(false) }
  }
  const supprimer = async (v: VueEnregistree) => {
    setOccupe(true)
    try {
      setPerso(lireVues(await apiDelete(`/godeye/vues/${encodeURIComponent(v.id)}`)))
      if (active?.id === v.id) setActive(null)
    } catch (e) { toast(e instanceof Error ? e.message : 'suppression impossible', 'crit') } finally { setOccupe(false) }
  }

  const centrer = (lon: number, lat: number) => {
    const v = vue.current?.lireVue() ?? VUE_DEPART
    vue.current?.appliquerVue({ cx: lon, cy: lat, zoom: Math.max(v.zoom, 3.5) })
  }
  const choisirObjet = (o: Objet) => { setChoisi(o.id); centrer(o.lon, o.lat) }
  const choisirInfo = (a: Info) => { setChoisi(`inf:${a.id}`); if (a.lat !== null && a.lon !== null) centrer(a.lon, a.lat) }
  const ouvrir = (tiroir: Onglet | null) => changerAff({ ...aff, tiroir })

  const basculerPlein = () => {
    const v = !plein
    setPlein(v)
    try {
      if (v && !document.fullscreenElement) void scene.current?.requestFullscreen?.().catch(() => {})
      if (!v && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    } catch { /* plein écran indisponible : la mise en page plein cadre reste */ }
  }
  useEffect(() => {
    if (!plein || EN_TELE) return
    const clavier = (e: KeyboardEvent) => { if (e.key === 'Escape') setPlein(false) }
    const sortie = () => { if (!document.fullscreenElement) setPlein(false) }
    window.addEventListener('keydown', clavier)
    document.addEventListener('fullscreenchange', sortie)
    return () => { window.removeEventListener('keydown', clavier); document.removeEventListener('fullscreenchange', sortie) }
  }, [plein])

  // zones que les étiquettes évitent : commandes, panneau, fiche ouverte (repère de la scène)
  const bloques = useCallback(() => {
    const s = scene.current
    if (!s) return []
    const o = s.getBoundingClientRect()
    return [...s.querySelectorAll<HTMLElement>('[data-bloque]')].map((el) => { const r = el.getBoundingClientRect(); return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height } })
  }, [])

  const montre = objet ?? (EN_TELE ? une[0] ?? null : null)
  const largeur = scene.current?.clientWidth ?? 1200
  const props = {
    objets, choisi, onChoisir: setChoisi, trace: traceSelection, onVue: surVue, etiquettes, maxEtiquettes: maxEtiquettes(zoom, largeur), bloques,
  }
  const globe = aff.mode === 'globe'
  return (
    <div className="nc-scope ge-page">
      {!plein && TITRE}
      <div ref={scene} className={`ge-stage${plein ? ' plein' : ''}${EN_TELE ? ' tele' : ''}${aff.tiroir ? ' tiroir' : ''}`}>
        {globe ? (
          <Suspense fallback={<div className="ge-attente">chargement du globe...</div>}>
            <GlobeGodEye ref={vue} {...props} rotation={rotationEffective(aff.rotation, choisi)} jourNuit={aff.jourNuit}
              onErreur={(m) => { toast(`Globe 3D indisponible (${m}) : carte à plat.`, 'warn'); changerAff({ ...aff, mode: 'plat' }) }} />
          </Suspense>
        ) : <CarteGodEye ref={vue} {...props} />}
        {!EN_TELE && <RailCouches f={f} onChange={changer} nombres={nombres} etats={etats} onRegler={() => ouvrir('filtres')} />}
        {!EN_TELE && <BarreStage aff={aff} onAff={changerAff} plein={plein} onPlein={basculerPlein} onRecentrer={() => vue.current?.appliquerVue(VUE_DEPART)} enrouler={choisi !== null} />}
        {f.couches.avions && f.avions.mode === 'zone' && boite && partDuMonde(boite) > 0.15 && (
          <div className="ge-conseil">avions : zoomer sur une région, ou choisir « militaires du monde entier » dans les filtres</div>
        )}
        {aff.tiroir && !EN_TELE && (
          <Tiroir onglet={aff.tiroir} onOnglet={(o) => ouvrir(o)} onFermer={() => ouvrir(null)} f={f} onChange={changer} nombres={nombres} etats={etats}
            couvreAvions={couvreAvions} sourcesInfos={sourcesInfos} fil={fil} choisi={choisi} onChoisirInfo={choisirInfo} une={une} onChoisirObjet={choisirObjet}
            vues={{ perso, active, filtres: f, occupe, erreur: erreurVues, onAppliquer: appliquerVue, onEnregistrer: (n, id) => void enregistrer(n, id), onSupprimer: (v) => void supprimer(v), onReinitialiser: () => { changer(lireFiltres(FILTRES_DEFAUT)); setActive(null) } }}
            onAppliquerVue={appliquerVue} />
        )}
        {montre && <Detail objet={montre} onFermer={() => setChoisi(null)} onCentrer={(o) => centrer(o.lon, o.lat)} />}
        <Bandeau items={une} onChoisir={choisirObjet} />
      </div>
      {!plein && (
        <div className="nc-stack" style={{ marginTop: 14 }}>
          {f.couches.infos && <Synthese infos={fil} f={f} onChange={changer} />}
          <Legende />
          <div className="ge-grille"><Marches /><Failles /></div>
          <SurLaTele />
        </div>
      )}
    </div>
  )
}

export default Worldmonitor

function Legende() {
  const pt = (c: string, forme = '') => <i className={`ge-sw-c ${forme}`} style={{ background: c }} />
  return (
    <div className="ge-legende" aria-label="légende">
      <span>{pt(COULEURS_THEME.guerre)}guerre</span>
      <span>{pt(COULEURS_THEME.diplomatie)}diplomatie</span>
      <span>{pt(COULEURS_THEME.economie)}économie</span>
      <span>{pt(COULEURS_THEME.cyber)}cyber</span>
      <span>{pt(COULEURS_THEME.securite)}sécurité</span>
      <span>{pt(COULEURS_THEME.catastrophe)}catastrophes</span>
      <span>{pt('#ff7a3d')}séisme (taille = magnitude)</span>
      <span>{pt(COULEURS_COUCHE.avions, 'fl')}avion</span>
      <span>{pt('#ffb454', 'fl')}militaire</span>
      <span>{pt(COULEURS_COUCHE.satellites, 'lo')}satellite</span>
      <span>{pt(COULEURS_COUCHE.navires, 'fl')}navire</span>
      <span className="ge-legende-note">la lettre d'une pastille donne le thème, son halo l'importance</span>
    </div>
  )
}
