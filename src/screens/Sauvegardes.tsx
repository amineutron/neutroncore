import { useState } from 'react'
import { apiGet, apiPost, apiPut, withConfirm } from '../lib/api'
import { usePoll } from '../lib/poll'
import { confirmDialog, toast } from '../lib/dialog'
import {
  chargerFiltres, croissanceJour, enregistrerFiltres, lignes, type Filtres, type Reglages, type Tableau,
} from '../lib/sauvegardes'
import { Chip, Loader, PageTitle } from '../components/ui'
import { Resume } from '../components/sauvegardes/Resume'
import { Historique } from '../components/sauvegardes/Historique'
import { Verification } from '../components/sauvegardes/Verification'
import { Seuils } from '../components/sauvegardes/Seuils'
import '../components/sauvegardes/sauvegardes.css'

const TITRE = <PageTitle help="sauvegardes" title="sauvegardes" desc="Timeshift et Borg : ce qui est gardé, depuis quand, combien de place reste, et si une restauration serait possible." />

export function Sauvegardes() {
  const [filtres, setFiltres] = useState<Filtres>(chargerFiltres)
  // 5 s pendant qu'une tâche de fond tourne, sinon 60 s (la lecture touche le journal et les disques)
  const [rapide, setRapide] = useState(false)
  const etat = usePoll<Tableau>(async () => {
    const t = await apiGet<Tableau>('/sauvegardes')
    setRapide(!!t.travail.actif)
    return t
  }, rapide ? 5000 : 60000)
  const t = etat.data
  const occupe = !!t?.travail.actif

  const changerFiltres = (f: Filtres) => { setFiltres(f); enregistrerFiltres(f) }

  async function lancer(type: 'timeshift' | 'borg') {
    const ok = await confirmDialog({
      title: `lancer une sauvegarde ${type} maintenant ?`,
      body: type === 'borg' ? 'Borg lit /home, /etc, /root et /var/log : quelques minutes de disque.' : 'Un snapshot Timeshift de tout le système : quelques minutes de disque.',
      ok: 'lancer',
    })
    if (!ok) return
    try {
      await apiPost('/sauvegardes/lancer', { type }, await withConfirm(`sauvegarde_lancer_${type}`))
      toast(`sauvegarde ${type} lancée`)
      etat.refresh()
    } catch (e) { toast(`lancement refusé : ${(e as Error).message}`, 'crit') }
  }

  async function verifier(niveau: 'rapide' | 'profond') {
    if (niveau === 'profond' && !(await confirmDialog({
      title: 'vérification profonde du dépôt borg ?',
      body: 'Toutes les données sont relues (borg check --verify-data) puis la dernière archive est extraite à blanc. Plusieurs minutes de disque, rien n\'est restauré.',
      ok: 'vérifier',
    }))) return
    try {
      await apiPost('/sauvegardes/verifier', { niveau }, niveau === 'profond' ? await withConfirm('sauvegarde_verifier_profond') : undefined)
      toast(`vérification ${niveau} lancée`)
      etat.refresh()
    } catch (e) { toast(`vérification refusée : ${(e as Error).message}`, 'crit') }
  }

  async function regler(p: Partial<Reglages>) {
    try { await apiPut('/sauvegardes/reglages', p); etat.refresh() } catch { toast('réglage refusé', 'crit') }
  }

  if (!t) return <>{TITRE}{etat.error ? <Chip tone="crit">API injoignable : {etat.error}</Chip> : <Loader label="lecture des sauvegardes" />}</>
  const toutes = lignes(t)
  const par = (s: 'timeshift' | 'borg') => toutes.filter((x) => x.source === s)
  const r = t.reglages
  return (
    <>
      {TITRE}
      {t.alertes.length > 0 && (
        <div className="sv-alertes" role="alert">
          {t.alertes.map((a) => <div key={a.key} className={`sv-alerte ${a.level}`}><b>{a.title}</b>{a.detail}</div>)}
        </div>
      )}
      <div className="sv-grid">
        <Resume titre="timeshift" lite="snapshots système, /backups/fast" age={t.timeshift.age_jours} limiteJours={r.timeshift_max_h / 24}
          total={t.timeshift.total} taille={t.timeshift.liste[0]?.taille ?? null} tendanceTaille={t.timeshift.taille_tendance}
          points={[...t.timeshift.liste].reverse().map((s) => s.taille)} duree={t.timeshift.duree} espace={t.timeshift.espace}
          planif={t.timeshift.planification} croissanceJour={croissanceJour(par('timeshift'))} occupe={occupe} onLancer={() => void lancer('timeshift')} />
        <Resume titre="borg" lite="archives chiffrées, /mnt/backup_cold" age={t.borg.age_jours} limiteJours={r.borg_max_j}
          total={t.borg.total} taille={t.borg.liste[0]?.original ?? null} tendanceTaille={t.borg.taille_tendance}
          points={[...t.borg.liste].reverse().map((a) => a.original)} duree={t.borg.duree} espace={t.borg.espace}
          planif={t.borg.planification} croissanceJour={croissanceJour(par('borg'))} occupe={occupe} onLancer={() => void lancer('borg')}
          lignesEnPlus={[
            ['nouveau par archive', t.borg.liste[0]?.nouveau != null ? `${(t.borg.liste[0].nouveau / 1e9).toFixed(2)} Go` : '-'],
            ['dépôt dédupliqué', t.borg.depot?.depot_dedup != null ? `${(t.borg.depot.depot_dedup / 1e9).toFixed(0)} Go` : '-'],
          ]} />
      </div>
      <Verification t={t} occupe={occupe} onVerifier={(n) => void verifier(n)} />
      <Historique toutes={toutes} filtres={filtres} onChange={changerFiltres} maintenantS={t.maintenant} />
      <Seuils reglages={r} onChange={(p) => void regler(p)} />
    </>
  )
}
