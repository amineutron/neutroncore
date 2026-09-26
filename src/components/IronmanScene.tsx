// Tuile de la scène Iron Man. Ce n'est PAS une scène Hue fixe : elle lance une
// séquence Hue Beat (couleurs animées en rythme, en continu) ; la tuile le dit
// visuellement (couleurs, logo, badge) et en toutes lettres au survol.

export function ArcReactor({ size = 30 }: { size?: number }) {
  return (
    <svg className="arc-reactor" width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="6 3.2" />
      <circle cx="20" cy="20" r="8.5" fill="none" stroke="currentColor" strokeOpacity=".6" strokeWidth="1.2" />
      <path d="M20 13.5 L26 24 L14 24 Z" fill="currentColor" fillOpacity=".9" />
      <circle cx="20" cy="20" r="3" fill="#fff" />
    </svg>
  )
}

type Props = { active: boolean; launching: boolean; onLaunch: () => void }

export function IronmanScene({ active, launching, onLaunch }: Props) {
  return (
    <div
      className={`scene-sq ironman ${active ? 'on' : ''}`}
      onClick={onLaunch}
      title="Séquence Hue Beat : couleurs animées en rythme, en continu. Ce n'est pas une scène fixe ; on l'arrête depuis la carte huebeat."
    >
      <span className="beat-badge">hue beat</span>
      <div className="base">
        <ArcReactor />
        <b>iron man<span className="im-dot">.</span></b>
        <span className="lbl-state">{active ? (launching ? 'lancement' : 'en cours') : 'animée · rythme'}</span>
      </div>
      <div className="room-wrap">
        <p className="im-warn">
          <b>Animée</b> : les couleurs changent en rythme. Pas une scène fixe.
        </p>
      </div>
    </div>
  )
}
