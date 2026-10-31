import { previewStyle, type CustomTheme } from '../../lib/themes'
import './editeurThemes.css'

// Apercu en direct : un conteneur qui porte les tokens en variables CSS en ligne.
// Il n'agit pas sur la page (aucun data-theme n'est modifie pendant l'edition).
export function ThemePreview({ theme }: { theme: Pick<CustomTheme, 'tokens' | 'dark'> }) {
  return (
    <div className="th-preview" style={previewStyle(theme) as React.CSSProperties} aria-label="apercu du theme">
      <div className="th-pv-top"><b>neutroncore</b><span className="chip">accueil</span></div>
      <div className="th-pv-row">
        <div className="card th-pv-card">
          <div className="eyebrow">telechargements</div>
          <div className="th-pv-big">12,4 Mo/s</div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>debit actuel</div>
          <div style={{ color: 'var(--faint)', fontSize: 11 }}>indice : mis a jour a l'instant</div>
        </div>
        <div className="card th-pv-card" style={{ background: 'var(--surface2)' }}>
          <div className="eyebrow">etats</div>
          <div className="th-pv-states">
            <span style={{ color: 'var(--ok)' }}>ok</span>
            <span style={{ color: 'var(--warn)' }}>attention</span>
            <span style={{ color: 'var(--crit)' }}>critique</span>
            <span style={{ color: 'var(--off)' }}>eteint</span>
          </div>
          <div className="th-pv-bar"><i /></div>
        </div>
      </div>
      <div className="th-pv-row">
        <button className="btn solid" style={dark(theme.dark)}>action</button>
        <button className="btn">secondaire</button>
        <span className="chip" style={{ color: 'var(--rose)', background: 'var(--rose-soft)' }}>accent 2</span>
        <span style={{ color: 'var(--gold)' }}>lien accent</span>
      </div>
    </div>
  )
}

// styles.css donne au bouton plein un texte sombre ; sur un theme clair, les themes
// integres le repassent en blanc (voir themeCss). L'apercu reproduit le meme choix.
const dark = (isDark: boolean): React.CSSProperties =>
  isDark ? {} : { color: '#fff', background: 'linear-gradient(100deg,var(--gold),var(--rose))' }
