import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { nomCanaux, problemesTest, progressionTest, titreTest, type EtatTest } from '../../lib/spatialOutils'
import { Bar, Btn, Chip } from '../ui'
import './lumiere-outils.css'

const REPOS: EtatTest = { etat: 'repos', total: 0, fait: 0, courant: null, rapport: [], resume: '', erreur: null }
type Reponse = { success: boolean; error?: string; huebeat?: boolean }

/** Test des lampes en un clic : chaque canal s'allume seul, doucement, puis est remis comme avant ; rapport par canal.
 * `huebeatJoue` (facultatif) : désactive le bouton et dit pourquoi ; l'API refuse de toute façon si huebeat tourne. */
export function TestLampes({ huebeatJoue = false }: { huebeatJoue?: boolean }) {
  const [e, setE] = useState<EtatTest>(REPOS)
  const [occupe, setOccupe] = useState(false)
  const vivant = useRef(true)

  async function lire() {
    try { const r = await apiGet<EtatTest>('/spatial/outils/test'); if (vivant.current) setE(r) } catch { /* l'écran réessaie au tour suivant */ }
  }
  useEffect(() => { vivant.current = true; void lire(); return () => { vivant.current = false } }, [])
  // on relit chaque seconde tant que le test tourne (et seulement alors)
  useEffect(() => {
    if (e.etat !== 'en_cours') return
    const t = setInterval(() => { if (!document.hidden) void lire() }, 1000)
    return () => clearInterval(t)
  }, [e.etat])

  async function lancer() {
    setOccupe(true)
    try {
      const r = await apiPost<Reponse>('/spatial/outils/test/lancer')
      if (!r.success) { toast(r.error ?? 'le test ne démarre pas', 'crit'); return }
      await lire()
    } catch (err) { toast(`échec : ${(err as Error).message}`, 'crit') } finally { setOccupe(false) }
  }
  async function arreter() {
    setOccupe(true)
    try { await apiPost('/spatial/outils/test/arreter'); await lire() }
    catch (err) { toast(`échec : ${(err as Error).message}`, 'crit') } finally { setOccupe(false) }
  }

  const enCours = e.etat === 'en_cours'
  const problemes = problemesTest(e.rapport)
  return (
    <div className="lu-outil">
      <p className="lite">Chaque lampe s’allume doucement, l’une après l’autre, puis revient comme avant. Compte une dizaine de secondes pour sept lampes.</p>
      <div className="lu-outil-barre">
        {enCours
          ? <Btn danger disabled={occupe} onClick={arreter}>arrêter (remet la lampe en cours)</Btn>
          : <Btn solid disabled={occupe || huebeatJoue} onClick={lancer}>tester les lampes</Btn>}
        {huebeatJoue && !enCours && <Chip tone="warn">arrête d’abord la lumière en direct</Chip>}
      </div>
      {e.etat !== 'repos' && (
        <div role="status" aria-live="polite">
          <p className={`lu-outil-phrase ${e.etat === 'erreur' ? 'crit' : ''}`}>{titreTest(e)}</p>
          {enCours && <Bar pct={progressionTest(e)} />}
        </div>
      )}
      {e.rapport.length > 0 && (
        <ul className="lu-outil-liste lu-test">
          {e.rapport.map((l) => (
            <li key={l.id} className={l.etat === 'repond' ? 'ok' : 'ko'}>
              <span className="lu-test-etat">{l.etat === 'repond' ? 'répond' : 'ne répond pas'}</span>
              <b>{l.nom}</b>{l.canaux.length > 0 && <span className="lite"> — {nomCanaux(l.canaux)}</span>}
              {l.raison && <span className="lite"> — {l.raison}</span>}
              {l.restauree === false && <Chip tone="crit">non remise comme avant : à vérifier</Chip>}
            </li>
          ))}
        </ul>
      )}
      {problemes.length > 0 && !enCours && <p className="lite">Une lampe qui ne répond pas est souvent éteinte au secteur, hors de portée du pont, ou retirée de la zone de lumière.</p>}
    </div>
  )
}
