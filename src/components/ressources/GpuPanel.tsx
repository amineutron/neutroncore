import { useState } from 'react'
import { apiGet, apiPost, withConfirm } from '../../lib/api'
import { usePoll } from '../../lib/poll'
import { confirmDialog, toast } from '../../lib/dialog'
import { fmtOctets, fmtValeur, nonAttribue, seuilDe, ton, type GpuDetail, type Seuils } from '../../lib/ressources'
import { Bar, Card, Loader } from '../ui'
import './ressources.css'

const COULEURS: Record<string, string> = {
  ollama: 'var(--gold)', camera: 'var(--rose)', lyra: 'var(--ok)', navigateur: '#6ea8fe', bureau: '#9d7bf5', autre: 'var(--muted)', libre: 'var(--off)',
}

function Tuile({ label, valeur, pct, tone, detail }: { label: string; valeur: string; pct?: number; tone?: 'ok' | 'warn' | 'crit'; detail?: string }) {
  return (
    <div className={`rs-tuile ${tone && tone !== 'ok' ? tone : ''}`}>
      <small>{label}</small><b>{valeur}</b>
      {pct != null && <Bar pct={pct} tone={tone} />}
      {detail && <em>{detail}</em>}
    </div>
  )
}

/** Carte graphique en détail : mesures, qui occupe la VRAM, modèles Ollama (déchargeables en un clic). */
export function GpuPanel({ seuils }: { seuils?: Seuils }) {
  const d = usePoll<GpuDetail>(() => apiGet('/ressources/gpu'), 3000)
  const [attente, setAttente] = useState('')
  const g = d.data?.gpu
  if (!d.data) return <Card title="carte graphique">{d.error ? <p className="rs-erreur">API injoignable : {d.error}</p> : <Loader label="lecture de la carte…" />}</Card>
  if (!g) return <Card title="carte graphique"><div className="rs-vide">nvidia-smi ne répond pas : carte absente ou pilote arrêté</div></Card>

  const libre = nonAttribue(g, d.data.processus, d.data.occupation)
  const parts = [...d.data.occupation.map((o) => ({ id: o.proprietaire, libelle: o.libelle, vram: o.vram })),
    ...(libre > 0 ? [{ id: 'libre', libelle: 'non attribué', vram: libre }] : [])]
  const total = g.vram_total || 1

  async function decharger(nom: string) {
    if (!(await confirmDialog({ title: `décharger ${nom} ?`, body: 'Le modèle quitte la mémoire de la carte. Il sera rechargé (quelques secondes) à sa prochaine utilisation.', ok: 'décharger', danger: true }))) return
    setAttente(nom)
    try {
      await apiPost('/ressources/ollama/decharger', { modele: nom }, await withConfirm('ollama_decharger'))
      toast(`${nom} déchargé`)
      d.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'échec du déchargement', 'crit') }
    finally { setAttente('') }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title={g.nom} lite={`état ${g.pstate}`}>
        <div className="rs-gpu-tuiles">
          <Tuile label="charge" valeur={fmtValeur(g.utilisation, '%')} pct={g.utilisation ?? 0} tone={ton(g.utilisation, seuilDe(seuils, 'gpu'))} detail={g.utilisation_memoire != null ? `bus mémoire ${g.utilisation_memoire} %` : undefined} />
          <Tuile label="mémoire (vram)" valeur={`${fmtOctets(g.vram_utilisee)}`} pct={g.vram_pct} tone={ton(g.vram_pct, seuilDe(seuils, 'vram'))} detail={`sur ${fmtOctets(g.vram_total)} (${g.vram_pct} %)`} />
          <Tuile label="température" valeur={fmtValeur(g.temperature, '°C')} pct={g.temperature ?? 0} tone={ton(g.temperature, seuilDe(seuils, 'tgpu'))} />
          <Tuile label="puissance" valeur={fmtValeur(g.puissance, 'W')} pct={g.puissance != null && g.puissance_max ? (g.puissance / g.puissance_max) * 100 : 0} detail={g.puissance_max ? `limite ${g.puissance_max} W` : undefined} />
          <Tuile label="horloge coeur" valeur={fmtValeur(g.horloge_sm, 'MHz')} pct={g.horloge_sm != null && g.horloge_sm_max ? (g.horloge_sm / g.horloge_sm_max) * 100 : 0} detail={g.horloge_sm_max ? `max ${g.horloge_sm_max} MHz` : undefined} />
          <Tuile label="horloge mémoire" valeur={fmtValeur(g.horloge_mem, 'MHz')} pct={g.horloge_mem != null && g.horloge_mem_max ? (g.horloge_mem / g.horloge_mem_max) * 100 : 0} detail={g.horloge_mem_max ? `max ${g.horloge_mem_max} MHz` : undefined} />
          {g.ventilateur != null && <Tuile label="ventilateur" valeur={fmtValeur(g.ventilateur, '%')} pct={g.ventilateur} />}
        </div>
      </Card>

      <Card title="qui occupe la mémoire" lite={`${fmtOctets(g.vram_utilisee)} / ${fmtOctets(g.vram_total)}`}>
        <div className="rs-pile" role="img" aria-label="Répartition de la mémoire de la carte">
          {parts.map((p) => <i key={p.id} title={`${p.libelle} : ${fmtOctets(p.vram)}`} style={{ width: `${(p.vram / total) * 100}%`, ['--c' as string]: COULEURS[p.id] ?? COULEURS.autre }} />)}
        </div>
        <div className="rs-qui">
          {parts.map((p) => <span key={p.id} style={{ ['--c' as string]: COULEURS[p.id] ?? COULEURS.autre }}>{p.libelle} {fmtOctets(p.vram)}</span>)}
          {!parts.length && <span style={{ ['--c' as string]: COULEURS.libre }}>rien d'attribué</span>}
        </div>
        {d.data.processus.length > 0 && (
          <table className="rs-table" style={{ marginTop: 12 }}>
            <thead><tr><th>processus</th><th>pid</th><th>à qui</th><th className="n" style={{ textAlign: 'right' }}>mémoire</th></tr></thead>
            <tbody>{d.data.processus.map((p) => (
              <tr key={p.pid}><td>{p.nom}</td><td>{p.pid}</td><td>{p.proprietaire}</td><td className="n">{fmtOctets(p.vram)}</td></tr>
            ))}</tbody>
          </table>
        )}
        {libre > 0 && <p className="rs-qui" style={{ marginTop: 8 }}>« non attribué » : de la mémoire que nvidia-smi ne rattache à aucun processus listé (affichage graphique, pilote).</p>}
      </Card>

      <Card title="modèles ollama chargés" lite={d.data.ollama.erreur || `${d.data.ollama.modeles.length} en mémoire`}>
        {d.data.ollama.erreur ? <div className="rs-vide">{d.data.ollama.erreur}</div>
          : d.data.ollama.modeles.length === 0 ? <div className="rs-vide">aucun modèle en mémoire : la carte est libre pour le reste</div>
          : d.data.ollama.modeles.map((m) => (
            <div className="rs-modele" key={m.nom}>
              <div>
                <b>{m.nom}</b>
                <small>{[m.parametres, m.quantification, `${fmtOctets(m.taille)} au total`, `${m.sur_gpu_pct} % sur la carte (${fmtOctets(m.vram)})`].filter(Boolean).join(' · ')}</small>
                {m.expire && <small>libéré seul vers {new Date(m.expire).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small>}
              </div>
              <button type="button" className="btn sm danger" disabled={attente === m.nom} onClick={() => void decharger(m.nom)}>{attente === m.nom ? 'déchargement…' : 'décharger'}</button>
            </div>
          ))}
      </Card>
    </div>
  )
}
