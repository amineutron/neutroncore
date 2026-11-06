import { FILTRES_CI, fmtDuree, phraseResumeCi, prAttention, filtrerPrs, depotSain, trierDepotsCi, TON_GRAVITE, type DepotCi, type FiltresCi, type Pr, type ReleveCi, type Workflow } from '../../lib/ciDeps'
import { Chip } from '../ui'

type Maj = (suite: Partial<FiltresCi>) => void

const ETAT_RUN = { ok: 'ok', echec: 'échec', en_cours: 'en cours', annule: 'annulé', neutre: 'neutre' } as const
const TON_RUN = { ok: 'ok', echec: 'crit', en_cours: 'warn', annule: undefined, neutre: undefined } as const
const CTRL = { ok: 'contrôles ok', echec: 'contrôles en échec', attente: 'contrôles en cours', aucun: 'sans contrôle' } as const
const TON_CTRL = { ok: 'ok', echec: 'crit', attente: 'warn', aucun: undefined } as const
const lien = (url: string, texte: string) => (url ? <a href={url} target="_blank" rel="noreferrer">{texte}</a> : <span>{texte}</span>)

function jours(iso: string): string {
  const t = Date.parse(iso)
  if (!t) return ''
  const j = Math.floor((Date.now() - t) / 86400000)
  return j <= 0 ? "aujourd'hui" : `il y a ${j} j`
}

function Flux({ w }: { w: Workflow }) {
  return (
    <div className="cd-row">
      <Chip tone={TON_RUN[w.dernier.etat]}>{ETAT_RUN[w.dernier.etat]}</Chip>
      {lien(w.dernier.url, w.workflow)}
      <span className="cd-serie" title="10 derniers runs, du plus récent au plus ancien">{w.serie.map((e, i) => <i key={i} className={e} />)}</span>
      <span className="m">{w.taux_ok != null ? `${w.taux_ok} % de réussite` : ''}{w.duree_moy_s != null ? ` · ${fmtDuree(w.duree_moy_s)} en moyenne` : ''}{w.echecs_ailleurs ? ` · ${w.echecs_ailleurs} échec(s) sur d'autres branches` : ''}</span>
    </div>
  )
}

function LignePr({ p }: { p: Pr }) {
  const att = prAttention(p)
  return (
    <div className="cd-row">
      <code>#{p.numero}</code>
      {lien(p.url, p.titre)}
      <Chip tone={TON_CTRL[p.controles]}>{CTRL[p.controles]}</Chip>
      {p.conflit && <Chip tone="crit">conflit</Chip>}
      {p.brouillon && <Chip>brouillon</Chip>}
      {p.dependabot && <Chip tone="gold">dependabot{p.ecosysteme ? ` ${p.ecosysteme}` : ''}</Chip>}
      {p.revue === 'approved' && <Chip tone="ok">approuvée</Chip>}
      {p.revue === 'changes_requested' && <Chip tone="warn">changements demandés</Chip>}
      <span className="m">{att === 'ok' ? 'prête à fusionner · ' : ''}{p.auteur} · {jours(p.maj)}</span>
    </div>
  )
}

function Depot({ d, f }: { d: DepotCi; f: FiltresCi }) {
  const prs = filtrerPrs(d.prs ?? [], f)
  const echecs = (d.workflows ?? []).filter((w) => w.dernier.etat === 'echec').length
  return (
    <details className="cd-dep" open={!depotSain(d)}>
      <summary>
        <b>{d.depot}</b>
        {d.erreur && <Chip tone="crit">{d.erreur}</Chip>}
        {echecs > 0 && <Chip tone="crit">{echecs} build{echecs > 1 ? 's' : ''} en échec</Chip>}
        {(d.prs?.length ?? 0) > 0 && <Chip>{d.prs!.length} PR</Chip>}
        {d.alertes && d.alertes.total > 0 && <Chip tone="crit">{d.alertes.total} alerte{d.alertes.total > 1 ? 's' : ''} dependabot</Chip>}
        {depotSain(d) && <Chip tone="ok">sain</Chip>}
      </summary>
      {d.workflows && d.workflows.length > 0 && <><div className="cd-sub">builds (branche {d.principale})</div>{d.workflows.map((w) => <Flux key={w.workflow} w={w} />)}</>}
      {d.workflows?.length === 0 && <div className="cd-sub">aucun workflow GitHub Actions</div>}
      {prs.length > 0 && <><div className="cd-sub">pull requests</div>{prs.map((p) => <LignePr key={p.numero} p={p} />)}</>}
      {d.alertes && d.alertes.alertes.length > 0 && <>
        <div className="cd-sub">alertes dependabot</div>
        {d.alertes.alertes.slice(0, 8).map((a, i) => (
          <div className="cd-row" key={i}><Chip tone={TON_GRAVITE[a.gravite] || undefined}>{a.gravite}</Chip>{lien(a.url, a.paquet)}<span className="m">{a.resume}{a.corrige_en ? ` · corrigé en ${a.corrige_en}` : ' · pas de correctif'}</span></div>
        ))}
      </>}
      {d.alertes === null && !d.erreur && <div className="cd-sub">alertes dependabot illisibles (le jeton gh n'y a pas accès)</div>}
    </details>
  )
}

export function CiBoard({ releve, f, maj }: { releve: ReleveCi; f: FiltresCi; maj: Maj }) {
  const r = releve.resume
  const depots = trierDepotsCi(releve.depots).filter((d) => !f.masquerSains || !depotSain(d))
  const bascule = (cle: keyof FiltresCi, texte: string) => (
    <label className="at-check"><input type="checkbox" checked={f[cle]} onChange={(e) => maj({ [cle]: e.target.checked })} /> {texte}</label>
  )
  return (
    <>
      <div className="cd-sum">
        <Chip tone={r.builds_en_echec ? 'crit' : 'ok'}>{r.builds_en_echec} build(s) en échec</Chip>
        {r.builds_en_cours > 0 && <Chip tone="warn">{r.builds_en_cours} en cours</Chip>}
        <Chip>{r.prs} PR ouvertes</Chip>
        {r.prs_controles_en_echec > 0 && <Chip tone="crit">{r.prs_controles_en_echec} aux contrôles en échec</Chip>}
        {r.prs_en_conflit > 0 && <Chip tone="crit">{r.prs_en_conflit} en conflit</Chip>}
        <Chip tone="gold">{r.dependabot_prs} PR dependabot</Chip>
        {r.alertes > 0 && <Chip tone={r.alertes_graves ? 'crit' : 'warn'}>{r.alertes} alertes ({r.alertes_graves} graves)</Chip>}
        {r.illisibles > 0 && <Chip tone="warn">{r.illisibles} dépôt(s) illisible(s)</Chip>}
      </div>
      <p className="au-note" style={{ marginTop: 0 }}>{phraseResumeCi(r)}. Dépôts suivis : ceux de « branches &amp; pr » (écran projets).</p>
      <div className="cd-bar">
        {bascule('seulementProblemes', 'PR à surveiller seulement')}
        {bascule('sansBrouillons', 'sans brouillons')}
        {bascule('dependabotSeul', 'dependabot seulement')}
        {bascule('masquerSains', 'masquer les dépôts sains')}
        <button className="btn sm" onClick={() => maj(FILTRES_CI)}>tout afficher</button>
      </div>
      {depots.length === 0 && <p className="au-note">Aucun dépôt à afficher avec ces filtres.</p>}
      {depots.map((d) => <Depot key={d.depot} d={d} f={f} />)}
    </>
  )
}
