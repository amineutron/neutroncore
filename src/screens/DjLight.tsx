import { useEffect, useMemo, useRef, useState } from 'react'
import '../djlight.css'
import { apiGet, apiPut } from '../lib/api'
import { usePoll } from '../lib/poll'
import { toast } from '../lib/dialog'
import type { Plan } from '../lib/plan'
import { COMMUN_DEFAUT, couleursDe, EFFETS, type Commun, type Scene } from '../lib/spatialFx'
import { lieux } from '../lib/spatialVenues'
import { CONFIG_DEPART, type ConfigDj, type Couche, type Profil, type SetDj } from '../lib/djCouches'
import { DjMoteur, type Lumiere } from '../lib/djMoteur'
import { avancerSet, demarrerSet, pasEnCours, precedent, suivant, type LectureSet } from '../lib/djSet'
import { Loader, PageTitle } from '../components/ui'
import { Bloc } from '../components/lumiere/Bloc'
import { SceneView, type Instant } from '../components/lumiere/SceneView'
import { avanceMs, lireReglages, REGLAGES_DEFAUT, vitesseOnde, type ReglagesDj } from '../lib/djReglages'
import { ReglagesAnalyse } from '../components/djlight/Reglages'
import { Analyseurs } from '../components/djlight/Analyseurs'
import { LectureMusicale } from '../components/djlight/Lecture'
import { Couches } from '../components/djlight/Couches'
import { Profils } from '../components/djlight/Profils'
import { SetsDj } from '../components/djlight/SetsDj'
import { useDjFlux, type SourceDj } from '../components/djlight/useDjFlux'
import { useLampesReelles } from '../components/djlight/useLampesReelles'
import { LampesReelles } from '../components/djlight/LampesReelles'
import { couleursCanaux, encoderTrame } from '../lib/djLampes'
import { choisirTeinte, type LampeCouleur } from '../lib/djAmbilightTeinte'
import { useAmbilight } from '../components/djlight/useAmbilight'
import { AmbilightPanneau } from '../components/djlight/AmbilightPanneau'
import { AmbilightBarre } from '../components/djlight/AmbilightBarre'
import { CADENCE_DEPART, ETAT_DEPART, avancer, couleurDeNiveau, decider, type ReglagesAmbilight } from '../lib/djAmbilight'
import { CLE_AMBILIGHT, charger as chargerReglagesAmbilight, ecrireStockage, enregistrerDans, lireStockage, nommer, type StockageAmbilight } from '../lib/djAmbilightSaves'

type EtatSpatial = { scenes: Scene[]; commun?: Commun }
const CLE_SOURCE = 'neutroncore_dj_source'
const CLE_REGLAGES = 'neutroncore_dj_reglages'
const lireReglagesGardes = (): ReglagesDj => { try { const brut = localStorage.getItem(CLE_REGLAGES); return brut ? lireReglages(JSON.parse(brut)) : REGLAGES_DEFAUT } catch { return REGLAGES_DEFAUT } }
const TITRE = <PageTitle help="djlight" title="dj light" desc="La musique pilote la lumière : volume, grosse caisse, drop, tonalité, branchés sur les réglages de tes scènes, avec une priorité entre eux." />
const lireSource = (): SourceDj => { try { return localStorage.getItem(CLE_SOURCE) === 'simule' ? 'simule' : 'direct' } catch { return 'direct' } }

export function DjLight() {
  const spatial = usePoll<EtatSpatial>(() => apiGet('/spatial'), 6000)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [config, setConfig] = useState<ConfigDj | null>(null)
  const [erreur, setErreur] = useState('')
  const moteur = useMemo(() => new DjMoteur(), [])
  const [reglages, setReglages] = useState<ReglagesDj>(lireReglagesGardes)
  useEffect(() => { moteur.regler(reglages) }, [moteur, reglages])
  const changerReglages = (r: ReglagesDj) => {
    const propres = lireReglages(r)
    setReglages(propres)
    try { localStorage.setItem(CLE_REGLAGES, JSON.stringify(propres)) } catch { /* réglage non retenu */ }
  }
  const [source, setSource] = useState<SourceDj>(lireSource)
  const [sceneId, setSceneId] = useState<string | null>(null)
  const [profilForce, setProfilForce] = useState<string | null>(null)
  const [lectureSet, setLectureSet] = useState<LectureSet | null>(null)
  const [declenchee, setDeclenchee] = useState<string[]>([])
  const [beatSet, setBeatSet] = useState(0)
  const dropVu = useRef(false)
  const dernier = useRef<Lumiere | null>(null)

  // les vraies lampes sont cadencées par les images audio (30 par seconde), pas par l'animation de l'écran : un onglet
  // caché continue de recevoir des messages réseau, alors que son animation s'arrête
  const tickLampes = useRef<() => void>(() => {})
  const tickAmbilight = useRef<() => void>(() => {})
  const couleursLampes = useRef<LampeCouleur[] | null>(null)      // ce que montrent les vraies lampes à la dernière image (null : pas branchées)
  const { etat: flux, image } = useDjFlux(moteur, source, () => { dropVu.current = true }, () => { tickLampes.current(); tickAmbilight.current() })
  const { etat: lampes, liaison } = useLampesReelles()

  // l'Ambilight de la télé : réglages et quatre sauvegardes gardés dans le navigateur, niveau calculé à chaque image audio
  const [ambi, setAmbi] = useState<StockageAmbilight>(() => lireStockage())
  const majAmbi = (suite: Partial<StockageAmbilight>) => setAmbi((a) => { const n = { ...a, ...suite }; ecrireStockage(CLE_AMBILIGHT, n); return n })
  const { etat: etatAmbi, liaison: liaisonAmbi } = useAmbilight()
  const ambiRef = useRef(ambi.reglages)
  ambiRef.current = ambi.reglages
  const niveauAmbi = useRef({ etat: ETAT_DEPART, cadence: CADENCE_DEPART, niveau: 0 })
  const [niveauAffiche, setNiveauAffiche] = useState(0)
  tickAmbilight.current = () => {
    if (!liaisonAmbi.prete) return
    const maintenant = performance.now(), r = ambiRef.current
    const signal = image.current?.silence ? 0 : moteur.lecture(maintenant).signaux[r.signal]
    const s = niveauAmbi.current
    const a = avancer(s.etat, signal, maintenant, r)
    const d = decider(s.cadence, maintenant, a.niveau, r.cadence)
    // la cadence n'avance que si la valeur est vraiment partie : sinon on réessaie à l'image suivante
    const p = dernier.current?.sortie.params
    const teinte = choisirTeinte({ reglages: r, lampes: couleursLampes.current, scene: p ? couleursDe({ palette: p.palette, couleurs: p.couleurs }) : [], beat: moteur.lecture(maintenant).beat })
    const cadence = d.envoyer && liaisonAmbi.envoyer(couleurDeNiveau(a.niveau, teinte)) ? d.cadence : s.cadence
    niveauAmbi.current = { etat: a.etat, cadence, niveau: a.niveau }
  }
  const lancerAmbilight = () => {
    niveauAmbi.current = { etat: ETAT_DEPART, cadence: CADENCE_DEPART, niveau: 0 }
    void liaisonAmbi.demarrer(ambiRef.current.voie)
  }
  const chargerAmbilight = (i: number) => {
    const r = chargerReglagesAmbilight(ambi.sauvegardes, i)
    if (!r) return
    const enMarche = etatAmbi.phase === 'actif' || etatAmbi.phase === 'demarrage'
    // la voie ne se change pas en cours de route (la télé est préparée pour l'une d'elles) : le reste s'applique
    const voie = enMarche ? ambi.reglages.voie : r.voie
    if (enMarche && r.voie !== ambi.reglages.voie) toast('la voie ne change pas en cours de route : arrête l’Ambilight pour la changer. Les autres réglages sont appliqués.', 'warn')
    majAmbi({ reglages: { ...r, voie }, courante: i })
  }

  useEffect(() => { void apiGet<Plan>('/plan').then(setPlan).catch((e) => setErreur((e as Error).message)) }, [])
  // configuration : celle de l'API ; vide (premier lancement), on y met les profils de départ
  useEffect(() => {
    void apiGet<{ config: ConfigDj }>('/djlight/config').then((r) => {
      if (r.config.profils.length > 0) { setConfig(r.config); return }
      const depart = { ...CONFIG_DEPART(), sets: r.config.sets }
      setConfig(depart)
      void apiPut('/djlight/config', { config: depart })
    }).catch((e) => setErreur((e as Error).message))
  }, [])

  // enregistrement un instant après le dernier geste ; une version refusée par l'API est dite, pas perdue en silence
  const envoi = useRef(0)
  const modifier = (next: ConfigDj) => {
    setConfig(next)
    window.clearTimeout(envoi.current)
    envoi.current = window.setTimeout(() => {
      void apiPut<{ success: boolean; error?: string }>('/djlight/config', { config: next })
        .then((r) => { if (!r.success) toast(r.error ?? 'configuration refusée', 'crit') })
        .catch((e) => toast((e as Error).message, 'crit'))
    }, 500)
  }
  useEffect(() => () => window.clearTimeout(envoi.current), [])

  const scenes = spatial.data?.scenes ?? []
  const commun: Commun = { ...COMMUN_DEFAUT, ...spatial.data?.commun }
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0]
  const profils = config?.profils ?? []
  const idProfil = profilForce && profils.some((p) => p.id === profilForce) ? profilForce : config?.actif && profils.some((p) => p.id === config.actif) ? config.actif : profils[0]?.id
  const profil = profils.find((p) => p.id === idProfil)
  const venues = useMemo(() => (plan ? lieux(plan) : []), [plan])
  const venue = venues.find((v) => v.id === 'piece') ?? venues[0]

  const ctx = useRef({ profil, scene, scenes, commun })
  ctx.current = { profil, scene, scenes, commun }
  const [muet, setMuet] = useState(false)
  const silence = flux.moteur === 'ok' && muet
  const silenceRef = useRef(silence)
  silenceRef.current = silence

  // ce que montre la pièce 3d : la pile appliquée à la scène, à chaque image
  const instant = (v: NonNullable<typeof venue>): Instant => {
    const c = ctx.current
    if (!c.profil || !c.scene) return { effets: [], params: { source: [0, 0, 0], axe: 'x', palette: 'neon', intensite: 0 }, beat: 0 }
    const l = moteur.lumiere(performance.now(), { profil: c.profil, scene: c.scene, scenes: c.scenes, commun: c.commun, dims: v.dims })
    dernier.current = l
    const params = silenceRef.current ? { ...l.sortie.params, general: 0 } : l.sortie.params
    return { effets: l.sortie.effets, params, beat: l.beat }
  }

  // ce que reçoivent les vraies lampes : la même pile, la même scène, le même calcul que la pièce 3d, aux positions des canaux
  tickLampes.current = () => {
    const c = ctx.current
    if (!liaison.prete || !venue || !c.profil || !c.scene) { couleursLampes.current = null; return }
    const l = moteur.lumiere(performance.now(), { profil: c.profil, scene: c.scene, scenes: c.scenes, commun: c.commun, dims: venue.dims })
    dernier.current = l
    const muet = Boolean(image.current?.silence)
    const couleurs = couleursCanaux(liaison.canaux, l.sortie.effets, l.sortie.params, venue.dims, l.beat, muet)
    couleursLampes.current = couleurs
    liaison.envoyer(encoderTrame(couleurs))
  }

  // lecture d'un set : à chaque pas fini, la scène (et le profil) du suivant
  const lectureRef = useRef(lectureSet)
  lectureRef.current = lectureSet
  const configRef = useRef(config)
  configRef.current = config
  const appliquer = (l: LectureSet | null) => {
    const set = l ? configRef.current?.sets.find((s) => s.id === l.set) : undefined
    const pas = set && l ? pasEnCours(set, l) : undefined
    if (!pas) { setLectureSet(null); setProfilForce(null); return }
    setLectureSet(l); setSceneId(pas.scene); setProfilForce(pas.profil)
  }
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now(), beat = moteur.lecture(now).beat
      setMuet(Boolean(image.current?.silence))
      setNiveauAffiche(niveauAmbi.current.niveau)
      setDeclenchee(Object.values(dernier.current?.declenches ?? {}).map((sid) => ctx.current.scenes.find((s) => s.id === sid)?.nom ?? '?'))
      const l = lectureRef.current
      const drop = dropVu.current
      dropVu.current = false
      if (!l) return
      setBeatSet(beat)
      const set = configRef.current?.sets.find((s) => s.id === l.set)
      if (!set) { appliquer(null); return }
      const r = avancerSet(set, l, beat, drop)
      if (r.change) appliquer(r.lecture)
    }, 100)
    return () => window.clearInterval(id)
  }, [moteur]) // eslint-disable-line react-hooks/exhaustive-deps

  const changerSource = (s: SourceDj) => {
    setSource(s); setLectureSet(null); setProfilForce(null)
    try { localStorage.setItem(CLE_SOURCE, s) } catch { /* réglage non retenu */ }
  }
  const lancerSet = (set: SetDj) => appliquer(demarrerSet(set, moteur.lecture(performance.now()).beat))
  const pasSuivant = () => { const l = lectureRef.current, set = l && configRef.current?.sets.find((s) => s.id === l.set); if (l && set) appliquer(suivant(set, l, moteur.lecture(performance.now()).beat)) }
  const pasPrecedent = () => { const l = lectureRef.current, set = l && configRef.current?.sets.find((s) => s.id === l.set); if (l && set) appliquer(precedent(set, l, moteur.lecture(performance.now()).beat)) }
  const jouerScene = (s: Scene) => { setLectureSet(null); setProfilForce(null); setSceneId(s.id) }

  if (!config || !plan || !venue || !spatial.data) {
    return <>{TITRE}{erreur || spatial.error ? <p className="chip crit">indisponible : {erreur || spatial.error}</p> : <Loader label="lecture du plan, des scènes et des profils…" />}</>
  }
  const majCouches = (couches: Couche[]) => { if (profil) modifier({ ...config, profils: profils.map((p) => (p.id === profil.id ? { ...p, couches } : p)) }) }
  const majProfils = (liste: Profil[]) => modifier({ ...config, profils: liste, actif: liste.some((p) => p.id === config.actif) ? config.actif : (liste[0]?.id ?? null) })

  const etatFlux = flux.moteur === 'ok' ? (silence ? 'warn' : 'ok') : flux.moteur === 'erreur' ? 'crit' : 'warn'
  const texteFlux = flux.moteur === 'ok' ? (silence ? 'rien ne joue sur l’appareil écouté' : `son reçu${flux.source ? ` · ${flux.source}` : ''}`)
    : flux.moteur === 'erreur' ? flux.erreur || 'moteur audio indisponible' : 'démarrage du moteur audio…'
  return (
    <>
      {TITRE}
      <div className="dj-barre-haut">
        <div className="dj-seg" role="radiogroup" aria-label="Source du son">
          <button type="button" role="radio" aria-checked={source === 'direct'} aria-pressed={source === 'direct'} onClick={() => changerSource('direct')} title="Le son joué sur l’ordinateur (YouTube, un lecteur) : celui que huebeat écoute">son de l’ordinateur</button>
          <button type="button" role="radio" aria-checked={source === 'simule'} aria-pressed={source === 'simule'} onClick={() => changerSource('simule')} title="Un morceau fictif en boucle, pour essayer les réglages sans musique">morceau simulé</button>
        </div>
        <span className={`chip ${etatFlux}`} role="status">{texteFlux}</span>
        <LampesReelles etat={lampes} avanceMs={avanceMs(reglages)} onDemarrer={() => { void liaison.demarrer() }} onArreter={() => { void liaison.arreter() }} />
        <AmbilightBarre etat={etatAmbi} onDemarrer={lancerAmbilight} onArreter={() => { void liaisonAmbi.arreter() }} />
      </div>

      <Analyseurs image={image} />

      <div className="dj-grille">
        <div className="dj-gauche">
          <div className="dj-sec-titre"><h3>la pièce</h3>{declenchee.length > 0 && <span className="chip gold">scène lancée : {declenchee.join(', ')}</span>}</div>
          <SceneView venue={venue} instant={instant} />
          <div className="dj-scenes" role="group" aria-label="Scène jouée">
            {scenes.map((s) => (
              <button key={s.id} type="button" className="dj-scene" aria-pressed={scene?.id === s.id} onClick={() => jouerScene(s)}
                style={{ '--c1': couleursDe(s)[0], '--c2': couleursDe(s)[1] ?? couleursDe(s)[0] } as React.CSSProperties}>
                <b>{s.nom}</b><span>{s.mode === '2d' ? '2d' : s.effets.map((e) => EFFETS.find((x) => x.id === e)?.label ?? e).join(' + ') || 'noir'}</span>
              </button>
            ))}
          </div>
          <p className="dj-note">La scène choisie est la base ; les couches ci-dessous la modulent avec la musique. Les réglages communs (pulsation, intensité) se règlent dans « lumière 3d » : ici ils servent de point de départ.</p>
        </div>
        <div className="dj-droite card">
          <div className="dj-sec-titre"><h3>lecture musicale</h3></div>
          <LectureMusicale moteur={moteur} image={image} silence={silence} />
        </div>
      </div>

      <Bloc id="dj-couches" title="couches" lite={profil ? `${profil.nom} · ${profil.couches.length} rangées` : ''}>
        <Profils profils={profils} actif={idProfil ?? ''} onChoisir={(id) => { setProfilForce(null); modifier({ ...config, actif: id }) }} onChange={majProfils} />
        {lectureSet && profilForce && <p className="chip gold">le set joue le profil « {profil?.nom} » : choisir un profil ici le remplace</p>}
        {profil && <Couches couches={profil.couches} scenes={scenes} acts={() => dernier.current?.acts ?? {}} valeurs={() => dernier.current?.valeurs ?? {}} onChange={majCouches} />}
      </Bloc>

      <Bloc id="dj-reglages" title="analyse et latence" lite={`onde x${vitesseOnde(reglages)} · avance ${avanceMs(reglages)} ms · cycle ${reglages.cycle.actif ? 'oui' : 'non'}`}>
        <ReglagesAnalyse reglages={reglages} bpm={moteur.lecture(performance.now()).bpm} onChange={changerReglages} />
      </Bloc>

      <Bloc id="dj-ambilight" title="ambilight tv" lite={etatAmbi.phase === 'actif' ? `en direct · ${ambi.reglages.min}–${ambi.reglages.max} %` : etatAmbi.phase === 'erreur' ? 'erreur' : 'arrêté'}>
        <AmbilightPanneau etat={etatAmbi} reglages={ambi.reglages} sauvegardes={ambi.sauvegardes} courante={ambi.courante} niveau={etatAmbi.phase === 'actif' ? niveauAffiche : 0}
          onChange={(reglages: ReglagesAmbilight) => majAmbi({ reglages })} onDemarrer={lancerAmbilight} onArreter={() => { void liaisonAmbi.arreter() }}
          onCharger={chargerAmbilight}
          onEnregistrer={(i) => { majAmbi({ sauvegardes: enregistrerDans(ambi.sauvegardes, i, ambi.reglages), courante: i }); toast(`réglages gardés dans « ${ambi.sauvegardes[i]?.nom} »`) }}
          onNommer={(i, nom) => majAmbi({ sauvegardes: nommer(ambi.sauvegardes, i, nom) })} />
      </Bloc>

      <Bloc id="dj-sets" title="sets" lite={`${config.sets.length} set${config.sets.length > 1 ? 's' : ''}`}>
        <SetsDj sets={config.sets} scenes={scenes} profils={profils} lecture={lectureSet} beat={beatSet}
          onChange={(sets) => modifier({ ...config, sets })} onLancer={lancerSet} onSuivant={pasSuivant} onPrecedent={pasPrecedent} onArreter={() => appliquer(null)} />
      </Bloc>
    </>
  )
}
