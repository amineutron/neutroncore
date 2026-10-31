import { useState } from 'react'
import { GRAVITES, FILTRES_DEPS, TON_GRAVITE, aplatir, commandeConseillee, filtrerVulns, phraseCorrectif, projetsDeps, type FiltresDeps, type Gravite, type LigneVuln, type ReleveDeps } from '../../lib/ciDeps'
import { Chip } from '../ui'

type Maj = (suite: Partial<FiltresDeps>) => void

function Ligne({ v }: { v: LigneVuln }) {
  const c = phraseCorrectif(v.correctif)
  const cmd = commandeConseillee(v.source, v)
  return (
    <>
      <div className="cd-row">
        <Chip tone={TON_GRAVITE[v.gravite] || undefined}>{v.gravite}</Chip>
        {v.url ? <a href={v.url} target="_blank" rel="noreferrer"><code>{v.paquet}{v.version ? ` ${v.version}` : ''}</code></a> : <code>{v.paquet}{v.version ? ` ${v.version}` : ''}</code>}
        <Chip>{v.source}</Chip>
        <span className="m">{v.direct ? 'directe' : v.via.length ? `via ${v.via.join(', ')}` : 'indirecte'}</span>
        <Chip tone={c.tone || undefined}>{c.texte}</Chip>
        <span className="m">{v.titres[0] ?? v.identifiant ?? ''}</span>
      </div>
      {cmd && <div className="cd-cmd">à lancer à la main : {cmd}</div>}
    </>
  )
}

export function DepsBoard({ releve, f, maj, exclus, exclure }: {
  releve: ReleveDeps; f: FiltresDeps; maj: Maj; exclus: string[]; exclure: (liste: string[]) => void
}) {
  const [reglages, setReglages] = useState(false)
  const toutes = aplatir(releve.projets)
  const lignes = filtrerVulns(toutes, f)
  const r = releve.resume
  const basculeGravite = (g: Gravite) => maj({ gravites: f.gravites.includes(g) ? f.gravites.filter((x) => x !== g) : [...f.gravites, g] })
  const parProjet = releve.projets.map((p) => ({ p, l: lignes.filter((v) => v.projet === p.projet) }))
  const pasDeProjet = f.projet && !releve.projets.some((p) => p.projet === f.projet)
  const candidats = [...new Set([...releve.decouverts, ...exclus])].sort()
  return (
    <>
      <div className="cd-sum">
        {GRAVITES.filter((g) => r.par_gravite[g]).map((g) => (
          <button key={g} className={`chip ${TON_GRAVITE[g]} ${f.gravites.includes(g) ? 'sel' : ''}`} onClick={() => basculeGravite(g)}
            title="cliquer pour filtrer par gravité">{r.par_gravite[g]} {g}</button>
        ))}
        {r.vulns === 0 && <Chip tone="ok">aucune vulnérabilité connue</Chip>}
        <Chip>{r.avec_correctif} avec correctif</Chip><Chip>{r.sans_correctif} sans</Chip>
        <Chip>{r.projets_touches}/{r.projets} projets touchés</Chip>
        {r.illisibles > 0 && <Chip tone="warn">{r.illisibles} audit(s) incomplet(s)</Chip>}
      </div>
      {r.pip_audit_absent && <p className="au-note">pip-audit n'est pas installé : les projets Python ne sont pas audités. Installation (à faire à la main) : <code>pipx install pip-audit</code>.</p>}
      <div className="cd-bar">
        <label className="at-check"><input type="checkbox" checked={f.avecCorrectif} onChange={(e) => maj({ avecCorrectif: e.target.checked })} /> avec correctif seulement</label>
        <label className="at-check"><input type="checkbox" checked={f.directes} onChange={(e) => maj({ directes: e.target.checked })} /> dépendances directes seulement</label>
        <select value={f.projet} onChange={(e) => maj({ projet: e.target.value })} aria-label="projet">
          <option value="">tous les projets</option>
          {projetsDeps(releve.projets).map((p) => <option key={p} value={p}>{p}</option>)}
          {pasDeProjet && <option value={f.projet}>{f.projet} (absent)</option>}
        </select>
        <button className="btn sm" onClick={() => maj(FILTRES_DEPS)}>tout afficher</button>
        <span className="sp" />
        <button className="btn sm" onClick={() => setReglages(!reglages)}>{reglages ? 'fermer' : `projets audités (${releve.decouverts.length})`}</button>
      </div>
      {reglages && (
        <div className="cd-excl">
          {candidats.map((p) => (
            <label key={p} className="at-check"><input type="checkbox" checked={!exclus.includes(p)}
              onChange={(e) => exclure(e.target.checked ? exclus.filter((x) => x !== p) : [...exclus, p])} /> {p}</label>
          ))}
          <p className="au-note" style={{ width: '100%' }}>Décocher exclut le projet du prochain relevé (« relancer »).</p>
        </div>
      )}
      <p className="au-note" style={{ marginTop: 0 }}>Aucun correctif n'est appliqué par l'app : les commandes proposées sont à lancer toi-même. {lignes.length} ligne(s) affichée(s) sur {toutes.length}.</p>
      {parProjet.filter(({ p, l }) => l.length > 0 || (!f.gravites.length && !f.avecCorrectif && !f.directes && (p.npm?.erreur || p.pip?.erreur))).map(({ p, l }) => (
        <details key={p.projet} className="cd-proj" open={l.length > 0 && l.length <= 12}>
          <summary>
            <b>{p.projet}</b><Chip tone={l.length ? 'warn' : 'ok'}>{l.length} vulnérabilité{l.length > 1 ? 's' : ''}</Chip>
            {(['npm', 'pip'] as const).map((s) => p[s]?.erreur ? <Chip key={s} tone="warn">{s} : {p[s]!.erreur.slice(0, 80)}</Chip> : null)}
          </summary>
          {l.map((v, i) => <Ligne key={`${v.source}${v.paquet}${v.identifiant ?? i}`} v={v} />)}
        </details>
      ))}
      {lignes.length === 0 && r.vulns > 0 && <p className="au-note">Rien ne correspond à ces filtres.</p>}
    </>
  )
}
