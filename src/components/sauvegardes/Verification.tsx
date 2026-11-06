import { fmtAge, fmtDuree, type Tableau } from '../../lib/sauvegardes'
import { Btn, Card, Chip } from '../ui'

// Restauration SIMULÉE : borg check / extract --dry-run, jamais de restauration réelle.
export function Verification({ t, occupe, onVerifier }: { t: Tableau; occupe: boolean; onVerifier: (n: 'rapide' | 'profond') => void }) {
  const v = t.verification
  const actif = t.travail.actif
  const dernier = t.travail.dernier
  return (
    <Card title="test de restauration simulé" lite={v.derniere ? `dernier : ${fmtAge(v.age_jours)}` : 'jamais lancé'} style={{ marginBottom: 14 }}>
      <p className="au-note">Rien n'est restauré : le dépôt borg est contrôlé et la dernière archive est « extraite à blanc » (borg check puis extract --dry-run). Le niveau rapide vérifie l'accès au dépôt et le nombre d'archives ; le niveau profond relit toutes les données et prend plusieurs minutes.</p>
      <div className="sv-actions">
        <Btn sm disabled={occupe} onClick={() => onVerifier('rapide')}>vérifier (rapide)</Btn>
        <Btn sm disabled={occupe} onClick={() => onVerifier('profond')}>vérifier (profond)</Btn>
        {actif && <span className="sv-busy"><i className="tourne" />{actif.libelle}...</span>}
      </div>
      {dernier && !actif && (
        <div className="sv-verif" style={{ marginTop: 10 }}>
          <Chip tone={dernier.ok ? 'ok' : 'crit'}>{dernier.ok ? 'réussi' : 'en échec'}</Chip>
          <span>{dernier.libelle}, {fmtDuree(dernier.fin - dernier.debut)}</span>
          {dernier.erreur && <span>{dernier.erreur}</span>}
        </div>
      )}
      {dernier && !actif && dernier.extrait && <pre className="sv-trace">{dernier.extrait}</pre>}
      {v.historique.length > 0 && (
        <div className="sv-verifs">
          {v.historique.map((x) => (
            <div key={x.ts} className="sv-verif">
              <Chip tone={x.ok ? 'ok' : 'crit'}>{x.ok ? 'ok' : 'échec'}</Chip>
              <span>{new Date(x.ts * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span>{x.niveau}, {fmtDuree(x.duree_s)}, {x.controles.length} contrôle{x.controles.length > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
