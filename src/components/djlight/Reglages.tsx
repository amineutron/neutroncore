import { NumField } from '../NumField'
import { BORNES, REGLAGES_DEFAUT, avanceMs, vitesseOnde, type ReglagesDj } from '../../lib/djReglages'

type Props = { reglages: ReglagesDj; bpm: number; onChange: (r: ReglagesDj) => void }

const MESURES = [{ v: 'auto', label: 'trouvée seule' }, { v: 3, label: '3 temps' }, { v: 4, label: '4 temps' }] as const

/** Les réglages d'analyse et de latence : chaque bloc a son interrupteur, éteint il se comporte comme avant. */
export function ReglagesAnalyse({ reglages: r, bpm, onChange }: Props) {
  const cycle = (p: Partial<ReglagesDj['cycle']>) => onChange({ ...r, cycle: { ...r.cycle, ...p } })
  const onde = (p: Partial<ReglagesDj['onde']>) => onChange({ ...r, onde: { ...r.onde, ...p } })
  const avance = (p: Partial<ReglagesDj['avance']>) => onChange({ ...r, avance: { ...r.avance, ...p } })
  // combien de temps met l'onde à atteindre la lampe la plus lointaine, au tempo du moment
  const traverseeMs = Math.round(60000 / Math.max(40, bpm) / vitesseOnde(r))
  return (
    <div className="dj-reglages">
      <section className="dj-reglage-bloc">
        <label className="dj-inverse"><input type="checkbox" checked={r.cycle.actif} onChange={(e) => cycle({ actif: e.target.checked })} /><b>tempo par le cycle de la musique</b></label>
        <p className="dj-note">Une mesure se répète : on cherche le tempo qui se retrouve après un temps, une mesure, deux, quatre. Marche même quand la grosse caisse est irrégulière, évite de prendre le double ou la moitié du tempo, et trouve le premier temps de la mesure. Éteint : le tempo vient des seules grosses caisses.</p>
        <fieldset disabled={!r.cycle.actif} className="dj-reglage-champs">
          <div className="dj-modes" role="radiogroup" aria-label="Nombre de temps par mesure">
            {MESURES.map((m) => <button key={String(m.v)} type="button" role="radio" aria-checked={r.cycle.mesure === m.v} className={`dj-mode ${r.cycle.mesure === m.v ? 'on' : ''}`} onClick={() => cycle({ mesure: m.v })}>{m.label}</button>)}
          </div>
          <label className="dj-curseur">musique regardée <em>{r.cycle.fenetreS} s</em>
            <input type="range" min={BORNES.fenetreS[0]} max={BORNES.fenetreS[1]} value={r.cycle.fenetreS} aria-label="Durée analysée" onChange={(e) => cycle({ fenetreS: Number(e.target.value) })} />
          </label>
          <p className="dj-note">Plus long : plus sûr, mais plus lent à suivre un changement de morceau.</p>
          <label className="dj-curseur">confiance pour mener le tempo <em>{Math.round(r.cycle.seuil * 100)} %</em>
            <input type="range" min={BORNES.seuil[0] * 100} max={BORNES.seuil[1] * 100} value={Math.round(r.cycle.seuil * 100)} aria-label="Confiance minimale" onChange={(e) => cycle({ seuil: Number(e.target.value) / 100 })} />
          </label>
          <div className="dj-plage">
            <label>tempo mini <NumField value={r.cycle.bpmMin} min={BORNES.bpm[0]} max={BORNES.bpm[1]} label="Tempo minimal" onCommit={(v) => cycle({ bpmMin: v })} /><em>/min</em></label>
            <label>tempo maxi <NumField value={r.cycle.bpmMax} min={BORNES.bpm[0]} max={BORNES.bpm[1]} label="Tempo maximal" onCommit={(v) => cycle({ bpmMax: v })} /><em>/min</em></label>
            <label>préféré <NumField value={r.cycle.centreBpm} min={BORNES.bpm[0]} max={BORNES.bpm[1]} label="Tempo préféré" onCommit={(v) => cycle({ centreBpm: v })} /><em>/min</em></label>
          </div>
          <p className="dj-note">« Préféré » départage un tempo de son double quand rien d'autre ne les distingue.</p>
        </fieldset>
      </section>

      <section className="dj-reglage-bloc">
        <label className="dj-inverse"><input type="checkbox" checked={r.onde.actif} onChange={(e) => onde({ actif: e.target.checked })} /><b>onde plus rapide</b></label>
        <p className="dj-note">L'onde met une pulsation entière à traverser la pièce : une lampe lointaine s'allume avec près d'une demi-seconde de retard. Ici elle la traverse plus vite. Éteint : l'onde d'origine. Une rangée de couches peut aussi la régler (« vitesse de l'onde »).</p>
        <fieldset disabled={!r.onde.actif} className="dj-reglage-champs">
          <label className="dj-curseur">vitesse <em>x{r.onde.vitesse}</em>
            <input type="range" min={BORNES.onde[0]} max={BORNES.onde[1]} step={0.5} value={r.onde.vitesse} aria-label="Vitesse de l'onde" onChange={(e) => onde({ vitesse: Number(e.target.value) })} />
          </label>
        </fieldset>
        <p className="dj-note">Au tempo actuel ({Math.round(bpm)}/min), la lampe la plus lointaine s'allume {traverseeMs} ms après le temps{traverseeMs > 100 ? ' : perceptible' : ''}.</p>
      </section>

      <section className="dj-reglage-bloc">
        <label className="dj-inverse"><input type="checkbox" checked={r.avance.actif} onChange={(e) => avance({ actif: e.target.checked })} /><b>avance sur le son</b></label>
        <p className="dj-note">Capture, analyse, réseau et affichage coûtent ensemble une centaine de millisecondes ; la sortie audio de ta télé ou de ton ampli en ajoute au son. Cette avance fait partir la lumière un peu avant le temps. À régler à l'oreille : trop haut, la lumière précède le son.</p>
        <fieldset disabled={!r.avance.actif} className="dj-reglage-champs">
          <label className="dj-curseur">avance <em>{r.avance.ms} ms</em>
            <input type="range" min={BORNES.avance[0]} max={BORNES.avance[1]} step={5} value={r.avance.ms} aria-label="Avance en millisecondes" onChange={(e) => avance({ ms: Number(e.target.value) })} />
          </label>
        </fieldset>
      </section>

      <div className="dj-actions">
        <span className="chip" title="Ce qui s'applique en ce moment">onde x{vitesseOnde(r)} · avance {avanceMs(r)} ms · cycle {r.cycle.actif ? 'oui' : 'non'}</span>
        <button type="button" className="btn sm" onClick={() => onChange(REGLAGES_DEFAUT)}>valeurs de départ</button>
      </div>
    </div>
  )
}
