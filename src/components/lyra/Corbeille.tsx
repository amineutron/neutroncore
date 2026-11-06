import { apiDelete, apiPost, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import { useLyraData } from '../../lib/useLyraData'
import { quand, type Supprime } from '../../lib/lyraMemoire'
import { Btn, Loader } from '../ui'

/** Corbeille : tout ce qui a ete supprime, avec « remettre ». Vider est definitif (jeton). */
export function Corbeille({ onChange }: { onChange: () => void }) {
  const { data, charge, recharger } = useLyraData<{ items: Supprime[] }>('/lyra/memoire/corbeille')

  async function remettre(id: string) {
    try { await apiPost(`/lyra/memoire/${encodeURIComponent(id)}/restaurer`); recharger(); onChange() }
    catch (e) { toast((e as Error).message, 'crit') }
  }
  async function vider() {
    const ok = await confirmDialog({
      title: 'vider la corbeille ?', body: 'ces souvenirs ne pourront plus être remis. lyra, elle, ne les a pas oubliés.',
      ok: 'vider', danger: true,
    })
    if (!ok) return
    try {
      await apiDelete('/lyra/memoire/corbeille', await withConfirm('lyra_memoire_vider'))
      recharger(); onChange()
    } catch (e) { toast((e as Error).message, 'crit') }
  }

  if (!data) return <Loader label="ouverture de la corbeille" />
  return (
    <div>
      <div className="lm-bar">
        <span style={{ flex: 1, color: 'var(--muted)', fontSize: 13 }}>
          {data.items.length ? `${data.items.length} supprimé(s) - tu peux les remettre` : 'la corbeille est vide'}
        </span>
        {data.items.length > 0 && <Btn sm danger onClick={vider}>vider la corbeille</Btn>}
      </div>
      {charge && !data.items.length ? null : data.items.map((it) => (
        <div className="lm-row" key={it.id}>
          <div className="tx">
            <div className="main" style={{ cursor: 'default' }}>{it.texte}</div>
            {it.detail && <div className="sub">{it.detail}</div>}
            <div className="sub">supprimé {quand(it.supprime_le)}</div>
          </div>
          <div className="act" style={{ opacity: 1 }}><Btn sm solid onClick={() => remettre(it.id)}>remettre</Btn></div>
        </div>
      ))}
    </div>
  )
}
