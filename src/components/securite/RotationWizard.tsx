import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'
import {
  BROUILLON_VIDE, brouillonDepuis, corpsElement, erreursEtape,
  type Brouillon, type Catalogue, type Inventaire, type SondeType,
} from '../../lib/rotation'
import { Btn, Chip, Loader } from '../ui'

const ETAPES = ['1  choisir', '2  contrôler', '3  planifier']

export function RotationWizard({ cat, coffreOk, raison, onClose, onDone }: {
  cat: Catalogue; coffreOk: boolean; raison: string; onClose: () => void; onDone: () => void
}) {
  const [etape, setEtape] = useState<1 | 2 | 3>(1)
  const [b, setB] = useState<Brouillon>(BROUILLON_VIDE)
  const [q, setQ] = useState('')
  const [dossier, setDossier] = useState('')
  const [inv, setInv] = useState<Inventaire | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const maj = (p: Partial<Brouillon>) => setB((a) => ({ ...a, ...p }))
  const erreurs = erreursEtape(etape, b, cat)

  // la recherche attend la fin de la frappe ; seules des métadonnées sont lues
  useEffect(() => {
    if (!coffreOk) return
    const t = setTimeout(() => {
      const p = new URLSearchParams({ q, dossier })
      apiGet<Inventaire>(`/rotation/inventaire?${p}`).then(setInv).catch((e) => setErr(String(e?.message ?? e)))
    }, 300)
    return () => clearTimeout(t)
  }, [q, dossier, coffreOk])

  async function enregistrer() {
    setBusy(true); setErr('')
    try {
      await apiPost('/rotation/elements', corpsElement(b))
      onDone()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  return (
    <div className="rot-wiz">
      <div className="steps">{ETAPES.map((e, i) => <span key={e} className={i + 1 === etape ? 'on' : ''}>{e}</span>)}</div>

      {etape === 1 && (
        <>
          <p className="rot-note">Choisis l'élément du coffre à faire tourner. Seuls le nom, l'identifiant, le dossier et la date sont lus : jamais le mot de passe.</p>
          {!coffreOk && <p className="rot-err">{raison}</p>}
          <div className="sec-row sec-filters" style={{ flexWrap: 'wrap' }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="chercher un nom, un identifiant" aria-label="recherche" disabled={!coffreOk} />
            <select value={dossier} onChange={(e) => setDossier(e.target.value)} aria-label="dossier" disabled={!coffreOk}>
              <option value="">tous les dossiers</option>
              {(inv?.dossiers ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {coffreOk && !inv && <Loader label="lecture du coffre…" />}
          <div className="rot-inv">
            {inv?.items.length === 0 && <span className="sec-muted">aucun résultat</span>}
            {inv?.items.map((it) => (
              <button key={it.id} className={b.item?.id === it.id ? 'on' : ''} disabled={it.planifie}
                onClick={() => setB(brouillonDepuis(it))} aria-pressed={b.item?.id === it.id}>
                <b>{it.nom}</b>
                <span className="sec-muted">{it.identifiant}{it.dossier ? ` · ${it.dossier}` : ''}{it.modifie ? ` · modifié ${it.modifie.slice(0, 10)}` : ''}</span>
                {it.planifie && <Chip tone="ok">déjà planifiée</Chip>}
              </button>
            ))}
          </div>
        </>
      )}

      {etape === 2 && (
        <>
          <p className="rot-note">Comment l'app saura-t-elle que la rotation n'a rien cassé ? Sans sonde ni adaptateur, la rotation reste assistée : elle prépare le secret mais ne le pousse pas.</p>
          <label>comment appliquer le nouveau secret
            <select value={b.adaptateur} onChange={(e) => maj({ adaptateur: e.target.value as Brouillon['adaptateur'] })}>
              {Object.entries(cat.adaptateurs).map(([k, v]) => <option key={k} value={k}>{v.libelle}</option>)}
            </select>
          </label>
          <label>sonde de contrôle (facultative)
            <select value={b.sondeType} onChange={(e) => maj({ sondeType: e.target.value as '' | SondeType })}>
              <option value="">aucune</option>
              {Object.entries(cat.sondes).map(([k, v]) => <option key={k} value={k}>{v.libelle}</option>)}
            </select>
          </label>
          {b.sondeType && (
            <>
              <label>adresse (machine, réseau local ou tailnet)
                <input value={b.sondeUrl} onChange={(e) => maj({ sondeUrl: e.target.value })} placeholder="http://127.0.0.1:8080/api" />
              </label>
              {b.sondeType !== 'http_bearer' && (
                <label>utilisateur
                  <input value={b.sondeUtilisateur} onChange={(e) => maj({ sondeUtilisateur: e.target.value })} autoComplete="off" />
                </label>
              )}
              <label>code attendu
                <input type="number" value={b.sondeAttendu} onChange={(e) => maj({ sondeAttendu: Number(e.target.value) })} />
              </label>
            </>
          )}
          <p className="rot-note">Qui lit ce secret ? Déclare ce qui doit être mis à jour ou relancé : rien n'est redémarré sans être déclaré.</p>
          <label>fichiers .cred à réécrire (un par ligne : chemin ; nom du credential)
            <textarea rows={2} className="rot-ta" value={b.blobs.map((c) => `${c.chemin} ; ${c.nom}`).join('\n')}
              onChange={(e) => maj({ blobs: e.target.value.split('\n').map((l) => l.split(';')).filter((p) => p[0]?.trim()).map((p) => ({ chemin: p[0].trim(), nom: (p[1] ?? '').trim() })) })} />
          </label>
          <label>services utilisateur à relancer ensuite (un par ligne)
            <textarea rows={2} className="rot-ta" value={b.unites.join('\n')}
              onChange={(e) => maj({ unites: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })} />
          </label>
        </>
      )}

      {etape === 3 && (
        <>
          <label>nom
            <input value={b.nom} onChange={(e) => maj({ nom: e.target.value })} maxLength={80} />
          </label>
          <label className="inline">
            <input type="checkbox" checked={b.periodique} onChange={(e) => maj({ periodique: e.target.checked })} />
            planifier une périodicité (sinon : à lancer à la main)
          </label>
          {b.periodique && (
            <label>tous les (jours)
              <input type="number" min={cat.periode_min} max={cat.periode_max} value={b.periode} onChange={(e) => maj({ periode: Number(e.target.value) })} />
            </label>
          )}
          <p className="rot-note">
            À l'échéance, l'app fait un essai à blanc et te prévient ; elle ne tourne seule que si tu l'actives ensuite sur la rotation.
            Rien n'est modifié en enregistrant ce plan.
          </p>
        </>
      )}

      {erreurs.map((e) => <p key={e} className="rot-err">{e}</p>)}
      {err && <p className="rot-err">{err}</p>}
      <div className="rot-actions">
        {etape > 1 && <Btn sm onClick={() => setEtape((etape - 1) as 1 | 2)}>retour</Btn>}
        {etape < 3 && <Btn sm solid onClick={() => setEtape((etape + 1) as 2 | 3)} disabled={erreurs.length > 0}>suivant</Btn>}
        {etape === 3 && <Btn sm solid onClick={enregistrer} disabled={erreurs.length > 0 || busy}>{busy ? 'enregistrement…' : 'enregistrer le plan'}</Btn>}
        <Btn sm onClick={onClose}>annuler</Btn>
      </div>
    </div>
  )
}
