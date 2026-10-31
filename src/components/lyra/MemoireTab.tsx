import { useState } from 'react'
import { apiDelete, apiPost, apiPut, withConfirm } from '../../lib/api'
import { confirmDialog, toast } from '../../lib/dialog'
import {
  ecrireStocke, etatEdition, grouperParSection, grouperParTheme, lireStocke, messageApplication, requete,
  type Apercu, type Application, type MemoireResp, type Souvenir,
} from '../../lib/lyraMemoire'
import { useLyraData, useRetard } from '../../lib/useLyraData'
import { Btn, Chip, Loader } from '../ui'
import { AjoutMot } from './AjoutMot'
import { ApercuLyra } from './ApercuLyra'
import { Corbeille } from './Corbeille'
import { MemoireRow } from './MemoireRow'

const CLE = 'neutroncore_lm_memoire'
type Reglage = { theme: string; replies: string[] }

/** Onglet « memoire » : recherche en haut, themes, edition sur place, corbeille. */
export function MemoireTab() {
  const [reglage, setReglage] = useState<Reglage>(() => lireStocke<Reglage>(CLE, { theme: '', replies: [] }))
  const [q, setQ] = useState('')
  const [corbeille, setCorbeille] = useState(false)
  const [annuler, setAnnuler] = useState<Souvenir | null>(null)
  const qd = useRetard(q)
  const liste = useLyraData<MemoireResp>(`/lyra/memoire${requete({ q: qd, theme: reglage.theme, limite: 400 })}`)
  const apercu = useLyraData<Apercu>('/lyra/memoire/apercu')

  const regler = (r: Partial<Reglage>) => { const n = { ...reglage, ...r }; setReglage(n); ecrireStocke(CLE, n) }
  const tout = () => { liste.recharger(); apercu.recharger() }
  const base = (id: string) => `/lyra/memoire/${encodeURIComponent(id)}`
  async function agir(f: () => Promise<unknown>) {
    try { await f(); tout() } catch (e) { toast((e as Error).message, 'crit') }
  }
  async function corriger(it: Souvenir, texte: string) {
    await agir(async () => {
      const m = messageApplication('corrigé', await apiPut<Application>(base(it.id), { texte }))
      toast(m.texte, m.ton)
    })
  }
  async function supprimer(it: Souvenir) {
    if (liste.data?.edition_reelle) {
      // la vraie memoire de lyra : definitif, donc confirmation + jeton, et pas de corbeille
      const ok = await confirmDialog({
        title: 'supprimer pour de bon ?',
        body: `« ${it.texte.slice(0, 80)} » sera oublié par lyra. Impossible de revenir en arrière.`,
        ok: 'supprimer', danger: true,
      })
      if (!ok) return
      await agir(async () => {
        const m = messageApplication('supprimé', await apiDelete<Application>(`${base(it.id)}/definitif`, await withConfirm('lyra_memoire_supprimer')))
        toast(m.texte, m.ton)
      })
      return
    }
    await agir(() => apiDelete(base(it.id)))
    setAnnuler(it)
    setTimeout(() => setAnnuler((c) => (c?.id === it.id ? null : c)), 10_000)
  }

  const d = liste.data
  if (!d) return liste.erreur ? <div className="lm-empty">lyra est injoignable : {liste.erreur}</div> : <Loader label="lecture de la mémoire" />
  const groupes = grouperParTheme(d.items, d.themes)
  const etat = etatEdition(d.edition_reelle)

  return (
    <div>
      <ApercuLyra apercu={apercu.data} theme={reglage.theme} onTheme={(theme) => regler({ theme })} />
      <div className="lm-bar">
        <input className="lm-search" type="search" placeholder="chercher dans ce que lyra a retenu..." value={q}
          aria-label="chercher" onChange={(e) => setQ(e.target.value)} />
        <Btn sm onClick={() => setCorbeille(!corbeille)}>{corbeille ? 'retour à la mémoire' : `corbeille (${d.corbeille})`}</Btn>
      </div>
      <div className="lm-bar"><AjoutMot onAjoute={tout} /></div>
      <p className="lm-note"><Chip tone={etat.ton}>{etat.libelle}</Chip> {d.note}</p>
      {corbeille ? <Corbeille onChange={tout} /> : (
        <>
          <div className="lm-chips" role="group" aria-label="thèmes">
            <span className={`chip ${reglage.theme === '' ? 'on' : ''}`} role="button" tabIndex={0}
              onClick={() => regler({ theme: '' })} onKeyDown={(e) => e.key === 'Enter' && regler({ theme: '' })}>tout</span>
            {d.themes.map((t) => (
              <span key={t.id} className={`chip ${reglage.theme === t.id ? 'on' : ''}`} role="button" tabIndex={0}
                onClick={() => regler({ theme: reglage.theme === t.id ? '' : t.id })}
                onKeyDown={(e) => e.key === 'Enter' && regler({ theme: reglage.theme === t.id ? '' : t.id })}>
                {t.libelle} ({t.n})
              </span>
            ))}
          </div>
          {annuler && (
            <div className="lm-undo" role="status">
              <span>« {annuler.texte.slice(0, 60)} » est dans la corbeille</span>
              <Btn sm solid onClick={() => { void agir(() => apiPost(`${base(annuler.id)}/restaurer`)); setAnnuler(null) }}>annuler</Btn>
            </div>
          )}
          {!groupes.length && <div className="lm-empty">{qd ? `rien ne ressemble à « ${qd} »` : 'lyra n’a encore rien retenu'}</div>}
          {groupes.map((g) => {
            const ferme = reglage.replies.includes(g.id) && !qd
            return (
              <section key={g.id} className={`lm-sect ${ferme ? 'shut' : ''}`}>
                <button className="hd" aria-expanded={!ferme}
                  onClick={() => regler({ replies: ferme ? reglage.replies.filter((x) => x !== g.id) : [...reglage.replies, g.id] })}>
                  <b>{g.libelle}</b> <Chip>{g.items.length}</Chip>
                </button>
                {!ferme && (g.id === 'vocabulaire' ? grouperParSection(g.items) : [{ section: '', items: g.items }]).map((s) => (
                  <div key={s.section}>
                    {s.section && <div className="lm-sub">{s.section}</div>}
                    {s.items.map((it) => (
                      <MemoireRow key={it.id} it={it}
                        onSave={(texte) => corriger(it, texte)}
                        onRevert={() => agir(() => apiDelete(`${base(it.id)}/correction`))}
                        onDelete={() => supprimer(it)} />
                    ))}
                  </div>
                ))}
              </section>
            )
          })}
          {d.n > d.items.length && <p className="lm-note">{d.n - d.items.length} autres : affine la recherche.</p>}
        </>
      )}
    </div>
  )
}
