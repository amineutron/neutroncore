import { useState } from 'react'
import { apiGet, apiPost, apiPut, ApiError, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { fmtBytes, usePoll } from '../../lib/poll'
import { FILTRES_DEFAUT, MOTIFS, ecrireFiltres, filtrer, lireFiltres, phraseEspace, type Filtres, type Menage, type Motif, type Proposition } from '../../lib/mediaMenage'
import { Btn, Card, Chip, Loader } from '../ui'
import { NumField } from '../NumField'
import './menage.css'

// Seconde confirmation (titre rappelé, espace RÉEL dit) puis suppression par Radarr/Sonarr : jamais d'effacement direct.
async function supprimer(p: Proposition): Promise<boolean> {
  const quoi = p.kind === 'movie' ? 'film' : 'série'
  const espace = phraseEspace(p, fmtBytes)
  if (!await confirmDialog({ title: `supprimer ${quoi} ?`, body: `« ${p.title} » sera retiré de ${p.kind === 'movie' ? 'Radarr' : 'Sonarr'} avec ses fichiers. ${espace}.`, ok: 'continuer', danger: true })) return false
  if (!await confirmDialog({ title: 'dernière confirmation', body: `Supprimer définitivement « ${p.title} » ? Cette action ne peut pas être annulée.`, ok: 'supprimer définitivement', danger: true })) return false
  await apiPost('/media/menage/supprimer', { kind: p.kind, id: p.id, titre: p.title }, await withConfirm('arr_delete'))
  return true
}

export function Nettoyage() {
  const menage = usePoll<Menage>(() => apiGet('/media/menage'), 300000)
  const [f, setF] = useState<Filtres>(lireFiltres)
  const [busy, setBusy] = useState<string | null>(null)
  const [reglages, setReglages] = useState(false)
  const [filtres, setFiltres] = useState(false)   // replié par défaut sous 560 px (CSS)
  const d = menage.data
  const maj = (n: Partial<Filtres>) => { const nf = { ...f, ...n }; setF(nf); ecrireFiltres(nf) }
  const bascule = (m: Motif['code']) => maj({ motifs: f.motifs.includes(m) ? f.motifs.filter((x) => x !== m) : [...f.motifs, m] })

  async function agir(p: Proposition, action: () => Promise<unknown>, ok: string) {
    setBusy(p.cle)
    try { if (await action() !== false) { toast(ok); menage.refresh() } }
    catch (e) { toast(e instanceof ApiError ? e.message : 'échec', 'crit') }
    finally { setBusy(null) }
  }
  async function reglerJours(jours: number) {
    await apiPut('/media/menage/reglages', { jours })
    menage.refresh()
  }

  if (!d) return menage.error ? <Card><p style={{ color: 'var(--crit)' }}>{menage.error}</p></Card> : <Loader label="analyse de la bibliothèque…" />
  const liste = filtrer(d.propositions, f)
  const libre = liste.reduce((a, p) => a + p.libere, 0)

  return (
    <>
      <Card title="espace récupérable" lite="réel : hardlinks et torrents semés pris en compte">
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ fontSize: 26 }}>{fmtBytes(d.total.libere)}</span>
          <span className="lite">sur {fmtBytes(d.total.apparent)} de fichiers proposés</span>
          {d.total.seme > 0 && <Chip tone="warn">{fmtBytes(d.total.seme)} encore semés</Chip>}
        </div>
        <div className="lite" style={{ marginTop: 6 }}>
          {d.analyses} éléments analysés · {d.plex.disponible ? `historique plex : ${d.plex.entrees} lectures` : `pas d'historique plex (${d.plex.erreur}) : âge seulement, confiance basse`}
        </div>
        <p className="lite" style={{ marginTop: 6 }}>rien n'est supprimé sans ton accord : deux confirmations, et la suppression passe par radarr / sonarr.</p>
      </Card>

      <button type="button" className="btn sm mm-toggle" aria-expanded={filtres} onClick={() => setFiltres(!filtres)}>
        {filtres ? 'masquer les filtres' : `filtres${f.motifs.length || f.q || f.kind !== 'tous' || f.seulementLibere ? ' (actifs)' : ''}`}
      </button>
      <div className={`mm-bar ${filtres ? '' : 'ferme'}`}>
        {(Object.keys(MOTIFS) as Motif['code'][]).map((m) => (
          <button key={m} className={`btn sm ${f.motifs.includes(m) ? 'solid' : ''}`} aria-pressed={f.motifs.includes(m)} onClick={() => bascule(m)}>{MOTIFS[m]}</button>
        ))}
        <select value={f.kind} aria-label="type" onChange={(e) => maj({ kind: e.target.value as Filtres['kind'] })}>
          <option value="tous">films et séries</option><option value="movie">films</option><option value="series">séries</option>
        </select>
        <label className="lite"><input type="checkbox" checked={f.seulementLibere} onChange={(e) => maj({ seulementLibere: e.target.checked })} /> libère de la place</label>
        <input value={f.q} placeholder="chercher un titre" aria-label="chercher" onChange={(e) => maj({ q: e.target.value })} />
        <Btn sm onClick={() => maj(FILTRES_DEFAUT)}>réinitialiser</Btn>
        <Btn sm onClick={() => setReglages(!reglages)}>{reglages ? 'masquer les réglages' : 'réglages'}</Btn>
      </div>

      {reglages && (
        <Card title="réglages">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>proposer ce qui est ajouté depuis plus de</span>
            <NumField value={d.reglages.jours} min={30} max={3650} onCommit={reglerJours} label="jours" />
            <span>jours</span>
          </div>
          <div className="lite" style={{ marginTop: 6 }}>{d.reglages.garder.length} élément(s) marqués « à garder » ne sont jamais proposés.</div>
        </Card>
      )}

      <div className="lite">{liste.length} proposition(s) · {fmtBytes(libre)} libérables</div>
      {liste.length === 0 && <Card><p className="lite">rien à proposer avec ces filtres.</p></Card>}
      {liste.map((p) => (
        <Card key={p.cle}>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
              <strong>{p.title}</strong> <span className="lite">{p.year ?? ''} · {p.kind === 'movie' ? `film ${p.quality}` : 'série'}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
                {p.motifs.map((m) => <Chip key={m.code} tone={m.code === 'qualite' || m.code === 'doublon' ? 'warn' : 'gold'}>{MOTIFS[m.code]}</Chip>)}
                {p.confiance === 'basse' && <Chip>confiance basse</Chip>}
              </div>
              <div className="lite">{p.motifs.map((m) => m.detail).join(' · ')}</div>
              <div className="lite" style={{ color: p.libere ? 'var(--ok)' : 'var(--warn)' }}>{phraseEspace(p, fmtBytes)}</div>
            </div>
            <div className="mm-actions">
              <Btn sm disabled={busy === p.cle} onClick={() => agir(p, () => apiPost('/media/menage/garder', { kind: p.kind, id: p.id }), 'gardé, plus proposé')}>garder</Btn>
              <button type="button" className="btn sm danger nc-danger" disabled={busy === p.cle} onClick={() => agir(p, () => supprimer(p), 'supprimé')}>supprimer</button>
            </div>
          </div>
        </Card>
      ))}
    </>
  )
}
