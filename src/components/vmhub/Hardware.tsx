import { useEffect, useState } from 'react'
import { confirmDialog, toast } from '../../lib/dialog'
import { BOOT_DEVICES, BOOT_LABEL, CPU_MODEL_IDS, DEFAULT_GROW, DISPLAYS, FIRMWARES, HARDWARE_NEEDS_STOP, choiceHint, choiceLabel, describePayload, diffHardware, draftFromHardware, knownCpu, moveBoot, optionIds, stopFields, summarizeEdit, summarizeJob, toggleBoot, totalCapacity, validateHardware, type Choice, type Display, type EditSummary, type Firmware, type HardwareDraft, type HardwareField, type HardwarePayload } from '../../lib/vmHardware'
import { CPU_MODELS, LEVEL } from '../../lib/vmHelp'
import { editHardware } from '../../lib/vmHubApi'
import type { SettingsInfo } from '../../lib/vmsConsole'
import type { TaskJob } from '../../lib/vmTasks'
import { Btn, Card, Chip } from '../ui'
import { Q } from './Help'

const pips = (n: number) => <span aria-label={LEVEL[n]} title={LEVEL[n]} style={{ display: 'inline-flex', gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ width: 14, height: 6, borderRadius: 2, background: i <= n ? 'var(--vh-l1)' : 'var(--raise)' }} />)}</span>

/** Pastille « machine arrêtée requise », posee sur chaque champ de `needs_stop`. */
function NeedStop() {
  return <span className="vh-tag vh-need">machine arrêtée requise<Q k="needs-stop" /></span>
}

/** Segment de choix : `id` envoye, `label` affiche (les listes de l'API sont des entrees libellees). */
function Seg<T extends string>({ value, options, labels, onChange, disabled, label }: { value: T; options: readonly T[]; labels?: Choice[]; onChange: (v: T) => void; disabled?: boolean; label: string }) {
  return (
    <div className="vh-seg" role="radiogroup" aria-label={label} style={{ marginTop: 0 }}>
      {options.map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} data-id={o} className={value === o ? 'on' : ''} disabled={disabled} title={choiceHint(labels, o) || undefined} onClick={() => onChange(o)}>{choiceLabel(labels, o)}</button>)}
    </div>
  )
}

type Sent = { job: string; payload: HardwarePayload; later: boolean }
type ResultState = { done: EditSummary | null; sent: Sent | null; setDone: (s: EditSummary | null) => void; setSent: (s: Sent | null) => void }

/** Onglet matériel : état réel, puis formulaire des 14 champs du contrat. Un seul « appliquer » n'envoie
 *  que les champs modifiés ; la réponse (`changes`, `needs_restart`) est affichée telle quelle.
 *  Le résultat (`done`) et le travail attendu (`sent`) vivent ICI : le formulaire est remonté quand l'état
 *  réel est relu (~1,5 s après l'application), le résultat ne doit pas disparaître avec lui. */
export function Hardware({ vm, state, info, template, jobs, onApplied, busyVm }: {
  vm: string; state: string; info: SettingsInfo | null; template: boolean; jobs?: TaskJob[]; onApplied: () => void; busyVm: boolean
}) {
  const hw = info?.hardware ?? null
  const key = `${vm}|${hw ? JSON.stringify(hw) : 'none'}`   // seul le BROUILLON repart des vraies valeurs quand elles changent
  const [done, setDone] = useState<EditSummary | null>(null)
  const [sent, setSent] = useState<Sent | null>(null)
  // le resultat de l'outil (changes, needs_restart, hot, skipped) n'arrive que dans le travail, une fois fini
  useEffect(() => {
    if (!sent) return
    const s = summarizeJob((jobs ?? []).find((j) => j.id === sent.job), sent.payload, sent.later)
    if (s) { setDone(s); setSent(null) }
  }, [jobs, sent])
  if (template) return <Card title="matériel"><p className="lite" style={{ margin: 0 }}>Un modèle est figé : redeviens machine pour changer son matériel, puis reconvertis-le.</p><CpuGuide /></Card>
  if (!info) return <Card title="matériel"><p className="lite" style={{ margin: 0 }}>lecture des réglages…</p></Card>
  if (!hw) {
    return (
      <Card title="matériel">
        <Chip tone="warn">{info.hardware_error ? `matériel illisible : ${info.hardware_error}` : 'l\'API ne décrit pas encore le matériel de cette machine'}</Chip>
        <CpuGuide />
      </Card>
    )
  }
  return <HardwareForm key={key} vm={vm} state={state} info={info} result={{ done, sent, setDone, setSent }} onApplied={onApplied} busyVm={busyVm} />
}

/** Guide + choix du modele de processeur. `id` hors liste ou absent (modele resolu d'une VM en marche, ex. EPYC-Milan) :
 *  aucun segment actif, le modele actuel est dit « hors liste ». Sans `onPick`, guide seul (modele, materiel illisible). */
function CpuGuide({ id, current, choices, onPick, disabled }: { id?: string | null; current?: string | null; choices?: Choice[]; onPick?: (id: string) => void; disabled?: boolean } = {}) {
  const [local, setLocal] = useState(CPU_MODELS[0].id)
  const ids = optionIds(choices, CPU_MODEL_IDS)
  const cur = onPick ? knownCpu(id, ids) : local
  const m = cur ? CPU_MODELS.find((c) => c.id === cur) ?? null : null
  return (
    <div className="vh-box vh-cpu">
      <h3>modèle de processeur<Q k="cpu-model" />{onPick && <NeedStop />}</h3>
      {onPick && !cur && <p className="lite vh-cpu-cur" style={{ margin: '0 0 8px' }}>modèle actuel : <b className="mono">{current || 'non précisé'}</b> (hors liste) — choisis un modèle ci-dessous pour le remplacer.</p>}
      <Seg value={cur ?? ''} options={ids} labels={choices} onChange={(v) => (onPick ?? setLocal)(v)} disabled={disabled} label="modèle de processeur" />
      {m ? (
        <>
          <div style={{ display: 'grid', gap: 5, margin: '10px 0', fontSize: 12, color: 'var(--muted)' }}>
            <div className="vh-row" style={{ justifyContent: 'space-between' }}>performances {pips(m.speed)}</div>
            <div className="vh-row" style={{ justifyContent: 'space-between' }}>déplaçable (export) {pips(m.move)}</div>
            <div className="vh-row" style={{ justifyContent: 'space-between' }}>logiciels compatibles {pips(m.compat)}</div>
          </div>
          <p className="lite" style={{ margin: 0 }}>{m.text}</p>
        </>
      ) : cur ? <p className="lite" style={{ margin: '10px 0 0' }}>{choiceHint(choices, cur)}</p> : null}
    </div>
  )
}

function HardwareForm({ vm, state, info, result, onApplied, busyVm }: { vm: string; state: string; info: SettingsInfo; result: ResultState; onApplied: () => void; busyVm: boolean }) {
  const { done, sent, setDone, setSent } = result
  const hw = info.hardware!
  const initial = draftFromHardware(hw)
  const [d, setD] = useState<HardwareDraft>(initial)
  const [usbIn, setUsbIn] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const needsStop = info.needs_stop?.length ? info.needs_stop : HARDWARE_NEEDS_STOP
  const grow = info.limits?.disk_grow_gb ?? DEFAULT_GROW
  const up = state !== 'stopped'
  const locked = (f: HardwareField) => up && needsStop.includes(f)
  const set = (p: Partial<HardwareDraft>) => setD((x) => ({ ...x, ...p }))
  const payload = diffHardware(initial, d)
  const dirty = Object.keys(payload).length > 0
  const verdict = validateHardware(payload, state, { needsStop, grow, choices: info.choices })
  const firmwares = optionIds(info.choices?.firmware, FIRMWARES)
  const displays = optionIds(info.choices?.displays, DISPLAYS)
  const bootDevices = optionIds(info.choices?.boot_devices, BOOT_DEVICES)
  const later = stopFields(payload, needsStop).length > 0
  const cap = totalCapacity(hw.disks)
  const bootRows = [...d.boot_order, ...bootDevices.filter((b) => !d.boot_order.includes(b))]
  const bootLabel = (b: string) => choiceLabel(info.choices?.boot_devices, b, BOOT_LABEL)

  async function apply() {
    if (!verdict.ok) return
    const ok = await confirmDialog({ title: `modifier le matériel de ${vm} ?`, body: describePayload(payload).join(' · ') + (later ? ' (effectif au prochain démarrage)' : ''), ok: 'appliquer' })
    if (!ok) return
    setBusy(true); setErr('')
    try {
      const res = await editHardware(vm, payload)
      const s = summarizeEdit(res, payload, later)
      setDone(s)
      setSent(!s.fromTool && res?.job ? { job: String(res.job), payload, later } : null)
      toast(s.needsRestart ? `${vm} : modifié, effectif au prochain démarrage` : `${vm} : matériel modifié`)
      onApplied()
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  return (
    <Card title="matériel" lite={up ? 'machine en marche : seuls les réglages à chaud sont ouverts' : 'machine arrêtée : tout est modifiable'}>
      <dl className="vh-kv vh-hwnow">
        <dt>processeur</dt><dd>{hw.cpu_model ?? 'non précisé'}</dd>
        <dt>firmware</dt><dd>{hw.firmware}{hw.secure_boot ? ' · secure boot' : ''}{hw.tpm ? ' · tpm' : ''}</dd>
        <dt>démarrage</dt><dd>{hw.boot_order.map(bootLabel).join(' → ') || '-'}</dd>
        <dt>affichage</dt><dd>{choiceLabel(info.choices?.displays, hw.display)}</dd><dt>réseau</dt><dd>{hw.network ?? '-'}</dd>
        <dt>disques</dt><dd>{hw.disks.length ? hw.disks.map((x) => `${x.target} ${x.capacity_gb != null ? `${x.capacity_gb} Go` : '?'}`).join(', ') : '-'}</dd>
        <dt>usb</dt><dd>{hw.usb.length ? hw.usb.join(', ') : 'aucun'}</dd>
      </dl>

      <div className="vh-hw">
        <CpuGuide id={d.cpu_model} current={hw.cpu_model} choices={info.choices?.cpu_models} onPick={(v) => set({ cpu_model: v })} disabled={locked('cpu_model')} />

        <div className="vh-box">
          <h3>firmware<Q k="hw-fw" />{needsStop.includes('firmware') && <NeedStop />}</h3>
          <Seg value={d.firmware} options={firmwares} labels={info.choices?.firmware} onChange={(v) => set({ firmware: v as Firmware, secure_boot: v === 'uefi' ? d.secure_boot : false })} disabled={locked('firmware')} label="firmware" />
          <p className="lite" style={{ margin: '8px 0 10px' }}>{choiceHint(info.choices?.firmware, d.firmware)}</p>
          <label className="vh-chk"><input type="checkbox" checked={d.tpm} disabled={locked('tpm')} onChange={(e) => set({ tpm: e.target.checked })} /> TPM 2.0<Q k="hw-tpm" />{needsStop.includes('tpm') && <NeedStop />}</label>
          <label className="vh-chk" style={d.firmware !== 'uefi' ? { opacity: 0.6 } : undefined}>
            <input type="checkbox" checked={d.secure_boot} disabled={locked('secure_boot') || d.firmware !== 'uefi'} onChange={(e) => set({ secure_boot: e.target.checked })} /> secure boot<Q k="hw-sb" />{needsStop.includes('secure_boot') && <NeedStop />}
          </label>
          {d.firmware !== 'uefi' && <p className="lite" style={{ margin: 0 }}>le secure boot demande le firmware uefi : choisis uefi d'abord.</p>}
        </div>

        <div className="vh-box">
          <h3>ordre de démarrage<Q k="hw-boot" /></h3>
          <ol className="vh-boot" aria-label="ordre de démarrage">
            {bootRows.map((b) => {
              const i = d.boot_order.indexOf(b)
              const on = i >= 0
              return (
                <li key={b} className={on ? 'on' : ''}>
                  <label className="vh-chk" style={{ margin: 0 }}><input type="checkbox" checked={on} disabled={locked('boot_order')} onChange={() => set({ boot_order: toggleBoot(d.boot_order, b) })} /> {on ? `${i + 1}. ` : ''}{bootLabel(b)}</label>
                  {on && <span className="vh-row" style={{ gap: 2 }}>
                    <button type="button" className="btn sm" aria-label={`monter ${bootLabel(b)}`} disabled={i === 0 || locked('boot_order')} onClick={() => set({ boot_order: moveBoot(d.boot_order, i, -1) })}>↑</button>
                    <button type="button" className="btn sm" aria-label={`descendre ${bootLabel(b)}`} disabled={i === d.boot_order.length - 1 || locked('boot_order')} onClick={() => set({ boot_order: moveBoot(d.boot_order, i, 1) })}>↓</button>
                  </span>}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="vh-box">
          <h3>affichage et réseau</h3>
          <div className="vh-row" style={{ gap: 10 }}><span className="vh-lab">console<Q k="hw-display" /></span><Seg value={d.display} options={displays} labels={info.choices?.displays} onChange={(v) => set({ display: v as Display })} disabled={locked('display')} label="affichage" /></div>
          {choiceHint(info.choices?.displays, d.display) && <p className="lite" style={{ margin: '6px 0 0' }}>{choiceHint(info.choices?.displays, d.display)}</p>}
          <label className="vh-field" style={{ marginTop: 10 }}><span>réseau<Q k="hw-net" /></span><input value={d.network} disabled={locked('network')} onChange={(e) => set({ network: e.target.value })} placeholder={hw.network ?? 'default'} aria-label="réseau" /></label>
        </div>

        <div className="vh-box">
          <h3>périphériques usb<Q k="hw-usb" /></h3>
          {hw.usb.length === 0 && !d.usb_attach && <p className="lite" style={{ margin: '0 0 8px' }}>aucun périphérique de l'hôte n'est donné à cette machine.</p>}
          {hw.usb.map((u) => (
            <div key={u} className="vh-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="mono">{u}{d.usb_detach === u ? <span className="vh-tag" style={{ marginLeft: 6, color: 'var(--rose)' }}>à débrancher</span> : null}</span>
              <Btn sm disabled={locked('usb_detach')} onClick={() => set({ usb_detach: d.usb_detach === u ? '' : u })}>{d.usb_detach === u ? 'garder' : 'débrancher'}</Btn>
            </div>
          ))}
          {d.usb_attach && <div className="vh-row" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span className="mono">{d.usb_attach}<span className="vh-tag ok" style={{ marginLeft: 6 }}>à brancher</span></span><Btn sm onClick={() => set({ usb_attach: '' })}>retirer</Btn></div>}
          <div className="vh-row">
            <input value={usbIn} disabled={locked('usb_attach')} onChange={(e) => setUsbIn(e.target.value)} placeholder="vvvv:pppp (lsusb)" aria-label="identifiant usb" style={{ width: 150 }} />
            <Btn sm disabled={!usbIn.trim() || locked('usb_attach')} onClick={() => { set({ usb_attach: usbIn.trim().toLowerCase() }); setUsbIn('') }}>brancher</Btn>
          </div>
        </div>

        <div className="vh-box">
          <h3>agrandir le disque<Q k="hw-grow" />{needsStop.includes('disk_grow_gb') && <NeedStop />}</h3>
          <p className="lite" style={{ margin: '0 0 8px' }}>taille actuelle : {cap != null ? `${cap} Go` : 'inconnue'}. On agrandit, jamais on ne réduit.</p>
          <div className="vh-row"><span>+</span><input inputMode="numeric" value={d.disk_grow_gb} disabled={locked('disk_grow_gb')} onChange={(e) => set({ disk_grow_gb: e.target.value })} aria-label="agrandissement en Go" style={{ width: 90 }} /><span>Go</span>
            {cap != null && /^\d+$/.test(d.disk_grow_gb) && <span className="lite">→ {cap + Number(d.disk_grow_gb)} Go</span>}</div>
        </div>
      </div>

      <div className="vh-row" style={{ marginTop: 12 }}>
        <Btn sm solid disabled={!dirty || !verdict.ok || busy || busyVm} onClick={apply}>{busy ? 'application…' : 'appliquer'}</Btn>
        <Btn sm disabled={!dirty || busy} onClick={() => setD(initial)}>annuler</Btn>
        {dirty && !verdict.ok && <Chip tone="warn">{verdict.reason}</Chip>}
        {dirty && verdict.ok && <span className="lite">{describePayload(payload).join(' · ')}{later ? ' — effectif au prochain démarrage' : ''}</span>}
      </div>
      {err && <p className="vm-err">{err}</p>}
      {done && (
        <div className="vh-hwres" role="status">
          <div className="vh-row" style={{ justifyContent: 'space-between' }}>
            <b>{done.fromTool ? 'modifié (résultat de l\'outil) :' : sent ? 'demandé (le détail arrivera avec la tâche) :' : 'demandé :'}</b>
            <button type="button" className="btn sm" aria-label="fermer le résumé" onClick={() => { setDone(null); setSent(null) }}>fermer</button>
          </div>
          <ul>{done.changes.map((c) => <li key={c}>{c}</li>)}</ul>
          {done.needsRestart && <p className="lite" style={{ margin: 0 }}>effectif au prochain démarrage.</p>}
          {done.hot.length > 0 && <p className="lite" style={{ margin: 0 }}>appliqué à chaud : {done.hot.join(', ')}.</p>}
          {done.skipped.length > 0 && <p className="lite" style={{ margin: 0, color: 'var(--warn)' }}>ignoré : {done.skipped.join(', ')}.</p>}
        </div>
      )}
    </Card>
  )
}
