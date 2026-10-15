import { pieceLabel } from '../../lib/atelier'
import { compterFamilles, type MontageStep } from '../../lib/atelierMontage'

export const VITESSES = [0.5, 1, 2]

// Montage pas à pas : un geste par carte, avec son image. Le geste choisi se rejoue en boucle
// dans la vue 3D (les pièces arrivent à leur place) : on le met en pause, on le ralentit, on l'accélère.
export function Montage({ steps, cles, index, thumbs, paused, speed, fantome, enchainer, onIndex, onPaused, onSpeed, onFantome, onEnchainer, onQuit }: {
  steps: MontageStep[]; cles: string[]; index: number; thumbs: string[]; paused: boolean; speed: number; fantome: boolean; enchainer: boolean
  onIndex: (i: number) => void; onPaused: (p: boolean) => void; onSpeed: (v: number) => void; onFantome: (f: boolean) => void; onEnchainer: (e: boolean) => void; onQuit: () => void
}) {
  if (steps.length === 0) return <p className="at-faint">Cette itération n'a pas d'ordre de montage.</p>
  const step = index >= 0 ? steps[index] : null
  return (
    <div className="at-montage">
      <div className="at-row">
        <button type="button" className="btn sm" disabled={index <= 0} onClick={() => onIndex(index - 1)} aria-label="Geste précédent">←</button>
        <span className="at-step-n">{index < 0 ? `${steps.length} gestes` : `geste ${index + 1} / ${steps.length}`}</span>
        <button type="button" className="btn sm solid" disabled={index >= steps.length - 1} onClick={() => onIndex(index + 1)}>{index < 0 ? 'commencer' : 'suivant →'}</button>
        {index >= 0 && <button type="button" className="btn sm" onClick={onQuit}>quitter</button>}
      </div>
      {step && (
        <div className="at-geste" aria-live="polite">
          <b>{step.titre}</b>
          {step.astuce && <p>{step.astuce}</p>}
          {step.nouvelles.length > 0 && <p className="at-geste-pieces">{compterFamilles(step.nouvelles, cles).join(' · ')}</p>}
          {step.deduites.length > 0 && <p className="au-note">Placé ici par proximité, le texte ne le nomme pas : {step.deduites.map(pieceLabel).join(', ')}.</p>}
          {step.reprises.length > 0 && <p className="at-geste-pieces">sur : {compterFamilles(step.reprises, cles).join(' · ')}</p>}
          {step.nouvelles.length === 0 && step.reprises.length === 0 && <p className="au-note">Ce geste ne pose aucune pièce du modèle.</p>}
          <div className="at-row at-lecture" role="group" aria-label="Lecture de l'animation">
            <button type="button" className={`btn sm ${paused ? 'solid' : ''}`} aria-pressed={paused} onClick={() => onPaused(!paused)}>{paused ? 'reprendre' : 'pause'}</button>
            {VITESSES.map((v) => <button key={v} type="button" className={`btn sm ${speed === v ? 'solid' : ''}`} aria-pressed={speed === v} onClick={() => onSpeed(v)}>{String(v).replace('.', ',')} ×</button>)}
          </div>
          <label className="at-check"><input type="checkbox" checked={enchainer} onChange={(e) => onEnchainer(e.target.checked)} /> enchaîner les gestes tout seul</label>
          <label className="at-check"><input type="checkbox" checked={fantome} onChange={(e) => onFantome(e.target.checked)} /> voir à travers ce qui est déjà posé</label>
        </div>
      )}
      <ol className="at-gestes">
        {steps.map((s, i) => (
          <li key={i} className={i === index ? 'now' : i < index ? 'done' : ''}>
            <button type="button" onClick={() => onIndex(i)} aria-current={i === index ? 'step' : undefined}>
              {thumbs[i] ? <img src={thumbs[i]} alt="" loading="lazy" /> : <span className="at-geste-vide" aria-hidden />}
              <span><em>{i + 1}</em>{s.titre}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
