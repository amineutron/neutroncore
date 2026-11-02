import { useRef, useState } from 'react'
import { apiGet, apiPost, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { applySettings } from '../../lib/settings'
import { usePoll } from '../../lib/poll'
import {
  annulerLocal, appliquerLocal, collecterLocal, dateLisible, lireAvantImport, lireDocument, motEcart, motStatut, nomFichierExport,
  sectionsParDefaut, type Apercu, type Document, type Resultat, type Sauvegarde,
} from '../../lib/reglages'
import { Btn, Card, Chip, Loader } from '../ui'

type Inv = { entrees: { nom: string; classe: string; raison: string }[]; sections: { id: string; libelle: string; note: string }[] }
const TON = { configuration: 'ok', secret: 'crit', 'etat jetable': undefined, 'non classe': 'warn' } as const

function telecharger(nom: string, texte: string): void {
  const url = URL.createObjectURL(new Blob([texte], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url; a.download = nom; a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Inventaire() {
  const inv = usePoll<Inv>(() => apiGet('/reglages/inventaire'), 60_000)
  if (!inv.data) return <Loader />
  return (
    <details className="rg-det">
      <summary>ce qui est exporté et ce qui ne l’est jamais ({inv.data.entrees.length} éléments)</summary>
      <ul className="rg-inv">
        {inv.data.entrees.map((e) => (
          <li key={e.nom}><Chip tone={TON[e.classe as keyof typeof TON]}>{e.classe}</Chip> <b>{e.nom}</b> <span>{e.raison}</span></li>
        ))}
      </ul>
      <p className="rg-note">les clés d’API, mots de passe, jetons et fichiers .cred ne sont jamais exportés, même s’ils se trouvent dans un réglage.</p>
    </details>
  )
}

function Exporter() {
  const [attente, setAttente] = useState(false)
  const lancer = async () => {
    setAttente(true)
    try {
      const doc = await apiPost<Document>('/reglages/export', { local: collecterLocal(localStorage) })
      telecharger(nomFichierExport(new Date()), JSON.stringify(doc, null, 2))
      const n = Object.keys(doc.sections ?? {}).length
      toast(`export prêt : ${n} sections${doc.masques?.length ? `, ${doc.masques.length} valeur(s) sensible(s) retirée(s)` : ''}`)
    } catch (e) { toast((e as Error).message, 'crit') } finally { setAttente(false) }
  }
  return (
    <Card title="exporter" lite="un seul fichier, sans aucun secret">
      <p className="rg-note">réglages de l’app (thème, favoris, filtres retenus) et configuration de l’API : automatisations, routines, lumière, caméra, lanceur, notifications...</p>
      <Btn solid onClick={() => void lancer()} disabled={attente}>{attente ? 'préparation...' : 'télécharger l’export'}</Btn>
      <Inventaire />
    </Card>
  )
}

function Sauvegardes({ liste, onFait }: { liste: Sauvegarde[]; onFait: () => void }) {
  const restaurer = async (s: Sauvegarde) => {
    if (!await confirmDialog({ title: `revenir à la sauvegarde ${s.nom} ?`, body: `Remet ${s.sections.join(', ')} comme avant l’import. L’état actuel est sauvegardé d’abord : tu pourras revenir en arrière.`, ok: 'restaurer', danger: true })) return
    try {
      const r = await apiPost<{ resultats: Resultat[] }>(`/reglages/sauvegardes/${encodeURIComponent(s.nom)}/restaurer`, {}, await withConfirm('reglages_restaurer'))
      toast(`${r.resultats.filter((x) => x.ok).length} section(s) restaurée(s)`)
      onFait()
    } catch (e) { toast((e as Error).message, 'crit') }
  }
  if (!liste.length) return <p className="rg-note">aucune sauvegarde pour l’instant : la première est créée automatiquement avant un import.</p>
  return (
    <ul className="rg-bak">
      {liste.map((s) => (
        <li key={s.nom}>
          <span><b>{dateLisible(s.cree_le) || s.nom}</b> <em>{s.motif}</em></span>
          <span className="rg-sec">{s.sections.join(', ')}</span>
          <Btn sm onClick={() => void restaurer(s)}>restaurer</Btn>
        </li>
      ))}
    </ul>
  )
}

export default function ExportImport() {
  const [doc, setDoc] = useState<Document | null>(null)
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [choix, setChoix] = useState<string[]>([])
  const [localOk, setLocalOk] = useState(true)
  const [resultats, setResultats] = useState<Resultat[] | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [avantLocal, setAvantLocal] = useState(() => lireAvantImport(localStorage) !== null)
  const champ = useRef<HTMLInputElement>(null)
  const baks = usePoll<{ sauvegardes: Sauvegarde[] }>(() => apiGet('/reglages/sauvegardes'), 30_000)

  const choisir = async (f: File | undefined) => {
    if (!f) return
    setResultats(null); setApercu(null)
    const { doc: d, erreur } = lireDocument(await f.text())
    if (!d) { setDoc(null); toast(erreur, 'crit'); return }
    try {
      const a = await apiPost<Apercu>('/reglages/import/apercu', { document: d, local_actuel: collecterLocal(localStorage) })
      setDoc(d); setApercu(a); setChoix(sectionsParDefaut(a)); setLocalOk(a.local?.statut === 'different')
      if (!a.valide) toast(a.erreurs.join(' ; '), 'crit')
    } catch (e) { toast((e as Error).message, 'crit') }
    if (champ.current) champ.current.value = ''
  }

  const appliquer = async () => {
    if (!doc || !apercu) return
    const n = choix.length + (localOk && apercu.local ? 1 : 0)
    if (!n) return
    if (!await confirmDialog({
      title: 'appliquer ces réglages ?',
      body: `${choix.length} section(s) de l’API${localOk && apercu.local ? ' et les réglages de ce navigateur' : ''}. Une sauvegarde automatique de l’état actuel est faite avant : tout se défait depuis « sauvegardes ».`,
      ok: 'appliquer', danger: true,
    })) return
    setEnCours(true)
    try {
      let res: Resultat[] = []
      let local: Record<string, string> = {}
      if (choix.length || localOk) {
        const r = await apiPost<{ resultats: Resultat[]; local: Record<string, string> }>(
          '/reglages/import/appliquer', { document: doc, sections: choix }, await withConfirm('reglages_import'))
        res = r.resultats; local = r.local
      }
      if (localOk && apercu.local && Object.keys(local).length) {
        appliquerLocal(localStorage, local); applySettings(); setAvantLocal(true)
        res = [...res, { id: 'navigateur', ok: true, message: `${Object.keys(local).length} réglage(s) appliqué(s) : recharge la page pour tout voir` }]
      }
      setResultats(res); setApercu(null); setDoc(null); baks.refresh()
    } catch (e) { toast((e as Error).message, 'crit') } finally { setEnCours(false) }
  }

  const bascule = (id: string) => setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  return (
    <div className="grid rg-cols">
      <Exporter />
      <Card title="importer" lite="aperçu, sauvegarde automatique, retour possible">
        <input ref={champ} type="file" accept="application/json,.json" aria-label="fichier d’export à importer" onChange={(e) => void choisir(e.target.files?.[0])} />
        {apercu?.valide && (
          <div className="rg-apercu">
            {apercu.sections.map((s) => (
              <details key={s.id} className="rg-sect">
                <summary>
                  <input type="checkbox" aria-label={`importer ${s.libelle}`} disabled={s.statut === 'invalide' || s.statut === 'inconnue' || s.statut === 'identique'}
                    checked={choix.includes(s.id)} onChange={() => bascule(s.id)} onClick={(e) => e.stopPropagation()} />
                  <b>{s.libelle}</b> <Chip tone={s.statut === 'invalide' ? 'crit' : s.statut === 'identique' ? undefined : 'gold'}>{motStatut(s.statut)}</Chip>
                </summary>
                {s.erreurs.map((e) => <p key={e} className="rg-err">{e}</p>)}
                <pre className="rg-diff">{s.diff.map(motEcart).join('\n') || 'aucune différence'}</pre>
              </details>
            ))}
            {apercu.local && (
              <details className="rg-sect">
                <summary>
                  <input type="checkbox" aria-label="importer les réglages du navigateur" checked={localOk} onChange={() => setLocalOk(!localOk)} onClick={(e) => e.stopPropagation()} />
                  <b>réglages de ce navigateur</b> <Chip tone="gold">{apercu.local.nombre} clé(s)</Chip>
                </summary>
                {apercu.local.avertissements.map((e) => <p key={e} className="rg-err">{e}</p>)}
                <pre className="rg-diff">{apercu.local.diff.map(motEcart).join('\n') || 'aucune différence'}</pre>
              </details>
            )}
            <Btn solid danger onClick={() => void appliquer()} disabled={enCours || (!choix.length && !(localOk && apercu.local))}>{enCours ? 'application...' : 'appliquer la sélection'}</Btn>
          </div>
        )}
        {resultats && (
          <ul className="rg-res">{resultats.map((r) => <li key={r.id}><Chip tone={r.ok ? 'ok' : 'crit'}>{r.ok ? 'ok' : 'échec'}</Chip> {r.id} <span>{r.message}</span></li>)}</ul>
        )}
      </Card>
      <Card title="sauvegardes" lite="état d’avant chaque import">
        {baks.data ? <Sauvegardes liste={baks.data.sauvegardes} onFait={baks.refresh} /> : <Loader />}
        {avantLocal && (
          <Btn sm onClick={() => { toast(`${annulerLocal(localStorage)} réglage(s) du navigateur remis`); applySettings(); setAvantLocal(false) }}>annuler l’import des réglages du navigateur</Btn>
        )}
      </Card>
    </div>
  )
}
