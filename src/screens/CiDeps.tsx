import { useState } from 'react'
import { apiGet, apiPost, apiPut } from '../lib/api'
import { usePoll } from '../lib/poll'
import { toast } from '../lib/dialog'
import { useStocke } from '../lib/useStocke'
import { FILTRES_CI, FILTRES_DEPS, type EtatCiDeps } from '../lib/ciDeps'
import { CiBoard } from '../components/cideps/CiBoard'
import { DepsBoard } from '../components/cideps/DepsBoard'
import '../components/cideps/cideps.css'
import { Btn, Card, Chip, Loader, PageTitle } from '../components/ui'

type Volet = 'ci' | 'deps'

function quand(iso: string): string {
  const t = Date.parse(iso)
  if (!t) return ''
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`
}

// CI/PR et dépendances/vulnérabilités. Lecture seule : rien n'est corrigé ni fusionné d'ici.
export function CiDeps() {
  const [onglet, setOnglet] = useStocke('neutroncore_cideps_onglet', { v: 'ci' as Volet })
  const [fCi, majCi] = useStocke('neutroncore_cideps_ci', FILTRES_CI)
  const [fDeps, majDeps] = useStocke('neutroncore_cideps_deps', FILTRES_DEPS)
  const [ouvert, setOuvert] = useState(false)
  const [local, setLocal] = useState<string[] | null>(null)
  // pendant un relevé on relit toutes les 3 s pour voir arriver le résultat
  const [vitesse, setVitesse] = useState(60000)
  const etat = usePoll<EtatCiDeps>(() => apiGet('/ci-deps'), vitesse)
  const enCours = etat.data?.en_cours ?? {}
  const actifs = Object.keys(enCours).length > 0
  if (actifs !== (vitesse === 3000)) setVitesse(actifs ? 3000 : 60000)
  const d = etat.data
  const v = onglet.v
  const releve = d?.[v] ?? null

  async function relancer(volet: Volet) {
    try {
      await apiPost('/ci-deps/relancer', { volet })
      etat.refresh()
    } catch (e) { toast((e as Error).message || 'relevé refusé', 'warn') }
  }
  async function exclure(liste: string[]) {
    setLocal(liste)
    try { await apiPut('/ci-deps/reglages', { exclus: liste }) } catch { toast('réglage refusé', 'crit'); setLocal(null) }
  }
  const exclus = local ?? d?.reglages.exclus ?? []

  return (
    <>
      <PageTitle help="cideps" title="ci & dépendances" desc="Builds, pull requests et dependabot des projets suivis ; vulnérabilités de leurs dépendances. Lecture seule." />
      <div className="cd-tabs" role="tablist">
        {(['ci', 'deps'] as const).map((o) => (
          <button key={o} role="tab" aria-selected={v === o} className={`cd-tab ${v === o ? 'on' : ''}`} onClick={() => setOnglet({ v: o })}>
            {o === 'ci' ? 'ci & pr' : 'dépendances'}
            {o === 'ci' && d?.ci && (d.ci.resume.builds_en_echec + d.ci.resume.prs_controles_en_echec > 0) ? ' ●' : ''}
            {o === 'deps' && d?.deps && d.deps.resume.vulns > 0 ? ` (${d.deps.resume.vulns})` : ''}
          </button>
        ))}
      </div>
      <Card title={v === 'ci' ? 'ci & pr' : 'dépendances et vulnérabilités'} lite={releve ? `relevé ${quand(releve.releve_le)}${releve.duree_s ? ` en ${releve.duree_s} s` : ''}` : 'jamais relevé'}>
        <div className="cd-bar">
          <Btn sm solid onClick={() => void relancer(v)} disabled={v in enCours}>{v in enCours ? 'relevé en cours…' : 'relancer'}</Btn>
          {v in enCours && <span className="m">depuis {enCours[v]} s</span>}
          <Btn sm onClick={() => setOuvert(!ouvert)}>{ouvert ? 'masquer l’aide' : 'aide'}</Btn>
        </div>
        {ouvert && <p className="au-note">{v === 'ci'
          ? "Chaque relevé interroge GitHub (gh, en lecture seule) pour les dépôts de « branches & pr ». Les builds viennent de GitHub Actions ; les alertes dependabot demandent un jeton gh qui y a accès."
          : "npm audit lit le package-lock.json, pip-audit ce qui est installé dans le .venv (sinon requirements.txt épinglé). Un relevé peut durer plusieurs minutes. Rien n'est installé ni corrigé."}</p>}
        {releve?.erreur && <div style={{ marginBottom: 10 }}><Chip tone="crit">{releve.erreur}{releve.tentative_le ? ' (dernier bon relevé affiché)' : ''}</Chip></div>}
        {etat.error && !d && <Chip tone="crit">API injoignable : {etat.error}</Chip>}
        {!d && !etat.error && <Loader label="chargement…" />}
        {d && !releve && <p className="au-note">{v in enCours ? 'Premier relevé en cours…' : 'Aucun relevé pour le moment.'}</p>}
        {d && releve && v === 'ci' && d.ci && 'depots' in d.ci && <CiBoard releve={d.ci} f={fCi} maj={majCi} />}
        {d && releve && v === 'deps' && d.deps && 'projets' in d.deps && <DepsBoard releve={d.deps} f={fDeps} maj={majDeps} exclus={exclus} exclure={(l) => void exclure(l)} />}
      </Card>
    </>
  )
}
