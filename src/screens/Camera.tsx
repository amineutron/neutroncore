import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut, apiUpload, getApiKey, withConfirm, DEMO } from '../lib/api'
import { usePoll } from '../lib/poll'
import { confirmDialog, toast } from '../lib/dialog'
import {
  degradeCss, etatCamera, mesures, motDurete, motMarge, motStabilite, refusFond, tailleLisible,
  type Camera as Etat, type FondImporte, type Reglages,
} from '../lib/camera'
import { Card, Chip, Loader, PageTitle } from '../components/ui'

const TITRE = <PageTitle help="camera" title="caméra" desc="Ta webcam détourée, avec le fond que tu choisis, vue comme une caméra par les applications de visio." />
type Patch = { fond?: Partial<Reglages['fond']>; detourage?: Partial<Reglages['detourage']>; veille?: boolean; modele?: Reglages['modele']; virtuelle?: boolean; cadence?: 30 | 60 }

// Aperçu : le flux continu du moteur (30 images par seconde), affiché par une simple balise image. Le navigateur
// ne peut pas y joindre la clé de l'API : l'adresse porte un jeton court, redemandé si le flux se coupe.
function Apercu({ actif, attente }: { actif: boolean; attente: string }) {
  const [src, setSrc] = useState('')
  const [essai, setEssai] = useState(0)
  useEffect(() => {
    if (!actif || DEMO) { setSrc(''); return }
    let dead = false
    void withConfirm('camera_flux').then((h) => { if (!dead) setSrc(`/camera/flux?jeton=${encodeURIComponent(h['X-Confirm'])}`) })
      .catch(() => { if (!dead) window.setTimeout(() => setEssai((n) => n + 1), 1500) })
    return () => { dead = true }
  }, [actif, essai])
  return (
    <div className="cam-apercu">
      {src && actif
        ? <img src={src} alt="Aperçu de la caméra" onError={() => { setSrc(''); window.setTimeout(() => setEssai((n) => n + 1), 800) }} />
        : attente ? <span className="cam-patiente"><i className="tourne" />{attente}</span> : <span>caméra éteinte</span>}
    </div>
  )
}

// Curseur dont la valeur part à l'API pendant qu'on le déplace (au plus cinq fois par seconde) : on voit l'effet en direct.
function Curseur({ label, mot, aide, min, max, value, onChange }: {
  label: string; mot: string; aide: string; min: number; max: number; value: number; onChange: (v: number) => void
}) {
  const [local, setLocal] = useState(value)
  const attente = useRef<number | null>(null)
  const touche = useRef(false)
  useEffect(() => { if (!touche.current) setLocal(value) }, [value])
  const envoyer = (v: number) => {
    setLocal(v)
    touche.current = true
    if (attente.current) window.clearTimeout(attente.current)
    attente.current = window.setTimeout(() => { onChange(v); window.setTimeout(() => { touche.current = false }, 800) }, 180)
  }
  return (
    <label className="cam-curseur" title={aide}>
      <span><b>{label}</b><em>{mot}</em></span>
      <input type="range" min={min} max={max} step={1} value={local} aria-label={label} onChange={(e) => envoyer(Number(e.target.value))} />
      <small>{aide}</small>
    </label>
  )
}

function VignetteFond({ f, choisi, attente, onPick, onDelete }: { f: FondImporte; choisi: boolean; attente: boolean; onPick: () => void; onDelete: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (f.genre !== 'image' || DEMO) return
    let dead = false, cree = ''
    void fetch(`/camera/fonds/${encodeURIComponent(f.nom)}`, { headers: { Authorization: `Bearer ${getApiKey()}` } })
      .then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b && !dead) { cree = URL.createObjectURL(b); setUrl(cree) } }).catch(() => { /* vignette absente */ })
    return () => { dead = true; if (cree) URL.revokeObjectURL(cree) }
  }, [f.nom, f.genre])
  return (
    <div className={`cam-fond ${choisi ? 'on' : ''}`}>
      <button type="button" className="cam-fond-img" aria-pressed={choisi} onClick={onPick} title={`Utiliser ${f.nom}`}
        style={url ? { backgroundImage: `url(${url})` } : undefined}>{attente ? <i className="tourne" aria-label="en cours" /> : !url && <span>{f.genre === 'video' ? 'vidéo' : '…'}</span>}</button>
      <span className="cam-fond-nom" title={f.nom}>{f.nom}</span>
      <span className="cam-fond-bas"><i>{tailleLisible(f.taille)}</i><button type="button" className="btn sm" onClick={onDelete} aria-label={`Supprimer ${f.nom}`}>×</button></span>
    </div>
  )
}

export function Camera() {
  const etat = usePoll<Etat>(() => apiGet('/camera'), 2000)
  const [busy, setBusy] = useState('')
  // ce qu'on vient de demander et qui n'est pas encore visible : le bouton touché tourne en attendant
  const [attente, setAttente] = useState('')
  const [vise, setVise] = useState<'on' | 'off' | null>(null)       // allumage ou extinction demandés, pas encore effectifs
  const fichier = useRef<HTMLInputElement>(null)
  const d = etat.data
  // l'attente se termine quand la caméra est vraiment dans l'état demandé (ou en erreur), au plus tard après 25 s
  const tourne = Boolean(d?.moteur.actif || d?.moteur.demarre)
  const arrivee = vise === 'on' ? Boolean(d?.moteur.actif || d?.moteur.erreur) : vise === 'off' ? !tourne : true
  useEffect(() => { if (vise && arrivee) setVise(null) }, [vise, arrivee])
  useEffect(() => { if (!vise) return; const t = window.setTimeout(() => setVise(null), 25000); return () => window.clearTimeout(t) }, [vise])
  if (!d) return <>{TITRE}{etat.error ? <p className="chip crit">API injoignable : {etat.error}</p> : <Loader label="lecture de la caméra…" />}</>
  const r = d.reglages
  const e = etatCamera(d.moteur, r.veille)
  const Tourne = ({ cle }: { cle: string }) => (attente === cle ? <i className="tourne" aria-label="en cours" /> : null)

  const regler = async (patch: Patch, cle = '') => {
    if (cle) setAttente(cle)
    try {
      const res = await apiPut<{ success: boolean; error?: string }>('/camera/reglages', { reglages: patch })
      if (!res.success) toast(res.error ?? 'réglage refusé', 'crit')
      etat.refresh()
    } catch (err) { toast((err as Error).message, 'crit') }
    // le moteur relit ses réglages deux fois par seconde : on laisse tourner jusqu'à ce que l'image ait changé
    finally { if (cle) window.setTimeout(() => setAttente((a) => (a === cle ? '' : a)), 650) }
  }
  const allume = d.moteur.actif || d.moteur.demarre
  const bascule = async () => {
    const cible = allume ? 'off' : 'on'
    setVise(cible)
    try {
      const res = await apiPost<{ success: boolean; error?: string }>(cible === 'off' ? '/camera/arreter' : '/camera/demarrer')
      if (!res.success) { toast(res.error ?? 'échec', 'crit'); setVise(null) }
      etat.refresh()
    } catch (err) { toast((err as Error).message, 'crit'); setVise(null) }
  }
  const patiente = vise === 'on' || d.moteur.demarre ? (d.moteur.phase && d.moteur.demarre ? `${d.moteur.phase}…` : 'allumage de la caméra…') : vise === 'off' ? 'extinction…' : d.moteur.actif ? 'première image…' : ''
  const importer = async (f: File | undefined) => {
    if (!f) return
    const refus = refusFond(f.name, f.size, d.limites)
    if (refus) { toast(refus, 'warn'); return }
    setBusy('import')
    try {
      const res = await apiUpload<{ success: boolean; error?: string; nom?: string }>('/camera/fonds', 'fichier', f)
      if (!res.success || !res.nom) toast(res.error ?? 'import refusé', 'crit')
      else await regler({ fond: { mode: 'fichier', nom: res.nom }, veille: false })
      etat.refresh()
    } catch (err) { toast((err as Error).message, 'crit') } finally { setBusy(''); if (fichier.current) fichier.current.value = '' }
  }
  const supprimer = async (f: FondImporte) => {
    if (!(await confirmDialog({ title: `supprimer ${f.nom} ?`, body: 'Le fichier est effacé du dossier des fonds. Si c’est le fond en cours, la caméra repasse en flou.', ok: 'supprimer', danger: true }))) return
    try { await apiDelete(`/camera/fonds/${encodeURIComponent(f.nom)}`, await withConfirm('camera_fond_supprimer')); etat.refresh() } catch (err) { toast((err as Error).message, 'crit') }
  }
  const mode = r.fond.mode
  const detoure = mode !== 'aucun' && !r.veille

  return (
    <>
      {TITRE}
      <div className="cam-tete">
        <Chip tone={e.tone === 'off' ? undefined : e.tone}>{e.texte}</Chip>
        <span className="cam-mesures">{d.moteur.actif || d.moteur.demarre ? mesures(d.moteur) : ''}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className={`btn sm ${r.veille ? 'solid' : ''}`} aria-pressed={r.veille} disabled={!d.moteur.actif}
          title="Remplace ton image par une carte d’attente : la caméra reste allumée pour l’application de visio, mais on ne te voit plus"
          onClick={() => void regler({ veille: !r.veille }, 'veille')}><Tourne cle="veille" />{r.veille ? 'reprendre' : 'mettre en veille'}</button>
        <button type="button" className={`btn ${allume ? '' : 'solid'}`} disabled={vise !== null} aria-busy={vise !== null} onClick={() => void bascule()}>
          {vise && <i className="tourne" aria-hidden />}{vise === 'on' ? 'allumage…' : vise === 'off' ? 'extinction…' : allume ? 'éteindre' : 'allumer'}</button>
      </div>
      {d.installee === false && <p className="chip warn">La caméra est un élément facultatif qui n’est pas installé ici : il lui faut un environnement Python avec torch et OpenCV, indiqué à l’API par la variable CAMERA_PYTHON.</p>}
      {d.moteur.erreur && <p className={`chip ${d.moteur.actif ? 'warn' : 'crit'}`}>{d.moteur.erreur}</p>}
      {d.moteur.note && d.moteur.actif && <p className="chip warn">{d.moteur.note}</p>}

      <div className="cam-grille">
        <div className="cam-gauche">
          <Apercu actif={d.moteur.actif && vise !== 'off'} attente={patiente} />
          <div className="cam-virtuelle">
            <button type="button" className={`btn ${r.virtuelle ? 'solid' : ''}`} aria-pressed={r.virtuelle}
              title="Publie cette image comme une caméra de l’ordinateur : le navigateur et les autres applications peuvent la choisir"
              onClick={() => void regler({ virtuelle: !r.virtuelle }, 'virtuelle')}><Tourne cle="virtuelle" />caméra virtuelle : {r.virtuelle ? 'activée' : 'désactivée'}</button>
            <label className="at-champ" title="60 images par seconde : plus fluide, la carte graphique travaille deux fois plus">fluidité
              <select value={r.cadence} aria-label="Images par seconde" onChange={(ev) => void regler({ cadence: Number(ev.target.value) as 30 | 60 }, 'cadence')}>
                <option value={30}>30 images/s</option><option value={60}>60 images/s</option>
              </select>
              <Tourne cle="cadence" />
            </label>
          </div>
          <p className="cam-note">
            {d.moteur.sortie_erreur ? d.moteur.sortie_erreur
              : r.virtuelle ? (d.moteur.actif ? 'Dans le navigateur ou l’application, choisis la caméra « OBS Virtual Camera » : c’est celle-ci.' : 'Elle apparaîtra dans le navigateur et les applications dès que la caméra sera allumée.')
              : 'Désactivée : l’image ne sort pas d’ici, les applications ne voient rien. Pratique pour régler sans être vu.'}
          </p>
        </div>

        <div className="cam-droite">
          <Card title="fond">
            <div className="at-seg" role="group" aria-label="Type de fond">
              {([['aucun', 'caméra telle quelle'], ['flou', 'flouté'], ['prefait', 'préfait'], ['fichier', 'importé']] as const).map(([m, label]) => (
                <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m}
                  onClick={() => {
                    if (m === 'prefait') void regler({ fond: { mode: m, nom: d.prefaits.some((p) => p.nom === r.fond.nom) ? r.fond.nom : d.prefaits[0]?.nom ?? '' }, veille: false }, `mode:${m}`)
                    else if (m === 'fichier') { if (d.fonds.length) void regler({ fond: { mode: m, nom: d.fonds.some((f) => f.nom === r.fond.nom) ? r.fond.nom : d.fonds[0].nom }, veille: false }, `mode:${m}`); else fichier.current?.click() }
                    else void regler({ fond: { mode: m, nom: '' }, veille: false }, `mode:${m}`)
                  }}><Tourne cle={`mode:${m}`} />{label}</button>
              ))}
            </div>
            {mode === 'aucun' && <p className="cam-note">Ton image part telle quelle : aucun détourage, la carte graphique n’est pas sollicitée.</p>}
            {mode === 'flou' && (
              <Curseur label="intensité du flou" mot={`${r.fond.flou} %`} aide="De presque net à très flou." min={0} max={100} value={r.fond.flou} onChange={(v) => void regler({ fond: { flou: v } })} />
            )}
            {mode === 'prefait' && (
              <div className="cam-fonds">
                {d.prefaits.map((p) => (
                  <div key={p.nom} className={`cam-fond ${r.fond.nom === p.nom ? 'on' : ''}`}>
                    <button type="button" className="cam-fond-img" aria-pressed={r.fond.nom === p.nom} style={{ backgroundImage: degradeCss(p) }}
                      onClick={() => void regler({ fond: { mode: 'prefait', nom: p.nom }, veille: false }, `fond:${p.nom}`)} title={p.label}><Tourne cle={`fond:${p.nom}`} /></button>
                    <span className="cam-fond-nom">{p.label}</span>
                  </div>
                ))}
              </div>
            )}
            {mode === 'fichier' && (
              <div className="cam-fonds">
                {d.fonds.map((f) => <VignetteFond key={f.nom} f={f} choisi={r.fond.nom === f.nom} attente={attente === `fond:${f.nom}`} onPick={() => void regler({ fond: { mode: 'fichier', nom: f.nom }, veille: false }, `fond:${f.nom}`)} onDelete={() => void supprimer(f)} />)}
                {d.fonds.length === 0 && <p className="cam-note">Aucun fond importé pour l’instant.</p>}
              </div>
            )}
            <div className="at-row" style={{ marginTop: 10 }}>
              <button type="button" className="btn sm" disabled={busy === 'import'} onClick={() => fichier.current?.click()}>{busy === 'import' && <i className="tourne" aria-hidden />}{busy === 'import' ? 'envoi…' : 'importer une image ou une vidéo'}</button>
              <input ref={fichier} type="file" hidden accept={d.limites.formats.join(',')} onChange={(ev) => void importer(ev.target.files?.[0])} />
              <span className="cam-note">{tailleLisible(d.limites.taille_fond)} au plus</span>
            </div>
          </Card>

          <Card title="détourage">
            {!detoure && <p className="cam-note">{r.veille ? 'En veille : le détourage est à l’arrêt.' : 'Sans fond de remplacement, rien n’est détouré : ces réglages servent dès que tu choisis un fond.'}</p>}
            <Curseur label="durcissement" mot={motDurete(r.detourage.durete)} aide="Bord doux et fondu, ou bord net et tranché autour de toi." min={0} max={100} value={r.detourage.durete} onChange={(v) => void regler({ detourage: { durete: v } })} />
            <Curseur label="marge" mot={motMarge(r.detourage.marge)} aide="Rogne le contour (liseré du vrai fond qui dépasse) ou l’élargit (cheveux, épaules coupés)." min={-20} max={20} value={r.detourage.marge} onChange={(v) => void regler({ detourage: { marge: v } })} />
            <Curseur label="stabilité" mot={motStabilite(r.detourage.stabilite)} aide="Lisse le contour d’une image à l’autre : moins de scintillement, mais il suit un peu moins vite tes gestes." min={0} max={100} value={r.detourage.stabilite} onChange={(v) => void regler({ detourage: { stabilite: v } })} />
            <label className="at-champ" title="Le modèle fin est fait pour la visio (cheveux, bords) ; le modèle de repli est plus grossier">modèle
              <select value={r.modele} aria-label="Modèle de détourage" onChange={(ev) => void regler({ modele: ev.target.value as Reglages['modele'] }, 'modele')}>
                <option value="auto">automatique (fin, sinon repli)</option><option value="rvm">fin (visio)</option><option value="deeplab">de repli (général)</option>
              </select>
              <Tourne cle="modele" />
            </label>
          </Card>
        </div>
      </div>
    </>
  )
}
