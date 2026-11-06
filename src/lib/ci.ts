// « La CI a échoué » : la notification propose d'ouvrir une session Claude Code dans le dépôt,
// avec une consigne fixe (lire le journal de l'échec, expliquer, proposer un correctif, ne rien pousser).
import { apiPost, withConfirm } from './api'
import { confirmDialog, toast } from './dialog'
import type { Notif } from './notifs'

export async function inspecterCi(n: Pick<Notif, 'title' | 'ref'>): Promise<void> {
  const depot = n.ref.split('|')[0] || 'le dépôt'
  const ok = await confirmDialog({
    title: 'ouvrir une session pour inspecter ?',
    body: `${n.title}\n\nUne session Claude Code s’ouvre dans ${depot} (sur sa propre branche si le projet est suivi). Elle lit le journal de l’échec, explique la cause et propose un correctif. Elle ne pousse rien sans ton accord.`,
    ok: 'ouvrir la session',
  })
  if (!ok) return
  try {
    const r = await apiPost<{ note?: string; branche?: string }>('/automations/ci/inspecter', { ref: n.ref }, await withConfirm('ci_inspecter'))
    toast(r.note || (r.branche ? `session ouverte sur la branche ${r.branche}` : 'session ouverte'))
  } catch (e) { toast(`ouverture impossible : ${e instanceof Error ? e.message : String(e)}`, 'warn') }
}
