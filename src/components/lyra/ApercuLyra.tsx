import { useState } from 'react'
import { Chip } from '../ui'
import { quand, type Apercu } from '../../lib/lyraMemoire'

/** « Ce que lyra sait » : un coup d'oeil avant de la questionner. Un clic sur un theme filtre la liste. */
export function ApercuLyra({ apercu, theme, onTheme }: {
  apercu: Apercu | null; theme: string; onTheme: (id: string) => void
}) {
  const [ouvert, setOuvert] = useState(() => {
    try { return localStorage.getItem('neutroncore_lm_apercu') !== '0' } catch { return true }
  })
  function bascule() {
    setOuvert(!ouvert)
    try { localStorage.setItem('neutroncore_lm_apercu', ouvert ? '0' : '1') } catch { /* stockage indisponible */ }
  }
  if (!apercu) return null
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <button className="lm-sect" style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
        onClick={bascule} aria-expanded={ouvert}>
        <b>ce que lyra sait</b>{' '}
        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
          {apercu.total} souvenirs : {apercu.demandes} demandes, {apercu.apprentissages} apprises, {apercu.mots} mots
          {apercu.derniere ? ` - dernier ${quand(apercu.derniere)}` : ''}
        </span>
        <span style={{ float: 'right', color: 'var(--faint)', fontSize: 11 }}>{ouvert ? 'replier' : 'déplier'}</span>
      </button>
      {ouvert && (
        <div className="lm-know">
          {apercu.themes.map((t) => (
            <button key={t.id} className="th" onClick={() => onTheme(theme === t.id ? '' : t.id)}
              style={theme === t.id ? { borderColor: 'var(--gold)' } : undefined}>
              <b>{t.libelle}</b> <Chip>{t.n}</Chip>
              <small>{t.exemples.join(' / ') || '-'}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
