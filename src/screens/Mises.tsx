import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { toast } from '../lib/dialog'
import { usePoll, fmtAgo } from '../lib/poll'
import { SOURCES, ecrireFiltres, filtrer, lireFiltres, phraseResume, type Filtres, type Tableau } from '../lib/mises'
import { MisesLigne } from '../components/mises/MisesLigne'
import { MisesReglages } from '../components/mises/MisesReglages'
import { Btn, Card, Chip, Loader, PageTitle } from '../components/ui'
import '../components/mises/mises.css'
import '../components/audit-ux-lot3.css'

const PAGE = 80

const BASCULES: { cle: keyof Filtres; valeur?: Filtres['portee']; label: string }[] = [
  { cle: 'portee', valeur: 'systeme', label: 'système' },
  { cle: 'securite', label: 'sécurité seulement' },
  { cle: 'retard', label: 'en retard' },
  { cle: 'apropos', label: 'à mettre à jour' },
]

export function Mises() {
  const t = usePoll<Tableau>(() => apiGet('/maj'), 5000)
  const [f, setF] = useState<Filtres>(lireFiltres)
  const [max, setMax] = useState(PAGE)
  useEffect(() => ecrireFiltres(f), [f])
  const d = t.data

  const basculer = (cle: keyof Filtres, valeur?: Filtres['portee']) => {
    setMax(PAGE)
    setF((x) => (cle === 'portee' ? { ...x, portee: x.portee === valeur ? 'tout' : (valeur ?? 'tout') } : { ...x, [cle]: !x[cle] }))
  }
  const actif = (cle: keyof Filtres, valeur?: Filtres['portee']) => (cle === 'portee' ? f.portee === valeur : Boolean(f[cle]))

  async function relever() {
    try {
      const r = await apiPost<{ statut: string }>('/maj/releve')
      toast(r.statut === 'deja_en_cours' ? 'un relevé est déjà en cours' : 'relevé lancé : une à deux minutes')
      t.refresh()
    } catch (e) { toast((e as Error).message, 'crit') }
  }

  const vus = d ? filtrer(d.items, f) : []
  return (
    <>
      <PageTitle help="mises" title="mises à jour" desc="Ce qui est à jour et ce qui est en retard sur cet ordinateur, avec l'origine et la sécurité de chaque mise à jour. Rien ne s'installe tout seul." />
      {t.error && !d && <Chip tone="crit">API injoignable : {t.error}</Chip>}
      {!d && !t.error && <Loader label="lecture du dernier relevé…" />}
      {d && !d.releve_le && (
        <Card title="mises à jour" lite="aucun relevé pour l'instant">
          <div className="first-use">
            <p>Pas encore de relevé : un premier passage liste ce qui est à mettre à jour (système, flatpak, docker, npm, pip). Rien ne s'installe tout seul.</p>
            <Btn solid onClick={() => void relever()} disabled={d.en_cours}>{d.en_cours ? 'relevé en cours…' : 'relever maintenant'}</Btn>
            <MisesReglages onSaved={t.refresh} />
          </div>
        </Card>
      )}
      {d && d.releve_le && (
        <>
          <Card title="en bref" lite={phraseResume(d)} style={{ marginBottom: 14 }}>
            <div className="mi-top">
              <Btn solid onClick={() => void relever()} disabled={d.en_cours}>{d.en_cours ? 'relevé en cours…' : 'relever maintenant'}</Btn>
              <MisesReglages onSaved={t.refresh} />
              <span className="mi-meta">{d.releve_le ? `dernier relevé ${fmtAgo(d.releve_le)}` : 'jamais relevé'} · seuil de retard {d.reglages.seuil_jours} j</span>
            </div>
            <div className="mi-sources">
              {SOURCES.map((s) => {
                const r = d.resume.par_source[s.id]
                const mal = r.statut === 'erreur'
                return (
                  <div key={s.id} className={`mi-src ${mal ? 'err' : ''}`} title={r.detail}>
                    <b>{s.label}</b>
                    {r.statut === 'ok' ? `${r.a_mettre_a_jour} à mettre à jour${r.en_retard ? `, ${r.en_retard} en retard` : ''}${r.total > r.a_mettre_a_jour ? `, ${r.a_jour} à jour` : ''}`
                      : r.statut === 'non_releve' ? 'pas encore relevé' : r.statut === 'desactive' ? 'désactivé' : r.statut === 'absent' ? 'absent de cette machine' : 'relevé impossible'}
                  </div>
                )
              })}
            </div>
          </Card>
          <Card title="détail" lite={`${vus.length} élément${vus.length > 1 ? 's' : ''}`}>
            <div className="mi-filtres" role="group" aria-label="filtres">
              {BASCULES.map((b) => (
                <button key={b.label} className={`mi-fchip ${actif(b.cle, b.valeur) ? 'on' : ''}`} aria-pressed={actif(b.cle, b.valeur)} onClick={() => basculer(b.cle, b.valeur)}>{b.label}</button>
              ))}
              <span className="mi-meta">« système » = paquets, noyau, firmware ; sans lui, tout l'ordinateur (flatpak, docker, npm, pip).</span>
            </div>
            {vus.length === 0 && <p className="mi-meta">{d.releve_le ? 'rien ne correspond à ces filtres' : 'lance un relevé pour remplir le tableau'}</p>}
            {vus.slice(0, max).map((it) => <MisesLigne key={it.id} it={it} onApplied={t.refresh} />)}
            {vus.length > max && <div className="mi-actions"><Btn sm onClick={() => setMax(max + PAGE)}>afficher {Math.min(PAGE, vus.length - max)} de plus</Btn></div>}
          </Card>
        </>
      )}
    </>
  )
}
