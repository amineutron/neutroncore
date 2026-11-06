import { useMemo, useRef, useState } from 'react'
import { DEMO, apiGet, getApiKey } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { MAX_COULEURS, MIN_COULEURS, bilanPalette, couleursMesurees, extraireCouleurs, pixelsDeCouleurs } from '../../lib/spatialPalette'
import './lumiere-source.css'

type Origine = 'pochette' | 'ambilight' | 'photo'
type Lecture = { disponible: boolean; raison: string; lecteur?: string; titre?: string; artiste?: string; album?: string; statut?: string }
type Mesures = { ok: boolean; left: string[]; top: string[]; right: string[]; bottom: string[] }

const COTE_MAX = 80          // l'image est réduite avant l'analyse : quelques milliers de pixels suffisent
const PHOTO_MAX = 20 * 1024 * 1024

async function pixelsDeImage(blob: Blob): Promise<Uint8ClampedArray> {
  const bmp = await createImageBitmap(blob)
  try {
    const k = Math.min(1, COTE_MAX / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k))
    const toile = document.createElement('canvas')
    toile.width = w; toile.height = h
    const ctx = toile.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('le navigateur ne sait pas lire les pixels d’une image')
    ctx.drawImage(bmp, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h).data
  } finally { bmp.close() }
}

/** Compose une palette libre à partir d'une source : la pochette de l'album en cours, les couleurs que la télé mesure
 * (Ambilight), ou une photo importée. Rien n'est appliqué tant qu'on ne clique pas « utiliser cette palette ». */
export function PaletteSource({ onAppliquer }: { onAppliquer: (couleurs: string[]) => void }) {
  const [origine, setOrigine] = useState<Origine>('pochette')
  const [pixels, setPixels] = useState<Uint8ClampedArray | null>(null)
  const [voulues, setVoulues] = useState(5)
  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [message, setMessage] = useState('')
  const [occupe, setOccupe] = useState(false)
  const fichier = useRef<HTMLInputElement>(null)
  const couleurs = useMemo(() => (pixels ? extraireCouleurs(pixels, voulues) : []), [pixels, voulues])

  const lancer = async (travail: () => Promise<Uint8ClampedArray | null>) => {
    setOccupe(true); setMessage('')
    try { setPixels(await travail()) } catch (e) {
      setPixels(null)
      setMessage(e instanceof Error ? e.message : 'lecture impossible')
    } finally { setOccupe(false) }
  }

  const lirePochette = () => lancer(async () => {
    const l = await apiGet<Lecture>('/spatial/source/lecture')
    setLecture(l)
    if (!l.disponible) throw new Error(l.raison)
    const r = await fetch('/spatial/source/pochette', { headers: { Authorization: `Bearer ${getApiKey()}` } })
    if (r.status === 204 || !r.ok) throw new Error('la pochette n’a pas pu être lue (fichier absent ou site non pris en charge)')
    return pixelsDeImage(await r.blob())
  })

  const lireAmbilight = () => lancer(async () => {
    const m = await apiGet<Mesures>('/screens/measured')
    const couleursTele = couleursMesurees(m)
    if (!m.ok || couleursTele.length === 0) throw new Error('la télé ne donne pas ses couleurs en ce moment (éteinte, ou Ambilight arrêté)')
    return pixelsDeCouleurs(couleursTele)
  })

  const lirePhoto = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) { setMessage('ce fichier n’est pas une image'); return }
    if (f.size > PHOTO_MAX) { setMessage('image trop lourde (20 Mo au plus)'); return }
    void lancer(() => pixelsDeImage(f))
  }

  const choisir = (o: Origine) => { setOrigine(o); setPixels(null); setMessage('') }
  const bilan = pixels ? bilanPalette(couleurs) : ''

  return (
    <div className="lu-src">
      <div className="lu-src-onglets" role="group" aria-label="source des couleurs">
        {([['pochette', 'pochette de l’album'], ['ambilight', 'ambilight de la télé'], ['photo', 'une photo']] as const).map(([id, nom]) => (
          <button key={id} type="button" className={`btn sm ${origine === id ? 'solid' : ''}`} aria-pressed={origine === id} onClick={() => choisir(id)}>{nom}</button>
        ))}
      </div>

      {origine === 'pochette' && (
        <div className="lu-src-corps">
          <p className="lu-note">
            {DEMO ? 'En démonstration, aucun lecteur de musique n’est relié.'
              : lecture?.titre ? `${lecture.titre}${lecture.artiste ? ` — ${lecture.artiste}` : ''}${lecture.album ? ` (${lecture.album})` : ''}`
                : 'Prend la pochette du morceau en cours dans ton lecteur de musique (spotify, navigateur, vlc… tout ce qui parle à playerctl).'}
          </p>
          <button type="button" className="btn sm" disabled={occupe || DEMO} onClick={() => void lirePochette()}>prendre la pochette</button>
        </div>
      )}
      {origine === 'ambilight' && (
        <div className="lu-src-corps">
          <p className="lu-note">Lit les couleurs que la télé mesure sur son image à cet instant : lance un film ou une photo avant.</p>
          <button type="button" className="btn sm" disabled={occupe} onClick={() => void lireAmbilight()}>prendre les couleurs de la télé</button>
        </div>
      )}
      {origine === 'photo' && (
        <div className="lu-src-corps">
          <p className="lu-note">L’image reste dans ton navigateur : seules les couleurs obtenues sont gardées.</p>
          <input ref={fichier} type="file" accept="image/*" hidden onChange={(e) => { lirePhoto(e.target.files?.[0]); e.target.value = '' }} />
          <button type="button" className="btn sm" disabled={occupe} onClick={() => fichier.current?.click()}>choisir une photo</button>
        </div>
      )}

      {message && <p className="lu-src-erreur" role="alert">{message}</p>}
      {pixels && (
        <div className="lu-src-res">
          <div className="lu-src-nuances" aria-label="couleurs trouvées">
            {couleurs.map((c) => <span key={c} className="lu-src-nuance" style={{ background: c }} title={c} />)}
          </div>
          <p className="lu-note">{bilan}</p>
          <label className="lu-src-nombre">nombre de couleurs
            <select value={voulues} onChange={(e) => setVoulues(Number(e.target.value))}>
              {Array.from({ length: MAX_COULEURS - MIN_COULEURS + 1 }, (_, i) => MIN_COULEURS + i).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button type="button" className="btn solid" disabled={couleurs.length === 0}
            onClick={() => { onAppliquer(couleurs); toast('palette posée sur la scène : à enregistrer avec elle') }}>utiliser cette palette</button>
        </div>
      )}
    </div>
  )
}
