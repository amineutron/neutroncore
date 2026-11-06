import { useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { usePoll } from '../../lib/poll'
import {
  ageTexte, basculer, ecrirePref, FILTRE_DETTE_DEFAUT, filtrerDette, grouperParFichier, lirePref, toneNiveau, type ElementDette,
  type FiltreDette, type ReleveDette,
} from '../../lib/qualite'
import { Btn, Card, Chip, Loader } from '../ui'

const PREF = 'neutroncore_qualite_dette'
type Prefs = FiltreDette & { groupe: boolean }
const NIVEAUX = ['haute', 'moyenne', 'basse']
const MARQUEURS = ['FIXME', 'HACK', 'XXX', 'TODO', 'DETTE']

function Filtres({ p, maj, depots }: { p: Prefs; maj: (x: Partial<Prefs>) => void; depots: string[] }) {
  const puce = (actif: boolean, texte: string, onClick: () => void) => (
    <span key={texte} className={`chip ${actif ? 'gold' : ''}`} style={{ cursor: 'pointer' }} onClick={onClick} role="button" aria-pressed={actif}>{texte}</span>
  )
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
      {NIVEAUX.map((n) => puce(p.niveaux.includes(n), n, () => maj({ niveaux: basculer(p.niveaux, n) })))}
      <span style={{ width: 8 }} />
      {MARQUEURS.map((m) => puce(p.marqueurs.includes(m), m === 'DETTE' ? 'CLAUDE.md' : m, () => maj({ marqueurs: basculer(p.marqueurs, m) })))}
      <select value={p.depot} onChange={(e) => maj({ depot: e.target.value })} aria-label="dépôt">
        <option value="">tous les dépôts</option>
        {depots.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <input type="search" placeholder="chercher…" value={p.recherche} onChange={(e) => maj({ recherche: e.target.value })} aria-label="chercher" style={{ minWidth: 0, width: 140 }} />
      {puce(p.groupe, 'par fichier', () => maj({ groupe: !p.groupe }))}
      {puce(p.ignores, 'mis de côté', () => maj({ ignores: !p.ignores }))}
      <span className="chip" style={{ cursor: 'pointer' }} onClick={() => maj({ ...FILTRE_DETTE_DEFAUT })}>réinitialiser</span>
    </div>
  )
}

function Ligne({ e, onIgnorer }: { e: ElementDette; onIgnorer: (e: ElementDette) => void }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="logline" style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setOuvert(!ouvert)}>
        <Chip tone={toneNiveau(e.niveau) || undefined}>{e.score}</Chip>
        <b style={{ minWidth: 56 }}>{e.marqueur === 'DETTE' ? 'dette' : e.marqueur}</b>
        <span style={{ flex: 1, minWidth: 140, color: 'var(--text)' }}>{e.texte || '(sans texte)'}</span>
        <span>{ageTexte(e.age_jours)}</span>
      </div>
      <div style={{ color: 'var(--faint)' }}>{e.depot} · {e.fichier}:{e.ligne}</div>
      {ouvert && (
        <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {e.raisons.map((r) => <span key={r} className="chip">{r}</span>)}
          <Btn sm onClick={() => onIgnorer(e)}>{e.ignore ? 'remettre dans la liste' : 'mettre de côté (dette acceptée)'}</Btn>
        </div>
      )}
    </div>
  )
}

export function Dette() {
  const rel = usePoll<ReleveDette>(() => apiGet('/dette'), 300000)
  const [p, setP] = useState<Prefs>(() => lirePref<Prefs>(PREF, { ...FILTRE_DETTE_DEFAUT, groupe: false }))
  const maj = (x: Partial<Prefs>) => setP((c) => { const n = { ...c, ...x }; ecrirePref(PREF, n); return n })

  async function ignorer(e: ElementDette) {
    try { await apiPost('/dette/ignorer', { ident: e.id, ignorer: !e.ignore }); toast(e.ignore ? 'remise dans la liste' : 'mise de côté'); rel.refresh() }
    catch { toast('action refusée', 'crit') }
  }
  async function relire() {
    try { await apiGet('/dette?frais=1'); rel.refresh() } catch { toast('relevé impossible', 'crit') }
  }

  if (rel.error && !rel.data) return <Card><Chip tone="crit">API injoignable : {rel.error}</Chip></Card>
  if (!rel.data) return <Loader label="relevé des dépôts (git blame)…" />
  const d = rel.data
  const liste = filtrerDette(d.elements, p)
  const r = d.resume
  return (
    <>
      <Card title="dette technique" lite={`${r.total} élément${r.total > 1 ? 's' : ''} · le plus ancien : ${ageTexte(r.plus_ancien_jours)}`} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
          <Chip tone="crit">{r.par_niveau.haute ?? 0} haute{(r.par_niveau.haute ?? 0) > 1 ? 's' : ''}</Chip>
          <Chip tone="warn">{r.par_niveau.moyenne ?? 0} moyenne{(r.par_niveau.moyenne ?? 0) > 1 ? 's' : ''}</Chip>
          <Chip>{r.par_niveau.basse ?? 0} basse{(r.par_niveau.basse ?? 0) > 1 ? 's' : ''}</Chip>
          {r.illisibles > 0 && <Chip tone="crit">{r.illisibles} dépôt{r.illisibles > 1 ? 's' : ''} illisible{r.illisibles > 1 ? 's' : ''}</Chip>}
          <span style={{ flex: 1 }} />
          <Btn sm onClick={() => void relire()}>actualiser</Btn>
        </div>
        <p className="au-note">Priorité = type de repère (FIXME et HACK pèsent plus qu'un TODO) + ancienneté (git blame) + fichier (plusieurs repères, ou chemin sensible comme auth ou secret). Clique une ligne pour voir le détail du calcul. Les dépôts lus sont ceux de « branches & pr ».</p>
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <Filtres p={p} maj={maj} depots={d.depots.map((x) => x.depot)} />
        {liste.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12 }}>{d.elements.length === 0 ? 'Aucun repère trouvé : rien à signaler.' : 'Aucun élément ne correspond à ces filtres.'}</p>}
        {p.groupe
          ? grouperParFichier(liste).map((g) => (
            <details key={g.cle} open style={{ marginBottom: 6 }}>
              <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11.5 }}><b>{g.fichier}</b> <span style={{ color: 'var(--faint)' }}>{g.depot} · {g.elements.length} repère{g.elements.length > 1 ? 's' : ''} · {g.score} pts</span></summary>
              {g.elements.map((e) => <Ligne key={e.id + e.ligne} e={e} onIgnorer={(x) => void ignorer(x)} />)}
            </details>))
          : liste.map((e) => <Ligne key={e.id + e.ligne} e={e} onIgnorer={(x) => void ignorer(x)} />)}
      </Card>
    </>
  )
}
