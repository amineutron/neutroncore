import { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet } from '../lib/api'
import { usePoll } from '../lib/poll'
import { toast } from '../lib/dialog'
import {
  ETAT_LABEL, lireAttente, axeHaut, defaultEtats, etatCommun, focusEtats, isolerEtats, mergeEtats, pieceLabel, rangeSelection, setEtat, toggleSelection,
  type Controle, type Etat, type Etats, type Jeu, type Vec3,
} from '../lib/atelier'
import { demandeCorrection } from '../lib/atelierControle'
import { camForDir, finalShots, montageShots, slideAt } from '../lib/atelierFilm'
import { compterFamilles, dirDuGeste, montageEtats, piecesProduit, slideOffsets, type Boites } from '../lib/atelierMontage'
import { PageTitle, Loader } from '../components/ui'
import { Viewer, type ViewerHandle } from '../components/atelier/Viewer'
import { PieceList, ordreAffiche } from '../components/atelier/PieceList'
import { ControlsBar } from '../components/atelier/ControlsBar'
import { IterationsPanel } from '../components/atelier/IterationsPanel'
import { Materials } from '../components/atelier/Materials'
import { Montage } from '../components/atelier/Montage'
import { LoopBubble } from '../components/atelier/LoopBubble'
import { LoopStatus } from '../components/atelier/LoopStatus'
import { useBoucles, type Launch } from '../components/atelier/useBoucles'
import { PROJET_ATELIER } from '../lib/atelierSessions'
import { ProjectBar } from '../components/atelier/ProjectBar'
import { Plans } from '../components/atelier/Plans'
import { Questions } from '../components/atelier/Questions'
import { FilmOverlay, useFilm } from '../components/atelier/Film'
import { useMontage } from '../components/atelier/useMontage'

type Tab = 'pieces' | 'iterations' | 'materiaux' | 'montage' | 'plans'
const TABS: { id: Tab; label: string }[] = [{ id: 'pieces', label: 'pièces' }, { id: 'iterations', label: 'itérations' }, { id: 'materiaux', label: 'matériaux' }, { id: 'montage', label: 'montage' }, { id: 'plans', label: 'plans' }]
const TAB_STORAGE = 'neutroncore_atelier_tab'
const HAUT_STORAGE = 'neutroncore_atelier_haut'
const TITRE = <PageTitle help="atelier" title="atelier 3d" desc="Les pièces modélisées, leurs contrôles et leurs itérations." />

const download = (href: string, name: string) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }

export function Atelier() {
  const list = usePoll<{ modeles: { nom: string }[]; masques?: string[] }>(() => apiGet('/modelisation'), 60000)
  // arrivée depuis l'accueil : le projet dont on a touché la boucle
  const [modele, setModele] = useState(() => { try { const m = sessionStorage.getItem(PROJET_ATELIER) ?? ''; sessionStorage.removeItem(PROJET_ATELIER); return m } catch { return '' } })
  const [iteration, setIteration] = useState('courant')
  const modeles = list.data?.modeles ?? []
  const nom = modeles.some((m) => m.nom === modele) ? modele : modeles[0]?.nom ?? ''
  const jeu = usePoll<Jeu>(() => (nom ? apiGet(`/modelisation/${nom}${iteration === 'courant' ? '' : `?iteration=${iteration}`}`) : Promise.reject(new Error('aucun modèle'))), 8000)
  // le polling garde le fetcher courant : relire tout de suite au changement de modèle ou d'itération
  useEffect(() => { if (nom) jeu.refresh() }, [nom, iteration]) // eslint-disable-line react-hooks/exhaustive-deps

  // pendant qu'une autre itération arrive, on garde la précédente à l'écran : la vue 3D n'est pas démontée,
  // et les réglages des pièces survivent au changement
  const fresh = jeu.data && jeu.data.nom === nom && jeu.data.iteration === iteration ? jeu.data : null
  const kept = useRef<Jeu | null>(null)
  if (fresh) kept.current = fresh
  const data = fresh ?? (kept.current?.nom === nom ? kept.current : null)
  // le relevé périodique rend un objet neuf à chaque fois : on ne change de pièces que si leur liste change vraiment,
  // sinon l'animation d'un geste de montage repartirait de zéro toutes les quelques secondes
  const piecesKey = (data?.pieces ?? []).map((p) => `${p.groupe}/${p.chemin}`).join(',')
  const pieces = useMemo(() => data?.pieces ?? [], [piecesKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const clesKey = (data?.resume?.nomenclature ?? []).map((a) => a.cle).join(',')
  const cles = useMemo(() => (clesKey ? clesKey.split(',') : []), [clesKey])
  const [etats, setEtats] = useState<Etats>({})
  const [selection, setSelection] = useState<string[]>([])
  const [multi, setMulti] = useState(false)
  const [explode, setExplode] = useState(0)
  const [around, setAround] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [tab, setTabState] = useState<Tab>(() => { try { const t = localStorage.getItem(TAB_STORAGE) as Tab | null; return TABS.some((x) => x.id === t) ? t! : 'pieces' } catch { return 'pieces' } })
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem(TAB_STORAGE, t) } catch { /* préférence de session */ } }
  const [boites, setBoites] = useState<Boites>({})
  const [launch, setLaunch] = useState<Launch | null>(null)
  const [seed, setSeed] = useState<{ id: number; texte: string } | null>(null)
  const viewer = useRef<ViewerHandle | null>(null)
  const anchor = useRef<string | null>(null)        // dernière pièce touchée dans la liste (Maj + clic)

  const names = pieces.map((p) => p.nom).join(',')
  useEffect(() => {
    setEtats((old) => mergeEtats(old, pieces))
    setSelection((old) => old.filter((n) => pieces.some((p) => p.nom === n)))
  }, [names]) // eslint-disable-line react-hooks/exhaustive-deps

  // axe vertical choisi par projet (un modèle peut être dessiné couché, comme sur le plateau d'impression)
  const [hauts, setHauts] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(HAUT_STORAGE) ?? '{}') as Record<string, string> } catch { return {} } })
  const haut = axeHaut(hauts[nom], data?.resume ?? null)
  const setHaut = (h: 'y' | 'z') => { const next = { ...hauts, [nom]: h }; setHauts(next); try { localStorage.setItem(HAUT_STORAGE, JSON.stringify(next)) } catch { /* préférence de confort */ } }
  const montage = useMontage({ data, pieces, boites, haut, etats, setEtats, setSelection, viewer, visible: tab === 'montage' })
  const film = useFilm(viewer)
  const boucles = useBoucles(nom, launch)
  const [ouvrirBulle, setOuvrirBulle] = useState(0)

  const apply = (noms: string[], etat: Etat) => setEtats((e) => setEtat(e, noms, etat))
  const onPick = (n: string | null, m: boolean, at: { x: number; y: number }) => {
    if (!n) { if (!m) { setSelection([]); setMenu(null) } return }
    const next = toggleSelection(selection, n, m)
    setSelection(next)
    setMenu(next.length > 0 ? at : null)
  }
  const pickInList = (n: string, plage: boolean) => {
    setMenu(null)
    const ancre = anchor.current        // lue maintenant : la mise à jour d'état s'exécute après le changement d'ancre
    setSelection((sel) => (plage ? rangeSelection(ordreAffiche(pieces, cles), ancre, n, sel) : toggleSelection(sel, n, true)))
    anchor.current = n
  }
  const pickMany = (noms: string[]) => setSelection((sel) => (noms.every((n) => sel.includes(n)) ? sel.filter((n) => !noms.includes(n)) : [...sel, ...noms.filter((n) => !sel.includes(n))]))
  const focus = (noms: string[]) => { setSelection(noms); setEtats((e) => focusEtats(e, noms)); setMenu(null) }
  const showFamily = (cle: string) => {
    const noms = pieces.filter((p) => p.nom === cle || p.nom.startsWith(`${cle}_`)).map((p) => p.nom)
    if (noms.length === 0) { toast('cette pièce n’a pas de forme dans le modèle', 'warn'); return }
    focus(noms)
  }
  const askFix = (c: Controle, liees: string[]) => { setSelection(liees); setSeed({ id: Date.now(), texte: demandeCorrection(c) }); setTab('iterations') }
  const pickProject = (m: string) => { setModele(m); setIteration('courant'); setSelection([]); setBoites({}); montage.quit() }

  // la coupe en place au moment du tournage est filmée telle quelle : avec ou sans, au choix
  const filmMontage = () => {
    const { steps, base } = montage
    const mobiles = steps.map((s) => [...s.nouvelles, ...s.reprises])
    const departs = mobiles.map((m) => slideOffsets(m, boites, base))
    const shots = montageShots(pieceLabel(nom), steps, mobiles.map((m) => camForDir(dirDuGeste(m, boites, base))), mobiles.map((m) => compterFamilles(m, cles)))
    const tout = defaultEtats(pieces)
    void film.start('notice de montage', `${nom}-montage`, shots, {
      style: 'notice',
      poseOf: (shot, u) => {
        if (shot.step === undefined) return { etats: tout }
        const reste = 1 - slideAt(u)
        return {
          etats: montageEtats(pieces, steps[shot.step]), accent: mobiles[shot.step],
          offsets: Object.fromEntries(Object.entries(departs[shot.step]).map(([n, v]) => [n, [v[0] * reste, v[1] * reste, v[2] * reste] as Vec3])),
        }
      },
    })
  }
  const filmFinal = () => {
    // l'objet fini seulement : un outil imprimé posé à côté (gabarit de pliage) n'est pas dans le film
    const produit = piecesProduit(pieces, boites)
    const n = pieces.filter((p) => p.groupe === 'pieces' && produit.includes(p.nom)).length, c = pieces.filter((p) => p.groupe === 'composants').length
    const etatsFilm = Object.fromEntries(pieces.map((p) => [p.nom, produit.includes(p.nom) ? 'shown' : 'hidden'])) as Etats
    void film.start('présentation', `${nom}-presentation`, finalShots(pieceLabel(nom), [`${n} pièce${n > 1 ? 's' : ''} imprimée${n > 1 ? 's' : ''}`, c > 0 ? `${c} composant${c > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')),
      { style: 'pub', poseOf: () => ({ etats: etatsFilm, cible: produit }) })
  }

  // Échap referme le menu de pièce
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  const projets = list.data && <ProjectBar modeles={modeles} masques={list.data.masques ?? []} nom={nom} onPick={pickProject}
    onChanged={(m) => { list.refresh(); if (m) pickProject(m); else { setModele(''); kept.current = null } }} />
  if (list.data && modeles.length === 0) {
    return <>{TITRE}<div className="at-head">{projets}</div><p className="at-faint">Aucun projet dans l'atelier : crée le premier, ou remets un projet retiré.</p></>
  }
  const common = selection.length ? etatCommun(etats, selection) : 'mixed'
  const attenteLue = lireAttente(data?.courant.attente)
  const pret = Boolean(data) && pieces.length > 0 && Object.keys(boites).length > 0 && !film.tournage
  const exports = <>
    <button className="btn sm" disabled={!pret} onClick={() => { const png = viewer.current?.snapshot(); if (png) download(png, `${nom}-${iteration}.png`) }}>image</button>
    <button className="btn sm" disabled={!pret || montage.steps.length === 0} onClick={filmMontage} title="Notice filmée : un geste après l'autre, chaque pièce arrive à sa place">vidéo de montage</button>
    <button className="btn sm" disabled={!pret} onClick={filmFinal} title="Film de présentation : travelling autour de l'objet, plongée, vue éclatée, pose finale">vidéo de présentation</button>
  </>
  return (
    <>
      {TITRE}
      <div className="at-head">
        {projets}
        <span className="chip gold">{iteration === 'courant' ? 'en direct' : `itération ${iteration}`}</span>
        {iteration !== 'courant' && <button className="btn sm" onClick={() => setIteration('courant')}>revenir au direct</button>}
      </div>
      {((jeu.error && nom) || list.error) && !data && <p className="chip crit">API injoignable : {jeu.error ?? list.error}</p>}
      {!data && !(jeu.error && nom) && !list.error && <Loader label="lecture du modèle…" />}
      {data && (
        <div className="at-layout">
          <div className="at-main" onPointerDownCapture={() => setMenu(null)}>
            <LoopStatus boucles={boucles} launch={launch} etape={data.courant.etape} numero={data.courant.numero} attente={data.courant.attente} onOpen={() => setOuvrirBulle((n) => n + 1)}
              questions={iteration === 'courant' && attenteLue && attenteLue.points.length > 0
                ? <Questions modele={nom} points={attenteLue.points} pieces={pieces} boites={boites} haut={haut} viewer={viewer} pret={pret && !montage.anim} onFocus={focus} /> : undefined} />
            {pieces.length === 0 && !boucles.duProjet && !boucles.attendue && <p className="at-vide">Ce projet n'a pas encore de pièces. Décris ce que tu veux dans l'onglet « itérations » pour lancer sa première conception.</p>}
            <Viewer modele={nom} iteration={data.iteration} pieces={pieces} maj={data.maj} haut={haut} onHaut={setHaut} etats={etats} selection={selection} multi={multi} explode={explode} explodeAround={around}
              anim={montage.anim} speed={montage.speed} paused={montage.paused} onGeometry={setBoites}
              onPick={onPick} onMulti={setMulti} onExplode={(f, a) => { setExplode(f); setAround(a) }} handle={viewer}
              onShowAll={() => { montage.quit(); setEtats(mergeEtats({}, pieces)) }} exports={exports} />
            {selection.length > 0 && (
              <div className="at-selbar" role="toolbar" aria-label="Actions sur la sélection">
                <b>{selection.length === 1 ? pieceLabel(selection[0]) : `${selection.length} pièces`}</b>
                {(['shown', 'ghost', 'hidden'] as Etat[]).map((e) => (
                  <button key={e} className={`btn sm ${common === e ? 'solid' : ''}`} onClick={() => apply(selection, e)}>{ETAT_LABEL[e]}</button>
                ))}
                <button className="btn sm" onClick={() => focus(selection)} title="La sélection reste nette, le reste passe en fantôme">focus</button>
                <button className="btn sm" onClick={() => { setEtats((e) => isolerEtats(e, selection)); setMenu(null) }}>isoler</button>
                <button className="btn sm" onClick={() => { setAround(true); setExplode(explode > 0 ? explode : 0.6) }} title="Écarter les autres pièces autour de la sélection ; le curseur « éclaté » règle la distance">éclater autour</button>
                <button className="btn sm" onClick={() => setTab('iterations')}>demander une correction</button>
                <button className="btn sm" onClick={() => { setSelection([]); setMenu(null) }} aria-label="Vider la sélection">×</button>
              </div>
            )}
            <ControlsBar controles={data.controles} decompte={data.decompte} pieces={pieces.map((p) => p.nom)} onFocus={focus} onAsk={askFix} />
          </div>
          <aside className="at-side">
            <div className="at-tabs" role="tablist">
              {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={`btn sm ${tab === t.id ? 'solid' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
            </div>
            {tab === 'pieces' && <PieceList pieces={pieces} cles={cles} etats={etats} selection={selection} onEtat={apply} onSelect={pickInList} onSelectMany={pickMany} onClear={() => setSelection([])} />}
            {tab === 'iterations' && <IterationsPanel jeu={data} selection={selection} seed={seed} describeView={() => viewer.current?.describeView() ?? ''}
              onIteration={(it) => { montage.quit(); setIteration(it) }} onClearSelection={() => setSelection([])} onLaunched={setLaunch} />}
            {tab === 'materiaux' && <Materials resume={data.resume} onShow={showFamily} />}
            {tab === 'montage' && <Montage steps={montage.steps} cles={cles} index={montage.step} thumbs={montage.thumbs} paused={montage.paused} speed={montage.speed} fantome={montage.fantome} enchainer={montage.enchainer}
              onIndex={montage.go} onPaused={montage.setPaused} onSpeed={montage.setSpeed} onFantome={montage.setFantome} onEnchainer={montage.setEnchainer} onQuit={montage.quit} />}
            {tab === 'plans' && <Plans jeu={data} />}
          </aside>
          {menu && selection.length === 1 && (
            <div className="at-menu" style={{ left: Math.min(menu.x, window.innerWidth - 200), top: Math.min(menu.y, window.innerHeight - 240) }} role="menu" aria-label={`Pièce ${pieceLabel(selection[0])}`}>
              <b>{pieceLabel(selection[0])}</b>
              {(['shown', 'ghost', 'hidden'] as Etat[]).filter((e) => e !== etats[selection[0]]).map((e) => (
                <button key={e} role="menuitem" onClick={() => { apply(selection, e); setMenu(null); if (e === 'hidden') setSelection([]) }}>{e === 'shown' ? 'afficher' : e === 'ghost' ? 'mettre en fantôme' : 'cacher'}</button>
              ))}
              <button role="menuitem" onClick={() => focus(selection)}>focus</button>
              <button role="menuitem" onClick={() => setMenu(null)}>fermer</button>
            </div>
          )}
        </div>
      )}
      <LoopBubble modele={nom} boucles={boucles} launch={launch} ouvrir={ouvrirBulle} onProject={pickProject}
        onNew={() => { setTab('iterations'); window.setTimeout(() => document.getElementById('at-demande-texte')?.focus(), 60) }} />
      <FilmOverlay tournage={film.tournage} onCancel={film.cancel} />
    </>
  )
}
