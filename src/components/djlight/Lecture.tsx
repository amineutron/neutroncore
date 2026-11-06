import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { DjMoteur, Lecture as LectureMoteur } from '../../lib/djMoteur'
import { NOTES, nomDeCle } from '../../lib/djAnalyse'
import type { ImageAudio } from '../../lib/djSignaux'
import { NOTES_ANGLAIS } from '../../lib/djDessin'
import { tempoTape } from '../../lib/spatialFx'

const MAJEUR = [0, 2, 4, 5, 7, 9, 11], MINEUR = [0, 2, 3, 5, 7, 8, 10]
const PHASES = { normal: ['en cours', 'le morceau suit son cours'], break: ['break', 'les basses se sont retirées : un drop peut suivre'], montee: ['montée', 'tension qui monte : un drop peut suivre'] } as const

/** La lecture musicale : où en est le morceau, sa tonalité, sa chaleur, son tempo. Relevée dix fois par seconde. */
export function LectureMusicale({ moteur, image, silence }: { moteur: DjMoteur; image: MutableRefObject<ImageAudio | null>; silence: boolean }) {
  const [l, setL] = useState<LectureMoteur>(() => moteur.lecture(performance.now()))
  const [notes, setNotes] = useState<number[]>(new Array(12).fill(0))
  const tapes = useRef<number[]>([])
  useEffect(() => {
    const id = window.setInterval(() => { setL(moteur.lecture(performance.now())); setNotes(image.current?.chroma ?? new Array(12).fill(0)) }, 100)
    return () => window.clearInterval(id)
  }, [moteur, image])

  const taper = () => {
    tapes.current = [...tapes.current.filter((t) => performance.now() - t < 3000), performance.now()]
    const t = tempoTape(tapes.current)
    if (t) moteur.reglerTempo(t)
    moteur.recaler()
  }
  const [mot, aide] = PHASES[l.phase]
  const dansLaGamme = new Set(l.cle ? (l.cle.mineur ? MINEUR : MAJEUR).map((d) => (d + l.cle!.tonique) % 12) : [])
  const chaud = l.signaux.chaleur
  return (
    <div className="dj-lecture">
      <div className="dj-ligne-etat">
        <span className={`dj-point ${l.phase}`} aria-hidden />
        <div><b>{silence ? 'silence' : mot}</b><small>{silence ? 'rien ne joue sur l’appareil écouté' : aide}</small></div>
      </div>
      {l.phase !== 'normal' && !silence && <div className="dj-barre" aria-label="avancement de la montée"><i style={{ width: `${Math.round(l.montee * 100)}%` }} /></div>}
      <div>
        <div className="dj-cle"><b>{nomDeCle(l.cle)}</b>{l.cle && <span className="dj-pastille">{l.cle.mineur ? 'mineur : sombre' : 'majeur : ouvert'}</span>}<span className="dj-pastille">{l.scoreCle > 0.6 ? 'stable' : 'analyse en cours'}</span></div>
        <div className="dj-barre"><i className="iris" style={{ width: `${Math.round(Math.max(0, l.scoreCle) * 100)}%` }} /></div>
      </div>
      <div>
        <div className="dj-notes" role="img" aria-label="les 12 notes entendues">
          {NOTES_ANGLAIS.map((n, i) => (
            <div key={n} className={dansLaGamme.has(i) ? 'dans' : ''} title={NOTES[i]}><i style={{ height: `${Math.max(3, Math.round(Math.min(1, notes[i] ?? 0) * 100))}%` }} /><span>{n}</span></div>
          ))}
        </div>
        <p className="dj-note">les 12 notes entendues ; soulignées, celles de la gamme trouvée</p>
      </div>
      <div>
        <div className="dj-temp"><i style={{ left: `${Math.round(chaud * 100)}%` }} /></div>
        <div className="dj-temp-lab"><span>froid</span><span>{chaud > 0.62 ? 'son chaud' : chaud < 0.42 ? 'son froid' : 'neutre'}</span><span>chaud</span></div>
      </div>
      {l.enMain && l.cycle && (
        <div className="dj-mesure" aria-label={`mesure à ${l.cycle.mesure} temps${l.temps ? `, temps ${l.temps}` : ''}`}>
          {Array.from({ length: l.cycle.mesure }, (_, i) => <i key={i} className={l.temps === i + 1 ? 'on' : i === 0 && l.temps ? 'un' : ''} />)}
          <span>{l.cycle.mesure} temps{l.temps ? ` · temps ${l.temps}` : ' · premier temps pas encore trouvé'} · confiance {Math.round(l.cycle.confiance * 100)} %</span>
        </div>
      )}
      <div className="dj-tempo">
        <b>{Math.round(l.bpm)}</b><span>pulsations/min · {l.bpmMain ? 'imposé' : l.source === 'cycle' ? 'trouvé par le cycle de la musique' : l.bpmSur ? 'mesuré sur la grosse caisse' : 'en attente de la musique'}</span>
        <button type="button" className="btn sm" onClick={taper} title="Trois tapes en rythme imposent le tempo ; la dernière recale le temps">taper</button>
        <button type="button" className={`btn sm ${l.bpmMain ? '' : 'solid'}`} aria-pressed={!l.bpmMain} onClick={() => moteur.reglerTempo(null)} title="Laisse la détection suivre la grosse caisse">auto</button>
      </div>
    </div>
  )
}
