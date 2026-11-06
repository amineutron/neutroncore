import { contrastChecks, type CustomTheme } from '../../lib/themes'
import './editeurThemes.css'

// Controle WCAG AA : un avertissement par couple en dessous du seuil, jamais bloquant.
export function ContrastPanel({ theme }: { theme: Pick<CustomTheme, 'tokens' | 'dark'> }) {
  const checks = contrastChecks(theme)
  const fails = checks.filter((c) => !c.pass)
  return (
    <div className="th-contrast">
      <div className={`th-verdict ${fails.length ? 'warn' : 'ok'}`} role="status">
        {fails.length === 0
          ? 'contraste : tous les couples respectent WCAG AA'
          : `contraste : ${fails.length} couple${fails.length > 1 ? 's' : ''} sous le seuil WCAG AA — lisibilite reduite`}
      </div>
      <table className="th-ct">
        <tbody>
          {checks.map((c) => (
            <tr key={c.label} className={c.pass ? '' : 'fail'}>
              <td><i className="th-sw" style={{ background: c.bg }}><b style={{ color: c.fg }}>Aa</b></i></td>
              <td>{c.label}</td>
              <td className="num">{c.ratio.toFixed(2)} : 1</td>
              <td className="num">min {c.min}</td>
              <td>{c.pass ? 'ok' : 'trop faible'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
