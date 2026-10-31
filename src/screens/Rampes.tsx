import { useContext, useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { confirmDialog, toast } from '../lib/dialog'
import { dureeLisible, type Rampe } from '../lib/rampes'
import { MONTEE_POUR_REVEIL, depuisModeleSimple, peutServirAuReveil, phraseRampe, problemeRampe } from '../lib/rampesAssistant'
import { identifiant, type Lecture } from '../lib/reveil'
import { NavContext } from '../App'
import { Card, Chip, Loader, PageTitle } from '../components/ui'
import { RampeEditeur, type Limites } from '../components/reveil/RampeEditeur'
import { Courbette, ModelesRampe, RampeSimple } from '../components/reveil/RampeSimple'
import type { Lampes } from '../components/reveil/SelecteurLampes'
import '../components/reveil/reveil.css'
import '../components/reveil/assistant.css'
import '../components/audit-ux-lot3.css'

type Liste = { rampes: Rampe[]; ecartes: string[]; lecture: Lecture | null; limites: Limites }

export function Rampes() {
  const navigate = useContext(NavContext)
  const liste = usePoll<Liste>(() => apiGet('/rampes'), 2000)
  const [lampes, setLampes] = useState<Lampes>({})
  const [brouillon, setBrouillon] = useState<Rampe | null>(null)
  const [avance, setAvance] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void apiGet<{ lights: Lampes }>('/hue/lights').then((d) => setLampes(d.lights)).catch(() => setLampes({})) }, [])
  const noms = useMemo(() => Object.fromEntries(Object.entries(lampes).map(([id, l]) => [id, l.name])), [lampes])
  const d = liste.data
  if (!d) return <><PageTitle help="rampes" title="rampes de lumière" desc="Une rampe, c’est la lumière qui monte ou qui baisse doucement dans le temps." />{liste.error ? <p className="rv-alerte">API injoignable : {liste.error}</p> : <Loader label="lecture des rampes…" />}</>

  const lecture = d.lecture
  const agir = async (f: () => Promise<{ success?: boolean; error?: string | null }>, ok: string) => {
    setBusy(true)
    try { const r = await f(); toast(r.success === false ? (r.error ?? 'refusé') : ok, r.success === false ? 'crit' : 'ok') } catch (e) { toast((e as Error).message, 'crit') } finally { setBusy(false); liste.refresh() }
  }
  const creer = (modele: string) => {
    const base = depuisModeleSimple(modele, [])!
    setAvance(false)
    setBrouillon({ ...base, id: identifiant(base.nom, d.rampes.map((r) => r.id)) })
  }
  const supprimer = async (r: Rampe) => {
    if (!(await confirmDialog({ title: `supprimer « ${r.nom} » ?`, body: 'Les réveils qui s’en sont servi gardent leur propre copie de la courbe.', danger: true, ok: 'supprimer' }))) return
    await agir(async () => apiDelete(`/rampes/${r.id}`, await withConfirm('rampe_supprimer')), 'rampe supprimée')
  }
  const jouer = async (r: Rampe) => {
    const lamp = r.pistes.flatMap((p) => p.lampes).map((l) => noms[l] ?? `lampe ${l}`).join(', ')
    if (!(await confirmDialog({ title: `jouer « ${r.nom} » sur les lampes ?`, body: `Les lampes ${lamp} vont changer pendant ${dureeLisible(r.duree_s)}. Tu peux arrêter à tout moment.`, ok: 'jouer' }))) return
    await agir(() => apiPost(`/rampes/${r.id}/jouer`, {}), 'lancée')
  }
  const faireUnReveil = (r: Rampe) => {
    try { sessionStorage.setItem(MONTEE_POUR_REVEIL, r.id) } catch { /* stockage indisponible : on choisira la montée dans le réveil */ }
    navigate('reveil')
  }
  const enCours = lecture?.en_cours ? lecture : null
  const simple = brouillon !== null && brouillon.pistes.length === 1 && !avance
  const probleme = brouillon ? problemeRampe(brouillon) : ''

  return (
    <>
      <PageTitle help="rampes" title="rampes de lumière" desc="Une rampe, c’est la lumière qui monte ou qui baisse doucement dans le temps. Choisis un modèle, ajuste-le, regarde l’aperçu : rien ne touche tes lampes avant que tu le demandes." />
      {d.ecartes.length > 0 && <p className="rv-note">{d.ecartes.length} rampe(s) du fichier ignorée(s) : {d.ecartes.join(' ; ')}</p>}
      {enCours && (
        <Card title={`en cours : ${enCours.nom}`} lite={`${dureeLisible(enCours.t)} sur ${dureeLisible(enCours.duree)}`}>
          <div className="rv-barre"><i style={{ width: `${(enCours.t / Math.max(enCours.duree, 1)) * 100}%` }} /></div>
          <div className="rv-ctl"><button className="btn sm danger" onClick={() => agir(() => apiPost('/rampes/arret'), 'arrêtée : les lampes restent comme elles sont')}>arrêter</button></div>
        </Card>
      )}
      {lecture && !enCours && lecture.bilan?.erreur && <p className="rv-note">dernière lecture « {lecture.nom} » : {lecture.bilan.erreur}</p>}
      <Card title="commencer par un modèle" lite="tu pourras tout ajuster">
        <ModelesRampe onChoisir={creer} choisi={null} />
      </Card>
      <Card title="mes rampes" lite={`${d.rampes.length}`}>
        <div className="rv-liste">
          {d.rampes.length === 0 && <p className="rv-aide">Aucune rampe pour l’instant : choisis un modèle ci-dessus.</p>}
          {d.rampes.map((r) => (
            <div key={r.id} className={`rv-carte ${brouillon?.id === r.id ? 'on' : ''}`}>
              <div className="rv-tete">
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span style={{ width: 70 }}><Courbette r={r} /></span><b>{r.nom}</b> {r.boucle && <Chip tone="gold">sans fin</Chip>}</span>
              </div>
              <p className="rv-phrase">{phraseRampe(r, noms)}</p>
              <div className="rv-ligne">
                <button className="btn sm" onClick={() => { setAvance(r.pistes.length > 1); setBrouillon(r) }}>modifier</button>
                <button className="btn sm" disabled={busy || Boolean(enCours)} title="allume vraiment les lampes de cette rampe" onClick={() => jouer(r)}>jouer sur les lampes</button>
                {peutServirAuReveil(r) && <button className="btn sm" onClick={() => faireUnReveil(r)} title="ouvre l’écran réveil avec cette montée">en faire un réveil</button>}
                <button className="btn sm" onClick={() => supprimer(r)} aria-label={`Supprimer ${r.nom}`}>supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {brouillon && (
        <>
          {simple
            ? <RampeSimple r={brouillon} lampes={lampes} limites={d.limites} lecture={lecture} onChange={setBrouillon} />
            : <RampeEditeur r={brouillon} lampes={lampes} limites={d.limites} lecture={lecture} onChange={setBrouillon} />}
          <div className="rv-ligne" style={{ marginTop: 10 }}>
            <button className="btn solid" disabled={busy || probleme !== ''} onClick={() => agir(() => apiPut(`/rampes/${brouillon.id}`, brouillon), 'rampe enregistrée').then(() => setBrouillon(null))}>enregistrer</button>
            <button className="btn" onClick={() => setBrouillon(null)}>fermer sans enregistrer</button>
            {brouillon.pistes.length === 1 && <button className="btn sm" onClick={() => setAvance(!avance)}>{avance ? 'revenir à l’éditeur simple' : 'plusieurs groupes de lampes (avancé)'}</button>}
          </div>
        </>
      )}
    </>
  )
}
