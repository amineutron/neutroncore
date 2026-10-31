import { useContext, useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPut, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { confirmDialog, toast } from '../lib/dialog'
import { dureeLisible, type Rampe } from '../lib/rampes'
import { identifiant, reveilDepuisModele, type Reveil, type ReveilListe } from '../lib/reveil'
import { MONTEE_POUR_REVEIL, courbesPourReveil } from '../lib/rampesAssistant'
import {
  HORAIRE_DEFAUT, automationDuReveil, echeanceLisible, horaireDepuis, phraseEssai, phraseReveil, problemeReveil, prochainReveil,
  trouverAutomation, type Horaire,
} from '../lib/reveilAssistant'
import type { Automation } from '../lib/automations'
import { NavContext } from '../App'
import { Card, Chip, Loader, PageTitle } from '../components/ui'
import { AssistantReveil } from '../components/reveil/AssistantReveil'
import type { Lampes } from '../components/reveil/SelecteurLampes'
import '../components/reveil/reveil.css'
import '../components/reveil/assistant.css'
import '../components/audit-ux-lot3.css'

const EXEMPLES = [
  { nom: 'semaine', duree_min: 20, desc: 'tous les jours de semaine à 7h30, la lumière monte pendant 20 minutes', horaire: { heure: '07:30', jours: [0, 1, 2, 3, 4] } },
  { nom: 'week-end tranquille', duree_min: 40, desc: 'le week-end à 9h, une montée plus lente de 40 minutes', horaire: { heure: '09:00', jours: [5, 6] } },
]

type Action = () => Promise<{ success?: boolean; error?: string | null }>

export function ReveilScreen() {
  const navigate = useContext(NavContext)
  const liste = usePoll<ReveilListe>(() => apiGet('/reveil'), 2000)
  const autos = usePoll<{ automations: Automation[] }>(() => apiGet('/automations'), 6000)
  const [lampes, setLampes] = useState<Lampes>({})
  const [rampes, setRampes] = useState<Rampe[]>([])
  const [brouillon, setBrouillon] = useState<Reveil | null>(null)
  const [horaire, setHoraire] = useState<Horaire | null>(null)
  const [busy, setBusy] = useState('')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { void apiGet<{ lights: Lampes }>('/hue/lights').then((d) => setLampes(d.lights)).catch(() => setLampes({})) }, [])
  useEffect(() => { void apiGet<{ rampes: Rampe[] }>('/rampes').then((d) => setRampes(d.rampes)).catch(() => setRampes([])) }, [])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])
  const d = liste.data
  const lesAutos = autos.data?.automations ?? []
  const noms = useMemo(() => Object.fromEntries(Object.entries(lampes).map(([id, l]) => [id, l.name])), [lampes])

  // une montée choisie dans « rampes de lumière » : on la propose tout de suite comme forme du nouveau réveil
  useEffect(() => {
    if (!d || brouillon) return
    let id: string | null = null
    try { id = sessionStorage.getItem(MONTEE_POUR_REVEIL); if (id) sessionStorage.removeItem(MONTEE_POUR_REVEIL) } catch { /* stockage indisponible */ }
    const m = id ? rampes.find((x) => x.id === id) : undefined
    if (!m) return
    const base: Reveil = { ...d.modele, id: identifiant('reveil', d.reveils.map((r) => r.id)), nom: 'nouveau réveil', lampes: m.pistes[0]?.lampes ?? [] }
    setHoraire(HORAIRE_DEFAUT)
    setBrouillon({ ...base, courbe: courbesPourReveil(m, base.duree_min) })
  }, [d, rampes, brouillon])

  if (!d) return <><PageTitle help="reveil" title="réveil" desc="Choisis une heure : la lumière monte doucement, puis la télé s’allume si tu veux." />{liste.error ? <p className="rv-alerte">API injoignable : {liste.error}</p> : <Loader label="lecture des réveils…" />}</>

  const lecture = d.lecture
  const essai = Math.max(30, d.limites.essai_min_s)
  const horaireDe = (r: Reveil) => horaireDepuis(trouverAutomation(lesAutos, r.id), r.duree_min)
  const agir = async (cle: string, f: Action, ok: string): Promise<boolean> => {
    setBusy(cle)
    try {
      const r = await f()
      toast(r.success === false ? (r.error ?? 'refusé') : ok, r.success === false ? 'crit' : 'ok')
      return r.success !== false
    } catch (e) { toast((e as Error).message, 'crit'); return false } finally { setBusy(''); liste.refresh(); autos.refresh() }
  }
  const ouvrir = (r: Reveil, h: Horaire | null) => { setBrouillon(r); setHoraire(h) }
  const nouveau = (nom = 'nouveau réveil', duree?: number, h: Horaire | null = HORAIRE_DEFAUT) => {
    const dm = Math.min(Math.max(duree ?? d.modele.duree_min, d.limites.duree_min), d.limites.duree_max)
    ouvrir(reveilDepuisModele(d.modele, identifiant(nom, d.reveils.map((r) => r.id)), nom, dm), h)
  }
  /** Enregistre le réveil, puis l'heure fixe (une automatisation que l'on crée, met à jour ou retire sans que tu aies à y aller). */
  const enregistrer = async () => {
    if (!brouillon) return
    const prob = problemeReveil(brouillon, horaire)
    if (prob) { toast(prob, 'crit'); return }
    const existante = trouverAutomation(lesAutos, brouillon.id)
    const ok = await agir('save', async () => {
      const r = await apiPut<{ success?: boolean; error?: string | null }>(`/reveil/${brouillon.id}`, brouillon)
      if (r.success === false) return r
      if (horaire) return apiPut<{ success?: boolean; error?: string | null }>(`/automations/${existante?.id ?? 'new'}`, { automation: automationDuReveil(brouillon, horaire, existante ?? undefined) })
      if (existante) return apiDelete<{ success?: boolean }>(`/automations/${existante.id}`, await withConfirm('automations_delete'))
      return r
    }, horaire ? 'réveil enregistré, il se lancera tout seul' : 'réveil enregistré')
    if (ok) setBrouillon(null)
  }
  const supprimer = async (r: Reveil) => {
    if (!(await confirmDialog({ title: `supprimer « ${r.nom} » ?`, body: 'Les lampes ne sont pas touchées. Son heure fixe disparaît aussi.', danger: true, ok: 'supprimer' }))) return
    const a = trouverAutomation(lesAutos, r.id)
    await agir('del', async () => {
      const res = await apiDelete<{ success?: boolean }>(`/reveil/${r.id}`, await withConfirm('reveil_supprimer'))
      if (a) await apiDelete(`/automations/${a.id}`, await withConfirm('automations_delete'))
      return res
    }, 'réveil supprimé')
  }
  const basculer = async (r: Reveil) => {
    const a = trouverAutomation(lesAutos, r.id)
    const suivant = { ...r, enabled: !r.enabled }
    await agir('pause' + r.id, async () => {
      const res = await apiPut<{ success?: boolean; error?: string | null }>(`/reveil/${r.id}`, suivant)
      const h = horaireDe(r)
      if (res.success !== false && a && h) await apiPut(`/automations/${a.id}`, { automation: automationDuReveil(suivant, h, a) })
      return res
    }, suivant.enabled ? 'réveil activé' : 'réveil en pause : il ne se lancera plus')
  }
  const lancer = async (r: Reveil, secondes?: number) => {
    const quoi = secondes ? `essai de ${secondes} s` : `montée de ${r.duree_min} min`
    const lamp = r.lampes.map((l) => noms[l] ?? `lampe ${l}`).join(', ')
    const corps = secondes ? phraseEssai(secondes, r.duree_min) : `Les lampes ${lamp} vont s’allumer${r.tele.actif ? ' et la télé suivra' : ''}.`
    if (!(await confirmDialog({ title: `lancer ${quoi} ?`, body: corps, ok: 'lancer' }))) return
    await agir('go' + r.id, async () => apiPost(`/reveil/${r.id}/lancer`, { essai_s: secondes ?? null, avec_tele: false }, await withConfirm('reveil_lancer')), secondes ? 'essai lancé' : 'réveil lancé')
  }

  const prochains = d.reveils.filter((r) => r.enabled).flatMap((r) => {
    const h = horaireDe(r)
    const quand = h ? prochainReveil(h, now) : null
    return quand ? [{ r, h: h!, quand }] : []
  }).sort((a, b) => a.quand.getTime() - b.quand.getTime())
  const prochain = prochains[0]
  const b = lecture?.bilan

  return (
    <>
      <PageTitle help="reveil" title="réveil" desc="Choisis une heure : la lumière monte doucement dans la pièce, puis la télé s’allume si tu veux." />
      {d.ecartes.length > 0 && <p className="rv-note">{d.ecartes.length} réveil(s) du fichier ignoré(s) : {d.ecartes.join(' ; ')}</p>}
      <Card title="prochain réveil">
        {prochain
          ? <div className="rv-hero"><div><div className="quand">{echeanceLisible(prochain.quand, now)}</div><small>{prochain.r.nom} : {phraseReveil(prochain.r, prochain.h, noms)}</small></div></div>
          : <p className="rv-aide">{d.reveils.length ? 'Aucun réveil automatique n’est actif. Active un réveil ci-dessous, ou donne-lui une heure fixe.' : 'Pas encore de réveil. Crée-en un en quelques secondes ci-dessous.'}</p>}
      </Card>
      {lecture?.en_cours && lecture.genre === 'reveil' && (
        <Card title={`en cours : ${lecture.nom}`} lite={`${dureeLisible(lecture.t)} sur ${dureeLisible(lecture.duree)}`}>
          <div className="rv-barre"><i style={{ width: `${(lecture.t / Math.max(lecture.duree, 1)) * 100}%` }} /></div>
          <div className="rv-ctl"><button className="btn sm danger" onClick={() => agir('stop', () => apiPost('/reveil/arret'), 'arrêté : les lampes restent comme elles sont')}>arrêter</button></div>
        </Card>
      )}
      {b && !lecture?.en_cours && lecture?.genre === 'reveil' && (
        <p className={b.fini && !b.erreur ? 'chip ok' : 'rv-note'}>dernier réveil « {lecture.nom} » : {b.fini ? 'terminé' : 'interrompu'}{b.erreur ? ` · ${b.erreur}` : ''}
          {(b.evenements ?? []).map((e) => ` · télé ${e.success ? 'allumée' : `en échec (${e.error})`}`)}</p>
      )}
      <Card title="mes réveils">
        <div className="rv-liste">
          {d.reveils.length === 0 && (
            <>
              <p className="rv-aide">Pars d’un exemple : tu pourras tout changer avant d’enregistrer.</p>
              <div className="ex-list">
                {EXEMPLES.map((e) => (
                  <div key={e.nom} className="ex-item">
                    <span className="ex-t"><b>{e.nom}</b><small>{e.desc}</small></span>
                    <button className="btn sm solid" onClick={() => nouveau(e.nom, e.duree_min, e.horaire)}>partir de cet exemple</button>
                  </div>
                ))}
              </div>
            </>
          )}
          {d.reveils.map((r) => {
            const h = horaireDe(r)
            const occupe = busy !== '' || Boolean(lecture?.en_cours)
            return (
              <div key={r.id} className={`rv-carte ${brouillon?.id === r.id ? 'on' : ''} ${r.enabled ? '' : 'pause'}`}>
                <div className="rv-tete">
                  <b>{r.nom} {!r.enabled && <Chip tone="warn">en pause</Chip>}</b>
                  <label className="rv-inter"><input type="checkbox" checked={r.enabled} disabled={busy !== ''} onChange={() => basculer(r)} aria-label={`réveil ${r.nom} actif`} /><i />{r.enabled ? 'actif' : 'en pause'}</label>
                </div>
                <p className="rv-phrase">{phraseReveil(r, h, noms)}</p>
                <div className="rv-ligne">
                  <button className="btn sm" onClick={() => ouvrir(r, h)}>modifier</button>
                  <button className="btn sm" disabled={occupe || !r.lampes.length} title={phraseEssai(essai, r.duree_min)} onClick={() => lancer(r, essai)}>essayer {essai} s</button>
                  <button className="btn sm" disabled={occupe || !r.lampes.length} onClick={() => lancer(r)}>lancer maintenant</button>
                  <button className="btn sm" onClick={() => supprimer(r)} aria-label={`Supprimer ${r.nom}`}>supprimer</button>
                </div>
              </div>
            )
          })}
        </div>
        {d.reveils.length > 0 && <p className="rv-aide" style={{ marginTop: 10 }}>« essayer {essai} s » joue toute la montée en {essai} secondes pour voir si elle te plaît ; la télé ne bouge pas.</p>}
        <div className="rv-ligne" style={{ marginTop: 10 }}><button className="btn sm solid" onClick={() => nouveau()}>+ nouveau réveil</button></div>
      </Card>
      {brouillon && (
        <>
          <AssistantReveil r={brouillon} horaire={horaire} liste={d} lampes={lampes} lecture={lecture} rampes={rampes} onChange={setBrouillon} onHoraire={setHoraire} onRampes={() => navigate('rampes')} />
          <div className="rv-ligne" style={{ marginTop: 10 }}>
            <button className="btn solid" disabled={busy !== '' || problemeReveil(brouillon, horaire) !== ''} onClick={enregistrer}>enregistrer</button>
            <button className="btn" onClick={() => setBrouillon(null)}>fermer sans enregistrer</button>
          </div>
        </>
      )}
    </>
  )
}
