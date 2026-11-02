import { useEffect, useRef } from 'react'
import { apiGet } from '../../lib/api'
import { toast } from '../../lib/dialog'
import { aAnnoncer, compteARebours, plusProche, restantMaintenant, type Etat } from '../../lib/minuteurs'
import { usePoll } from '../../lib/poll'
import { useTick } from './useTick'
import './minuteurs.css'

function notifierNavigateur(titre: string, corps: string) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') new Notification(titre, { body: corps, icon: `${import.meta.env.BASE_URL}icon-512.png` })
  else if (Notification.permission === 'default') void Notification.requestPermission()
}

/**
 * À monter UNE fois dans la barre du haut (ou l'accueil) : relève les minuteurs, annonce les évènements
 * neufs (toast + notification du navigateur selon le réglage du minuteur) et montre le compte à rebours
 * du plus proche. Touche = ouvre l'écran minuteurs. Rend null s'il n'y a rien à montrer.
 */
export function MinuteursPuce({ onOpen }: { onOpen: () => void }) {
  const etat = usePoll<Etat>(() => apiGet('/minuteurs'), 5000)
  const releve = useRef(Date.now())
  const dernierVu = useRef<number | null>(null)
  const now = useTick(500)

  useEffect(() => {
    const d = etat.data
    if (!d) return
    releve.current = Date.now()
    for (const e of aAnnoncer(d.evenements, dernierVu.current)) {
      toast(e.message)
      if (e.notif.navigateur && !e.rattrape) notifierNavigateur('minuteur', e.message)
    }
    dernierVu.current = d.seq
  }, [etat.data])

  const t = etat.data ? plusProche(etat.data.minuteurs) : null
  const sonne = Boolean(etat.data?.sonnerie_en_cours)
  if (!t && !sonne) return null
  return (
    <button className={`chip mn-puce ${sonne ? 'ring' : 'gold'}`} onClick={onOpen} title={t ? t.nom : 'minuteur terminé'}>
      {t ? `${t.nom} ${compteARebours(restantMaintenant(t, releve.current, now))}` : 'minuteur terminé'}
    </button>
  )
}
