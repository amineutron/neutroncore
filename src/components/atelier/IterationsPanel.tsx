import { useEffect, useState } from 'react'
import { apiGet, apiPost, withConfirm } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { toast } from '../../lib/dialog'
import { ETAPES, buildDemande, controlsDiff, demandeError, etapeIndex, pieceLabel, verdictTone, type Controle, type Iteration, type Jeu } from '../../lib/atelier'
import type { Launch } from './useBoucles'

type DemandeLog = { id: string; le: string; numero?: number; texte: string; pieces: string[]; refs: number[] }
type Demandes = { iterations: (Iteration & { demandes: DemandeLog[] })[]; en_cours: DemandeLog[]; suivant: number }

const day = (iso: string) => iso.slice(0, 16).replace('T', ' ')

// Itérations : où en est la boucle d'agents, ce qui a été demandé à chaque tour, et de quoi en lancer un nouveau.
export function IterationsPanel({ jeu, selection, seed, describeView, onIteration, onClearSelection, onLaunched }: {
  jeu: Jeu; selection: string[]; seed: { id: number; texte: string } | null       // texte proposé depuis un contrôle en échec
  describeView: () => string; onIteration: (it: string) => void; onClearSelection: () => void; onLaunched: (l: Launch) => void
}) {
  const log = usePoll<Demandes>(() => apiGet(`/modelisation/${jeu.nom}/demandes`), 15000)
  const [texte, setTexte] = useState('')
  const [refs, setRefs] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [compare, setCompare] = useState('')
  const [other, setOther] = useState<Controle[] | null>(null)
  useEffect(() => { if (seed) setTexte(seed.texte) }, [seed?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const etape = etapeIndex(jeu.courant.etape)
  const demande = { modele: jeu.nom, texte, pieces: selection, refs, vue: describeView() }
  const error = demandeError(demande)
  const iterations = log.data?.iterations ?? jeu.iterations.map((it) => ({ ...it, demandes: [] as DemandeLog[] }))

  const send = async () => {
    setBusy(true)
    try {
      const r = await apiPost<{ success: boolean; numero: number; started: number; cwd: string }>(`/modelisation/${jeu.nom}/boucle`,
        { demande: { texte: texte.trim(), pieces: selection, refs, vue: demande.vue } }, await withConfirm('modelisation_boucle'))
      onLaunched({ numero: r.numero, started: r.started, cwd: r.cwd, modele: jeu.nom })
      setTexte(''); setRefs([])
      toast(`itération ${r.numero} lancée : la conversation est dans la languette « boucle », à droite`)
      log.refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'lancement impossible', 'crit')
    } finally {
      setBusy(false)
    }
  }

  const pickCompare = async (numero: string) => {
    setCompare(numero); setOther(null)
    if (!numero) return
    try { setOther((await apiGet<Jeu>(`/modelisation/${jeu.nom}?iteration=${numero}`)).controles) } catch { setCompare('') }
  }
  const diff = other ? controlsDiff(other, jeu.controles) : null

  return (
    <div className="at-iter">
      <ol className="at-pipeline" aria-label="Étapes de la boucle">
        {ETAPES.map((e, i) => <li key={e} className={i === etape ? 'now' : i < etape ? 'done' : ''} aria-current={i === etape ? 'step' : undefined}>{e}</li>)}
      </ol>
      <p className="au-note">{jeu.courant.numero ? `Itération ${jeu.courant.numero} — ${jeu.courant.etape || 'en cours'}` : 'Aucune boucle en cours.'}</p>

      <div className="at-iter-list">
        <button type="button" className={`at-it ${jeu.iteration === 'courant' ? 'on' : ''}`} onClick={() => onIteration('courant')}>
          <b>en direct</b><span>les sorties actuelles du pipeline</span>
        </button>
        {[...iterations].reverse().map((it) => (
          <div key={it.numero} className={`at-it ${jeu.iteration === String(it.numero) ? 'on' : ''}`}>
            <button type="button" className="at-it-main" onClick={() => onIteration(String(it.numero))}>
              <b>itération {it.numero}</b>
              <span className={`at-verdict ${verdictTone(it.verdict)}`}>{it.verdict || 'sans verdict'}</span>
            </button>
            {it.demandes.map((d) => (
              <blockquote key={d.id}>
                <cite>demande du {day(d.le)}{d.pieces?.length ? ` · ${d.pieces.map(pieceLabel).join(', ')}` : ''}{d.refs?.length ? ` · réf. ${d.refs.join(', ')}` : ''}</cite>
                {d.texte}
                <button type="button" className="btn sm" onClick={() => setTexte(d.texte)} title="Reprendre ce texte dans la nouvelle demande">reprendre</button>
              </blockquote>
            ))}
            <label className="at-check"><input type="checkbox" checked={refs.includes(it.numero)}
              onChange={(e) => setRefs(e.target.checked ? [...refs, it.numero] : refs.filter((n) => n !== it.numero))} /> en référence de la prochaine demande</label>
          </div>
        ))}
      </div>

      <details className="at-compare" open={Boolean(compare)}>
        <summary>comparer avec une autre itération (facultatif)</summary>
        <select value={compare} aria-label="Itération à comparer" onChange={(e) => void pickCompare(e.target.value)}>
          <option value="">aucune</option>
          {jeu.iterations.filter((it) => String(it.numero) !== jeu.iteration).map((it) => <option key={it.numero} value={it.numero}>itération {it.numero}</option>)}
          {jeu.iteration !== 'courant' && <option value="courant">en direct</option>}
        </select>
        {diff && (
          <div className="at-diff">
            <p>Depuis {compare === 'courant' ? 'les sorties en direct' : `l’itération ${compare}`}, vers ce qui est affiché :</p>
            {([['réparés', diff.repares, 'ok'], ['cassés', diff.casses, 'ko'], ['nouveaux', diff.nouveaux, ''], ['disparus', diff.disparus, '']] as const).map(([label, noms, tone]) => (
              <details key={label}><summary className={tone}>{noms.length} {label}</summary>{noms.slice(0, 60).map((n) => <code key={n}>{n}</code>)}</details>
            ))}
          </div>
        )}
      </details>

      <div className="at-demande">
        <b>nouvelle demande</b>
        {selection.length > 0
          ? <p className="at-ctx">porte sur : {selection.map(pieceLabel).join(', ')} <button type="button" className="btn sm" onClick={onClearSelection}>retirer</button></p>
          : <p className="au-note">Sélectionne une ou plusieurs pièces dans la vue pour préciser de quoi tu parles (une jonction, une coupe…).</p>}
        {refs.length > 0 && <p className="at-ctx">références : itération{refs.length > 1 ? 's' : ''} {[...refs].sort((a, b) => a - b).join(', ')}</p>}
        <textarea id="at-demande-texte" value={texte} maxLength={1800} rows={4} placeholder="ex. la jonction entre ces deux pièces baille : ajouter une feuillure de 1 mm" aria-label="Demande pour la prochaine itération"
          onChange={(e) => setTexte(e.target.value)} />
        {texte.trim() && <pre className="at-preview">{buildDemande(demande)}</pre>}
        <div className="at-row">
          <button type="button" className="btn solid" disabled={busy || Boolean(error)} title={error} onClick={() => void send()}>
            {busy ? 'lancement…' : `lancer l’itération ${log.data?.suivant ?? ''}`}</button>
        </div>
      </div>
    </div>
  )
}
