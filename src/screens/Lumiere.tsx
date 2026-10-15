import { useEffect, useMemo, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { confirmDialog, toast } from '../lib/dialog'
import type { Plan } from '../lib/plan'
import {
  COMMUN_DEFAUT, EFFETS, tempsDeVie, LIBRE, MAX_COULEURS, PALETTES, couleursDe, deplacerTouche, etapeDuSet, frappesEnSet, paramsDeScene, positionDansLeTemps, tempoTape,
  type Axe, type Commun, type Depart, type Surcharge, type FxId, type Groupe, type Scene, type SetDeScenes,
} from '../lib/spatialFx'
import { lieux, type Venue } from '../lib/spatialVenues'
import { Loader, PageTitle } from '../components/ui'
import { Bloc } from '../components/lumiere/Bloc'
import { Ecoute } from '../components/lumiere/Ecoute'
import { ApercuReglage } from '../components/lumiere/ApercuReglage'
import { BORNES, LEGENDES, type CleCommun } from '../lib/spatialApercu'
import { SceneView, type Instant } from '../components/lumiere/SceneView'
import { ReglagesEffet } from '../components/lumiere/ReglagesEffet'
import { NumField } from '../components/NumField'

type Huebeat = { actif: boolean; silence?: boolean; avance?: number; bpm?: number; beat_count?: number; beat_ts?: number; spatial?: boolean; maintenant?: number; source?: string }
type Peripherique = { nom: string; label: string; genre: 'sortie' | 'micro'; actif: boolean }
type Etat = { scenes: Scene[]; sets: SetDeScenes[]; commun?: Commun; peripherique?: string; peripheriques?: Peripherique[]; huebeat: Huebeat; reel: { nom: string; pause?: boolean } | null; canaux: { canaux: Record<string, number[]>; noms: Record<string, string>; manquants: string[]; zone?: string; erreur?: string } }
type Reglage = Omit<Scene, 'id' | 'nom'>
const DEPART: Reglage = { effets: ['onde'], palette: 'neon', axe: 'x', source: { x: 50, y: 30, z: 35 }, intensite: 100, depart: 'bas' }
const TITRE = <PageTitle help="lumiere" title="lumière 3d" desc="Des effets de lumière qui vivent dans l'espace de la pièce, calés sur la musique : un pad de scènes, des sets, et tes vraies lampes." />

export function Lumiere() {
  const etat = usePoll<Etat>(() => apiGet('/spatial'), 1500)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [erreur, setErreur] = useState('')
  useEffect(() => { void apiGet<Plan>('/plan').then(setPlan).catch((e) => setErreur((e as Error).message)) }, [])
  const tous = useMemo(() => (plan ? lieux(plan) : []), [plan])
  const [lieuId, setLieuId] = useState('piece')
  const lieu: Venue | undefined = tous.find((l) => l.id === lieuId) ?? tous[0]

  const [live, setLive] = useState<Reglage>(DEPART)          // ce qui joue en ce moment (scène du pad, éventuellement retouchée)
  const [actif, setActif] = useState<string | null>(null)     // scène du pad dont vient `live`
  const [reel, setReel] = useState(false)                     // envoyer aussi aux vraies lampes
  const [bpm, setBpm] = useState(120)
  const [nom, setNom] = useState('')
  const [busy, setBusy] = useState('')
  const [jeu, setJeu] = useState<{ id: string; depuis: number } | null>(null)                           // set en cours de lecture
  const [prise, setPrise] = useState<{ depuis: number; frappes: { scene: string; beat: number }[] } | null>(null)   // enregistrement d'un set
  const tapes = useRef<number[]>([])
  const local = useRef({ beat: 0, dernier: 0 })
  const hb = etat.data?.huebeat
  const cale = Boolean(hb?.actif)
  // décalage entre l'horloge de l'API et celle de ce navigateur, mesuré à chaque relevé
  const sync = useRef({ beatCount: 0, beatTs: 0, bpm: 0, avance: 0, decalage: 0 })
  if (hb?.actif) sync.current = { beatCount: hb.beat_count ?? 0, beatTs: hb.beat_ts ?? 0, bpm: hb.bpm ?? 0, avance: hb.avance ?? 0, decalage: (hb.maintenant ?? 0) - Date.now() / 1000 }
  // lecture de l'aperçu : hors direct, il joue au tempo réglé ici quand on le lance ; en direct, il suit les lampes
  // et la pause fige les deux (huebeat garde les couleurs du moment, `reel.pause`)
  const [apercu, setApercu] = useState(false)
  const [pauseDirect, setPauseDirect] = useState<boolean | null>(null)       // demandée ici, en attendant le relevé
  const lampesFigees = pauseDirect ?? Boolean(etat.data?.reel?.pause)
  const fige = cale && reel ? lampesFigees : !apercu
  const horloge = useRef({ cale, bpm, fige })
  horloge.current = { cale, bpm, fige }
  const gel = useRef<number | null>(null)

  /** Où en est-on dans le morceau, en pulsations : l'horloge des lampes (même calcul que huebeat, avance comprise)
   * s'il tourne, sinon le tempo réglé ici. Figé pendant une pause. */
  const beatMaintenant = (): number => {
    const h = horloge.current
    if (h.cale) {
      const s = sync.current
      const pos = positionDansLeTemps(s.beatCount, (s.beatTs ? Date.now() / 1000 + s.decalage - s.beatTs : 99) + s.avance, s.bpm)
      if (!h.fige) { gel.current = null; return pos }
      if (gel.current === null) gel.current = pos
      return gel.current
    }
    gel.current = null
    const t = performance.now(), l = local.current
    if (l.dernier && !h.fige) l.beat += ((t - l.dernier) / 60000) * h.bpm
    l.dernier = t
    return l.beat
  }
  const liveRef = useRef(live)
  liveRef.current = live
  // réglages communs à toutes les scènes : ceux de l'API, ou ceux qu'on est en train de régler ici
  const [communLocal, setCommunLocal] = useState<Commun | null>(null)
  const commun = { ...COMMUN_DEFAUT, ...(communLocal ?? etat.data?.commun) }     // une API plus ancienne ne connaît pas toutes les clés
  const communRef = useRef(commun)
  communRef.current = commun
  const envoiCommun = useRef(0)
  const reglerCommun = (patch: Partial<Commun>) => {
    const next = { ...communRef.current, ...patch }
    setCommunLocal(next)
    window.clearTimeout(envoiCommun.current)
    envoiCommun.current = window.setTimeout(() => {
      void apiPut<{ success: boolean; error?: string }>('/spatial/commun', { commun: next })
        .then((r) => { if (!r.success) toast(r.error ?? 'refusé', 'crit'); etat.refresh(); window.setTimeout(() => setCommunLocal(null), 1800) })
        .catch((e) => toast((e as Error).message, 'crit'))
    }, 250)
  }
  // en direct, rien n'est joué sur le périphérique écouté : les lampes sont éteintes, le banc d'essai aussi
  const muet = Boolean(cale && hb?.spatial && hb.silence)
  const muetRef = useRef(muet)
  muetRef.current = muet
  const instant = (v: Venue): Instant => {
    const params = paramsDeScene(liveRef.current, v.dims, communRef.current)
    return { effets: liveRef.current.effets, params: muetRef.current ? { ...params, general: 0 } : params, beat: beatMaintenant() }
  }

  const scenes = etat.data?.scenes ?? []
  const versLampes = async (r: Reglage | null, nomScene = 'réglage en cours') => {
    try {
      const res = await apiPost<{ success: boolean; error?: string; huebeat?: boolean }>('/spatial/reel', { scene: r ? { ...r, nom: nomScene } : null })
      if (!res.success) { toast(res.error ?? 'refusé', 'crit'); if (res.huebeat === false) setReel(false) }
      etat.refresh()
    } catch (e) { toast((e as Error).message, 'crit') }
  }
  // les retouches partent vers les vraies lampes un instant après le dernier geste
  const envoi = useRef(0)
  const regler = (patch: Partial<Reglage>) => {
    const next = { ...live, ...patch }
    setLive(next)
    if (reel) { window.clearTimeout(envoi.current); envoi.current = window.setTimeout(() => void versLampes(next, scenes.find((s) => s.id === actif)?.nom), 250) }
  }
  const activer = (s: Scene, duSet = false) => {
    const { id: _id, nom: _nom, ...r } = s
    setLive(r); setActif(s.id)
    if (reel) void versLampes(r, s.nom)
    if (!duSet) { setJeu(null); setPrise((p) => (p ? { ...p, frappes: [...p.frappes, { scene: s.id, beat: beatMaintenant() }] } : p)) }
  }

  // lecture d'un set : à chaque changement d'étape, la scène suivante est activée
  const etape = useRef(-2)
  useEffect(() => {
    if (!jeu) { etape.current = -2; return }
    const set = etat.data?.sets.find((x) => x.id === jeu.id)
    if (!set) { setJeu(null); return }
    const t = window.setInterval(() => {
      const i = etapeDuSet(set, beatMaintenant() - jeu.depuis)
      if (i === etape.current) return
      etape.current = i
      if (i < 0) { setJeu(null); return }
      const s = scenes.find((x) => x.id === set.pas[i].scene)
      if (s) activer(s, true)
    }, 40)
    return () => window.clearInterval(t)
  }, [jeu, etat.data?.sets, scenes.length, reel]) // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (cle: string, faire: () => Promise<{ success?: boolean; error?: string }>, ok?: () => void) => {
    setBusy(cle)
    try { const r = await faire(); if (r.success === false) toast(r.error ?? 'refusé', 'crit'); else ok?.(); etat.refresh() } catch (e) { toast((e as Error).message, 'crit') } finally { setBusy('') }
  }
  const garderScene = () => post('scene', () => apiPut('/spatial/scenes/new', { scene: { ...live, nom: nom.trim() } }), () => setNom(''))
  const majScene = () => { const s = scenes.find((x) => x.id === actif); if (s) void post('maj', () => apiPut(`/spatial/scenes/${s.id}`, { scene: { ...live, nom: s.nom } })) }
  const renommer = () => { const s = scenes.find((x) => x.id === actif); if (s) void post('nom', () => apiPut(`/spatial/scenes/${s.id}`, { scene: { ...s, nom: nom.trim() } }), () => setNom('')) }
  const deplacer = (sens: -1 | 1) => { if (actif) void post('ordre', () => apiPut('/spatial/scenes/ordre', { ordre: deplacerTouche(scenes.map((x) => x.id), actif, sens) })) }
  const [posAuto, setPosAuto] = useState<number | null>(null)       // où la sensibilité automatique s'est posée, lue chez huebeat
  const MOTS: Record<CleCommun, (v: number) => string> = {
    intensite: (v) => `${v} %`,
    sensibilite: (v) => (v < 35 ? 'gros temps seulement' : v < 75 ? 'équilibrée' : 'réagit à tout'),
    profondeur: (v) => (v === 0 ? 'aucune : lumière continue' : v < 50 ? 'légère' : v < 90 ? 'marquée' : 'totale'),
    attaque: (v) => (v === 0 ? 'd’un coup' : v < 50 ? 'vite' : 'lentement'),
    retombee: (v) => (v < 25 ? 'vite' : v < 70 ? 'doucement' : 'lentement'),
    plancher: (v) => (v === 0 ? 'noir' : `${v} %`),
    vie: (v) => ['un temps : des flashs', 'deux temps', 'une mesure (4 temps)', 'deux mesures (8 temps)'][Math.log2(tempsDeVie(v))],
  }
  const curseurCommun = (cle: CleCommun) => (
    <div key={cle} className="lu-curseur">
      <span><b>{LEGENDES[cle].label}</b><em>{MOTS[cle](commun[cle])}</em></span>
      <input type="range" min={BORNES[cle][0]} max={BORNES[cle][1]} step={1} value={commun[cle]} aria-label={LEGENDES[cle].label}
        onChange={(e) => {
          const v = Number(e.target.value)
          // en 3d, l'arrivée et le départ ne se voient que si la lumière respire : on l'enclenche avec eux
          const reveil = !deuxD && (cle === 'attaque' || cle === 'retombee' || cle === 'vie') && commun.profondeur === 0
          if (reveil) toast('respiration enclenchée (force à 70 %) pour que ce réglage se voie')
          reglerCommun(reveil ? { [cle]: v, profondeur: 70 } : { [cle]: v })
        }} />
      <p className="lu-legende">{LEGENDES[cle].quoi} <ApercuReglage cle={cle} /></p>
    </div>
  )
  const couleursLive = couleursDe(live)
  const deuxD = live.mode === '2d'
  const reglerCouleurs = (couleurs: string[]) => regler({ palette: LIBRE, couleurs })
  const reglerEffet = (fx: FxId, r: Surcharge | undefined) => {
    const autres = Object.fromEntries(Object.entries(live.reglages ?? {}).filter(([k]) => k !== fx))
    regler({ reglages: r ? { ...autres, [fx]: r } : autres })
  }
  const oter = async (quoi: 'scenes' | 'sets', id: string, libelle: string) => {
    if (!(await confirmDialog({ title: `supprimer « ${libelle} » ?`, body: quoi === 'scenes' ? 'Les sets qui la jouaient perdent cette étape.' : undefined, ok: 'supprimer', danger: true }))) return
    void post('oter', async () => apiDelete(`/spatial/${quoi}/${id}`, await withConfirm('spatial_supprimer')), () => { if (id === actif) setActif(null); if (jeu?.id === id) setJeu(null) })
  }
  const finirPrise = () => {
    if (!prise) return
    const pas = frappesEnSet(prise.frappes, beatMaintenant())
    setPrise(null)
    if (pas.length === 0) { toast('rien n’a été joué pendant l’enregistrement', 'warn'); return }
    void post('set', () => apiPut('/spatial/sets/new', { jeu: { nom: nom.trim() || `set du ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, pas, boucle: true } }), () => setNom(''))
  }
  // un seul geste pour tout lancer : huebeat s'il ne tourne pas (une dizaine de secondes), puis la scène en cours
  const [direct, setDirect] = useState<'' | 'lance' | 'arrete'>('')
  const enDirect = reel && cale
  const basculeDirect = async () => {
    const allumer = !enDirect
    setDirect(allumer ? 'lance' : 'arrete')
    try {
      const res = allumer
        ? await apiPost<{ success: boolean; error?: string }>('/spatial/direct', { scene: { ...liveRef.current, nom: scenes.find((x) => x.id === actif)?.nom ?? 'réglage en cours' } })
        : await apiPost<{ success: boolean; error?: string }>('/spatial/arret')
      if (!res.success) toast(res.error ?? 'échec', 'crit')
      setReel(allumer && res.success)
      etat.refresh()
    } catch (e) { toast((e as Error).message, 'crit'); setReel(false) } finally { setDirect('') }
  }
  // l'écran rouvert pendant que les lampes jouent : il reprend la main dessus
  const dejaEnCours = Boolean(etat.data?.reel && etat.data.huebeat.actif)
  // la pause demandée ici vaut jusqu'à ce que le relevé de l'API dise la même chose
  useEffect(() => { if (pauseDirect !== null && pauseDirect === Boolean(etat.data?.reel?.pause)) setPauseDirect(null) }, [pauseDirect, etat.data?.reel?.pause])
  const lancerApercu = () => { local.current.beat = 0; setApercu(true) }
  // en pause = figé en cours de route (en direct, ou un aperçu déjà parti) ; à l'arrêt = jamais lancé
  const enPause = enDirect ? lampesFigees : !apercu && local.current.beat > 0
  const basculePause = async () => {
    if (!enDirect) { setApercu((a) => !a); return }
    const voulu = !lampesFigees
    setPauseDirect(voulu)
    try {
      const r = await apiPost<{ success: boolean; error?: string }>('/spatial/pause', { pause: voulu })
      if (!r.success) { toast(r.error ?? 'refusé', 'crit'); setPauseDirect(null) }
      etat.refresh()
    } catch (e) { toast((e as Error).message, 'crit'); setPauseDirect(null) }
  }
  useEffect(() => { if (dejaEnCours) setReel(true) }, [dejaEnCours])
  const choisirPeripherique = (nomP: string) => post('periph', () => apiPut('/spatial/peripherique', { nom: nomP }))
  const taper = () => {
    tapes.current = [...tapes.current.filter((t) => performance.now() - t < 3000), performance.now()]
    const t = tempoTape(tapes.current)
    if (t) setBpm(t)
    local.current.beat = Math.round(local.current.beat)
  }

  if (!plan || !lieu || !etat.data) return <>{TITRE}{erreur || etat.error ? <p className="chip crit">indisponible : {erreur || etat.error}</p> : <Loader label="lecture du plan et des scènes…" />}</>
  const d = etat.data
  const pieceReelle = lieu.id === 'piece'
  const setEnCours = jeu ? d.sets.find((x) => x.id === jeu.id) : undefined

  return (
    <>
      {TITRE}
      <div className="lu-grille">
        <div className="lu-gauche">
          <div className="lu-lieux">
            {tous.map((l) => <button key={l.id} type="button" className={`btn sm ${l.id === lieu.id ? 'solid' : ''}`} aria-pressed={l.id === lieu.id} onClick={() => setLieuId(l.id)}>{l.label}</button>)}
            <span className="lu-note">{pieceReelle ? 'ta vraie pièce, d’après le plan' : 'scène simulée : rien ne part vers des lampes'}</span>
          </div>
          <div className="lu-transport">
            {!enDirect && <button type="button" className={`btn sm ${apercu ? '' : 'solid'}`} onClick={lancerApercu} title="Joue la scène en cours dans la pièce 3d, depuis le début, au tempo réglé dans « musique »">▶ aperçu de l’animation</button>}
            <button type="button" className={`btn sm ${enPause ? 'solid' : ''}`} aria-pressed={enPause} disabled={!enDirect && !apercu && !enPause}
              onClick={() => void basculePause()} title={enDirect ? 'Fige tes lampes et la pièce 3d sur leurs couleurs du moment ; la musique continue d’être suivie' : 'Fige l’aperçu ; reprendre repart de là'}>
              {enPause ? '▶ reprendre' : '❚❚ pause'}
            </button>
            <span className="lu-note">{enDirect
              ? (lampesFigees ? 'lampes et pièce 3d figées : à la reprise, elles retombent sur le temps de la musique' : 'la pièce 3d suit tes lampes : même horloge, même scène, mêmes réglages')
              : apercu ? `aperçu au tempo réglé ici (${bpm} pulsations/min) : rien ne part vers les lampes` : enPause ? 'aperçu en pause' : 'aperçu à l’arrêt : la pièce montre la scène immobile'}</span>
          </div>
          <SceneView venue={lieu} instant={instant} onPlace={(x, y, z) => { const s = liveRef.current.source; regler({ source: { x: x ?? s.x, y: y ?? s.y, z: z ?? s.z } }) }} />
          <p className="lu-note">{lieu.desc}. Glisse pour tourner autour, molette pour zoomer. La boule dorée est le point source : glisse-la pour la déplacer, glisse la flèche au-dessus pour régler sa hauteur, ou double-clique sur le sol pour l’y poser.</p>

          <Bloc id="pad" title="pad de scènes" lite={prise ? 'enregistrement en cours' : jeu ? `set « ${setEnCours?.nom ?? ''} »` : `${scenes.length} scènes`}>
            <div className="lu-pad">
              {scenes.map((s) => (
                <button key={s.id} type="button" className={`lu-touche ${actif === s.id ? 'on' : ''}`} aria-pressed={actif === s.id} onClick={() => activer(s)}
                  style={{ '--c1': couleursDe(s)[0], '--c2': couleursDe(s)[1] ?? couleursDe(s)[0] } as React.CSSProperties}>
                  <b>{s.nom}</b><span>{s.mode === '2d' ? `2d · ${s.groupe === 'alterne' ? 'une lampe sur deux' : 'toutes ensemble'}` : s.effets.map((e) => EFFETS.find((x) => x.id === e)?.label ?? e).join(' + ') || 'noir'}</span>
                </button>
              ))}
            </div>
            <div className="lu-ligne">
              <input className="bp-text" value={nom} maxLength={40} placeholder="nom de la scène ou du set" aria-label="Nom" onChange={(e) => setNom(e.target.value)} />
              <button type="button" className="btn sm" disabled={!nom.trim() || busy === 'scene'} onClick={garderScene} title="Ajoute les réglages actuels au pad, sous ce nom">garder comme scène</button>
              {actif && <button type="button" className="btn sm" disabled={busy === 'maj'} onClick={majScene} title="Remplace la scène active par les réglages actuels">mettre à jour « {scenes.find((s) => s.id === actif)?.nom} »</button>}
              {actif && <button type="button" className="btn sm" disabled={!nom.trim() || busy === 'nom'} onClick={renommer} title="Donne à la scène active le nom écrit à gauche">renommer</button>}
              {actif && <span className="lu-ordre" role="group" aria-label="Place de la touche dans le pad">
                <button type="button" className="btn sm" disabled={busy === 'ordre' || scenes[0]?.id === actif} onClick={() => deplacer(-1)} aria-label="Déplacer la touche vers le début" title="Déplacer la touche vers le début">◂</button>
                <button type="button" className="btn sm" disabled={busy === 'ordre' || scenes[scenes.length - 1]?.id === actif} onClick={() => deplacer(1)} aria-label="Déplacer la touche vers la fin" title="Déplacer la touche vers la fin">▸</button>
              </span>}
              {actif && <button type="button" className="btn sm" onClick={() => void oter('scenes', actif, scenes.find((s) => s.id === actif)?.nom ?? '')}>supprimer</button>}
            </div>
          </Bloc>

          <Bloc id="sets" ouvertAuDepart={false} title="sets" lite="des suites de scènes, tenues un nombre de mesures">
            <div className="lu-ligne">
              {prise
                ? <button type="button" className="btn sm solid" onClick={finirPrise}><i className="tourne" aria-hidden />arrêter et garder ({prise.frappes.length} frappes)</button>
                : <button type="button" className="btn sm" onClick={() => { setJeu(null); if (!enDirect) setApercu(true); setPrise({ depuis: beatMaintenant(), frappes: actif ? [{ scene: actif, beat: beatMaintenant() }] : [] }) }} title="Joue au pad : chaque scène et sa durée sont retenues, arrondies à la mesure">enregistrer un set</button>}
              {prise && <button type="button" className="btn sm" onClick={() => setPrise(null)}>abandonner</button>}
              {jeu && <button type="button" className="btn sm" onClick={() => setJeu(null)}>arrêter le set</button>}
            </div>
            {d.sets.length === 0 && <p className="lu-note">Aucun set : lance « enregistrer un set », joue au pad, puis arrête.</p>}
            <div className="lu-sets">
              {d.sets.map((st) => (
                <div key={st.id} className={`lu-set ${jeu?.id === st.id ? 'on' : ''}`}>
                  <button type="button" className="btn sm" onClick={() => { setPrise(null); if (!enDirect) setApercu(true); setJeu(jeu?.id === st.id ? null : { id: st.id, depuis: Math.ceil(beatMaintenant()) }) }}>{jeu?.id === st.id ? 'arrêter' : 'lancer'}</button>
                  <b>{st.nom}</b>
                  <span>{st.pas.map((p, i) => <i key={i} className={jeu?.id === st.id && etape.current === i ? 'on' : ''}>{scenes.find((s) => s.id === p.scene)?.nom ?? '?'} ×{p.mesures}</i>)}</span>
                  <button type="button" className="btn sm" onClick={() => void oter('sets', st.id, st.nom)} aria-label={`Supprimer le set ${st.nom}`}>×</button>
                </div>
              ))}
            </div>
          </Bloc>
        </div>

        <div className="lu-droite">
          <div className={`lu-direct ${enDirect ? 'on' : ''} ${direct ? 'attente' : ''}`}>
            <button type="button" className="lu-direct-btn" disabled={direct !== ''} aria-pressed={enDirect} onClick={() => void basculeDirect()}>
              <span className="lu-direct-halo" aria-hidden />
              <span className="lu-direct-icone" aria-hidden>{direct ? <i className="tourne" /> : enDirect ? <span className="lu-barres"><i /><i /><i /><i /></span> : <span className="lu-play" />}</span>
              <span className="lu-direct-txt">
                <b>{direct === 'lance' ? 'allumage…' : direct === 'arrete' ? 'extinction…' : enDirect ? 'en direct sur tes lampes' : 'lancer sur les vraies lampes'}</b>
                <i>{direct === 'lance' ? 'huebeat ouvre la liaison avec le pont : une dizaine de secondes'
                  : enDirect && muet ? `${d.reel?.nom ?? 'scène en cours'} · rien à suivre : les lampes attendent un temps — touche pour arrêter`
                  : enDirect ? `${d.reel?.nom ?? 'scène en cours'} · ${hb?.bpm ? `${Math.round(hb.bpm)} pulsations/min` : 'du son, tempo pas encore trouvé'} — touche pour arrêter`
                    : 'démarre huebeat et joue la scène en cours dans ta pièce'}</i>
              </span>
            </button>
          </div>

          <Bloc id="musique" ouvertAuDepart={false} title="musique" lite={cale ? 'tempo détecté par huebeat' : 'tempo réglé ici'}>
            <label className="at-champ lu-periph" title="Ce que huebeat écoute pour trouver les temps : le son joué sur une sortie (la télé, un casque), ou un micro">tempo suivi sur
              <select value={d.peripherique ?? ''} disabled={busy === 'periph'} aria-label="Périphérique audio suivi pour le tempo" onChange={(e) => void choisirPeripherique(e.target.value)}>
                <option value="">réglage d'origine de huebeat</option>
                <optgroup label="ce qui est joué sur">
                  {(d.peripheriques ?? []).filter((p) => p.genre === 'sortie').map((p) => <option key={p.nom} value={p.nom}>{p.label}{p.actif ? ' · du son en ce moment' : ''}</option>)}
                </optgroup>
                <optgroup label="micros">
                  {(d.peripheriques ?? []).filter((p) => p.genre === 'micro').map((p) => <option key={p.nom} value={p.nom}>{p.label}</option>)}
                </optgroup>
              </select>
              {busy === 'periph' && <i className="tourne" aria-label="en cours" />}
            </label>
            <p className="lu-note">{cale ? 'Changer de périphérique relance huebeat dessus (une dizaine de secondes) ; la scène reprend ensuite.' : 'Pris en compte au prochain lancement.'}</p>
            {!cale && (
              <div className="lu-tempo">
                <button type="button" className="btn sm" onClick={taper} title="Trois tapes suffisent ; la dernière recale le premier temps">taper le tempo</button>
                <input type="range" min={60} max={180} step={1} value={bpm} aria-label="Tempo" onChange={(e) => setBpm(Number(e.target.value))} /><b>{bpm}</b>
              </div>
            )}
            {cale && <p className="lu-note">{hb?.bpm ? `${Math.round(hb.bpm)} pulsations par minute détectées.` : muet ? 'Silence, ou aucun temps pris par la détection : les lampes restent éteintes et se rallument au premier temps pris. Si la musique joue, monte la sensibilité.' : 'Du son, mais aucun temps détecté pour l’instant : l’effet tourne librement.'}</p>}
            <div className="lu-curseur">
              <span><b>{LEGENDES.sensibilite.label}</b><em>{commun.auto ? (posAuto === null ? 'automatique' : `automatique · ${MOTS.sensibilite(posAuto)}`) : MOTS.sensibilite(commun.sensibilite)}</em></span>
              <div className="lu-sens">
                <input type="range" min={0} max={100} step={1} disabled={Boolean(commun.auto)} value={commun.auto ? posAuto ?? commun.sensibilite : commun.sensibilite} aria-label={LEGENDES.sensibilite.label}
                  onChange={(e) => reglerCommun({ sensibilite: Number(e.target.value) })} />
                <button type="button" className={`btn sm ${commun.auto ? 'solid' : ''}`} aria-pressed={Boolean(commun.auto)} onClick={() => reglerCommun({ auto: !commun.auto })}
                  title="huebeat cherche seul le seuil où les coups de la musique ressortent, et le suit quand le morceau change">auto</button>
              </div>
              <p className="lu-legende">{commun.auto ? 'huebeat règle seul le seuil : il le baisse quand plus rien n’est pris, le remonte quand tout passe. Le curseur montre où il s’est posé.' : LEGENDES.sensibilite.quoi} <ApercuReglage cle="sensibilite" /></p>
            </div>
            <Ecoute actif={cale && Boolean(hb?.spatial)} onSensibilite={setPosAuto} />
            {d.canaux.erreur && <p className="chip warn">{d.canaux.erreur}</p>}
            {d.canaux.manquants.length > 0 && <p className="chip warn">sans place dans le plan : {d.canaux.manquants.join(', ')}</p>}
            {!d.canaux.erreur && <p className="lu-note">{Object.keys(d.canaux.canaux).length} canaux lumineux placés dans la pièce{d.canaux.zone ? ` (zone « ${d.canaux.zone} »)` : ''}.</p>}
          </Bloc>

          <Bloc id="pulsation" title="respiration et intensité" lite={`pour toutes les scènes · ${commun.intensite} %`}>
            {curseurCommun('intensite')}
            {!deuxD && curseurCommun('profondeur')}
            {curseurCommun('attaque')}
            {curseurCommun('retombee')}
            {curseurCommun('vie')}
            <details className="lu-fins">
              <summary>réglages fins</summary>
              {curseurCommun('plancher')}
            </details>
            <div className="lu-ligne">
              <button type="button" className="btn sm" onClick={() => reglerCommun(COMMUN_DEFAUT)}>revenir aux réglages d’origine</button>
            </div>
          </Bloc>

          <Bloc id="scene" title="réglages de la scène" lite={`${actif ? scenes.find((s) => s.id === actif)?.nom : 'libre'} · ${deuxD ? '2d' : '3d'}`}>
            <div className="lu-modes" role="radiogroup" aria-label="Façon de jouer la scène">
              {([['2d', 'sur le temps', 'Toutes les lampes réagissent d’un coup à chaque temps, sans aucun trajet : c’est la scène Iron Man.'],
                ['3d', 'dans l’espace', 'La lumière part du point source et voyage dans la pièce : une lampe éloignée s’allume plus tard.']] as const).map(([m, sous, aide]) => (
                <button key={m} type="button" role="radio" aria-checked={(live.mode ?? '3d') === m} className={`lu-mode ${(live.mode ?? '3d') === m ? 'on' : ''}`} onClick={() => regler({ mode: m })}>
                  <b>{m}</b><i>{sous}</i><span>{aide}</span>
                </button>
              ))}
            </div>
            {deuxD ? (
              <label className="at-champ">regroupement
                <select value={live.groupe ?? 'tous'} aria-label="Regroupement des lampes" onChange={(e) => regler({ groupe: e.target.value as Groupe })}>
                  <option value="tous">toutes les lampes ensemble</option><option value="alterne">une lampe sur deux, en alternance à chaque temps</option>
                </select>
              </label>
            ) : (<>
            <div className="lu-effets">
              {EFFETS.map((fx) => {
                const on = live.effets.includes(fx.id)
                return (
                  <button key={fx.id} type="button" className={`lu-effet ${on ? 'on' : ''}`} aria-pressed={on} title={fx.desc}
                    onClick={() => regler({ effets: (on ? live.effets.filter((x) => x !== fx.id) : [...live.effets, fx.id]) as FxId[] })}>{fx.label}</button>
                )
              })}
            </div>
            {live.effets.length > 0 && (
              <div className="lu-fxs">
                <p className="lu-legende">Chaque effet peut avoir ses propres couleurs, intensité, point source, respiration et tempo ; ce qui n’est pas coché suit la scène et les réglages communs.</p>
                {live.effets.map((fx) => <ReglagesEffet key={fx} fx={fx} r={live.reglages?.[fx]} base={live} commun={commun} onChange={(r) => reglerEffet(fx, r)} />)}
              </div>
            )}
            {live.effets.includes('mur') && (
              <label className="at-champ">sens du mur
                <select value={live.axe} aria-label="Sens du mur de lumière" onChange={(e) => regler({ axe: e.target.value as Axe })}>
                  <option value="x">de gauche à droite</option><option value="y">d'avant en arrière</option><option value="z">du sol au plafond</option>
                </select>
              </label>
            )}
            {live.effets.includes('raz') && (
              <label className="at-champ">la vague part
                <select value={live.depart ?? 'bas'} aria-label="Départ du raz de marée" onChange={(e) => regler({ depart: e.target.value as Depart })}>
                  <option value="bas">du sol, et monte</option><option value="centre">de la hauteur du point, vers le haut et le bas</option><option value="haut">du plafond, et descend</option>
                </select>
              </label>
            )}
            <div className="lu-point">
              <b>point source</b><span>en centimètres, comme dans le plan de pièce</span>
              {([['x', 'du mur gauche', lieu.dims.w], ['y', 'du mur de la tv', lieu.dims.h], ['z', 'hauteur depuis le sol', lieu.dims.d]] as const).map(([k, label, taille]) => (
                <label key={k} className="lu-axe">
                  <i>{label}</i>
                  <input type="range" min={0} max={100} step={0.5} value={live.source[k]} aria-label={`Point source, ${label}`} onChange={(e) => regler({ source: { ...live.source, [k]: Number(e.target.value) } })} />
                  <NumField value={Math.round((live.source[k] / 100) * taille)} min={0} max={Math.round(taille)} label={`Point source, ${label}, en centimètres`}
                    onCommit={(cm) => regler({ source: { ...live.source, [k]: Math.round((cm / taille) * 1000) / 10 } })} />
                  <em>cm</em>
                </label>
              ))}
            </div>
            </>)}
            {deuxD && <p className="lu-legende">En 2d, la forme du flash se règle dans « respiration et intensité » : la lumière arrive, la lumière repart, et la durée d’une pulsation.</p>}
            <div className="lu-palettes">
              {Object.entries(PALETTES).map(([id, p]) => (
                <button key={id} type="button" className={`lu-palette ${live.palette === id ? 'on' : ''}`} aria-pressed={live.palette === id} onClick={() => regler({ palette: id, couleurs: undefined })} title={p.label}>
                  <span style={{ background: `linear-gradient(90deg, ${p.couleurs.join(', ')})` }} /><i>{p.label}</i>
                </button>
              ))}
              <button type="button" className={`lu-palette ${live.palette === LIBRE ? 'on' : ''}`} aria-pressed={live.palette === LIBRE} onClick={() => reglerCouleurs(couleursLive)} title="Tes propres couleurs, à partir de celles en cours">
                <span style={{ background: live.palette === LIBRE ? `linear-gradient(90deg, ${[...couleursLive, couleursLive[0]].join(', ')})` : 'conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }} /><i>libre</i>
              </button>
            </div>
            {live.palette === LIBRE && (
              <div className="lu-couleurs">
                {couleursLive.map((c, i) => (
                  <span key={i} className="lu-couleur">
                    <input type="color" value={c} aria-label={`Couleur ${i + 1}`} onChange={(e) => reglerCouleurs(couleursLive.map((x, j) => (j === i ? e.target.value : x)))} />
                    {couleursLive.length > 1 && <button type="button" aria-label={`Retirer la couleur ${i + 1}`} onClick={() => reglerCouleurs(couleursLive.filter((_, j) => j !== i))}>×</button>}
                  </span>
                ))}
                {couleursLive.length < MAX_COULEURS && <button type="button" className="btn sm" onClick={() => reglerCouleurs([...couleursLive, '#ffffff'])}>+ couleur</button>}
                <p className="lu-legende">Les couleurs se succèdent dans cet ordre, au fil des mesures.</p>
              </div>
            )}
            <label className="lu-curseur">intensité
              <input type="range" min={10} max={100} step={1} value={live.intensite} aria-label="Intensité" onChange={(e) => regler({ intensite: Number(e.target.value) })} />
            </label>
          </Bloc>
        </div>
      </div>
    </>
  )
}
