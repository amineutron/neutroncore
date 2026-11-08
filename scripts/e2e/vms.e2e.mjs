// E2E du hub des VMs, sur la demo (dist-demo) : un vrai Chrome, de vrais clics, aucun backend.
//   npm run build:demo && node scripts/e2e/vms.e2e.mjs
// Variables : E2E_OUT=<dossier> pour garder les captures, CHROME_BIN=<chemin de chrome>.
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launchChrome, serveStatic } from './cdp.mjs'

const DIST = resolve(process.env.E2E_DIST || 'dist-demo')
const OUT = process.env.E2E_OUT || ''
const BASE = '/neutroncore/'
if (!existsSync(join(DIST, 'index.html'))) { console.error(`${DIST} introuvable : lance « npm run build:demo » d'abord`); process.exit(2) }

const results = []
let failed = 0
async function step(name, fn) {
  const t0 = Date.now()
  try { const note = await fn(); results.push({ name, ok: true, ms: Date.now() - t0, note }) } catch (e) { failed++; results.push({ name, ok: false, ms: Date.now() - t0, note: e.message }) }
}
const assert = (c, msg) => { if (!c) throw new Error(msg) }
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg} : attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`)

const server = await serveStatic(DIST, BASE)
const b = await launchChrome({ width: 1440, height: 900 })
const shot = async (n) => { if (OUT) await b.shot(join(OUT, `${n}.png`)) }
const tab = (label) => b.clickText('.vh-tabs > button', label)

try {
  await b.init(`localStorage.setItem('neutroncore_settings', JSON.stringify({bootAnim:false, welcomeAnim:false, startScreen:'vms'}));localStorage.setItem('neutroncore_tour_v1','1');`)
  await b.goto(`http://127.0.0.1:${server.port}${BASE}?screen=vms`)

  await step('accueil : familles, pastilles de type et etat de l\'hote', async () => {
    await b.waitFor(`document.querySelectorAll('.vh-node').length >= 9`, { what: '9 machines' })
    eq(await b.count('.vh-kids.k-cow'), 2, 'groupes de clones lies (modele, exam)')
    assert((await b.count('.vh-kind.k-tpl')) >= 1 && (await b.count('.vh-kind.k-cow')) >= 3 && (await b.count('.vh-kind.k-copy')) >= 1, 'les quatre types sont visibles')
    await shot('01-accueil')
  })

  await step('aide : bulle ouverte, titre juste, fermee par Echap', async () => {
    const n = await b.count('.vh-q')
    assert(n >= 6, `pastilles ? presentes (${n})`)
    await b.click('.vh-q')
    await b.waitFor(`!!document.querySelector('.vh-pop')`)
    assert((await b.text('.vh-pop h4')).length > 3, 'titre de la bulle')
    await b.press('Escape')
    await b.waitFor(`!document.querySelector('.vh-pop')`)
    assert(await b.eval(`[...document.querySelectorAll('.vh-q')].every(e=>e.getAttribute('aria-label'))`), 'chaque ? a un libelle accessible')
  })

  await step('panneau ressources : deplie, 4 metriques, une ligne par machine', async () => {
    await b.clickText('.vh-fold button.t', 'répartition')
    await b.waitFor(`document.querySelector('.vh-foldw').classList.contains('open')`)
    await b.waitFor(`document.querySelectorAll('.vh-rrow').length >= 8`, { what: 'lignes de ressources' })
    const out = []
    for (const m of ['vcpu', 'disque', 'charge', 'mémoire']) {
      await b.clickText('.vh-foldw .vh-seg button', m)
      await b.waitFor(`document.querySelector('.vh-foldw .vh-seg button.on').textContent==='${m}'`)
      out.push(`${m}:${await b.text('.vh-foldw [data-rt]')}`)
    }
    assert(out.every((x) => /\d/.test(x)), `totaux numeriques : ${out}`)
    await shot('02-ressources')
    return out.join(' | ')
  })

  await step('provenance a trois niveaux (modele > copie > clone lie)', async () => {
    await b.clickText('.vh-node .nm', 'exam-etudiant-01')
    await b.waitFor(`document.querySelectorAll('.vh-prov .vh-pn').length === 3`, { what: '3 noeuds de provenance' })
    const nodes = await b.eval(`[...document.querySelectorAll('.vh-prov .vh-pn')].map(e=>e.textContent.trim())`)
    eq(nodes, ['tpl-fedora-43-base', 'fedora-exam-reseaux', 'exam-etudiant-01'], 'chaine')
    const rels = await b.eval(`[...document.querySelectorAll('.vh-prov .vh-pa em')].map(e=>e.textContent)`)
    eq(rels, ['copie intégrale', 'clone lié'], 'liens')
    assert(await b.eval(`document.querySelector('.vh-pa.copy').classList.contains('dash')`), 'copie = trait pointille')
    await shot('03-provenance')
  })

  await step('passage en modele : explication, disparition de « machines », arrivee dans « modeles »', async () => {
    await tab('machines')
    await b.clickText('.vh-trow', 'debian-sandbox')
    await b.clickText('.vh-dhead button', 'passer en modèle')
    await b.waitFor(`!!document.querySelector('.vh-dlg')`)
    const t = await b.text('.vh-dlg')
    assert(/quitte la liste « machines »/.test(t) && /onglet « modèles »/.test(t) && /Pourquoi elle disparaît/.test(t), 'explication complete')
    await shot('04-modele-dialogue')
    await b.clickText('.vh-dlg footer button', 'passer en modèle')
    await b.waitFor(`!document.querySelector('.vh-dlg')`)
    await b.waitFor(`!!document.querySelector('.vh-tabs button.pulse')`, { what: 'onglet modeles qui pulse' })
    await b.waitFor(`![...document.querySelectorAll('.vh-trow .tt')].some(e=>e.textContent==='debian-sandbox')`, { what: 'machine retiree de la liste' })
    await tab('modèles')
    await b.waitFor(`[...document.querySelectorAll('.vh-box b')].some(e=>e.textContent==='debian-sandbox')`)
    assert(await b.count('.vh-box.arrive') === 1, 'carte mise en avant')
    await shot('05-modeles')
  })

  await step('un modele ne se supprime pas tant que des clones lies en dependent', async () => {
    await b.eval(`[...document.querySelectorAll('.vh-box')].find(x=>x.textContent.includes('tpl-fedora-43-base')).querySelector('.vh-row:last-child button:last-child').click()`)
    await b.waitFor(`document.querySelector('.vh-dhead h2')?.textContent==='tpl-fedora-43-base'`)
    const label = await b.eval(`[...document.querySelectorAll('.vh-dhead button')].pop().textContent`)
    assert(/clone\(s\) lié\(s\)/.test(label), `bouton explique le refus : ${label}`)
    assert(await b.eval(`[...document.querySelectorAll('.vh-dhead button')].pop().disabled`), 'bouton desactive')
  })

  await step('arbre de snapshots : noeuds, branches, clavier, zoom', async () => {
    await tab('machines')
    await b.clickText('.vh-trow', 'fedora-exam-reseaux')
    await b.clickText('.vh-tabs button', 'snapshots')
    await b.waitFor(`document.querySelectorAll('.vh-gsvg .vh-nd').length === 11`, { what: '10 snapshots + maintenant' })
    const colors = await b.eval(`new Set([...document.querySelectorAll('.vh-gsvg .dotc')].filter(e=>e.getAttribute('fill')).map(e=>e.getAttribute('fill'))).size`)
    assert(colors >= 3, `trois branches au moins, couleurs : ${colors}`)
    await b.focus('.vh-gsvg')
    await b.press('ArrowLeft', 'ArrowLeft'); await b.press('ArrowLeft', 'ArrowLeft')
    const sel = await b.text('.vh-spanel h3')
    assert(sel !== 'état actuel', `un snapshot est selectionne (${sel})`)
    const before = await b.eval(`document.querySelector('.vh-gsvg g').getAttribute('transform')`)
    await b.eval(`document.querySelector('.vh-gsvg').dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:300,clientY:200,bubbles:true,cancelable:true}))`)
    await b.waitFor(`document.querySelector('.vh-gsvg g').getAttribute('transform') !== ${JSON.stringify(before)}`, { what: 'zoom applique' })
    await shot('06-snapshots')
    return `${colors} couleurs, selection ${sel}`
  })

  await step('creation de snapshot depuis le panneau', async () => {
    await b.focus('input[aria-label="nom du snapshot"]')
    await b.type('e2e-point')
    await b.clickText('.vh-spanel button', 'snapshot maintenant')
    await b.waitFor(`document.querySelectorAll('.vh-gsvg .vh-nd').length >= 12`, { what: 'nouveau noeud', timeout: 12000 })
  })

  await step('materiel : guide du modele de processeur', async () => {
    await b.clickText('.vh-tabs button', 'matériel')
    await b.waitFor(`!!document.querySelector('.vh-box select')`)
    const before = await b.text('.vh-box p.lite')
    await b.eval(`(()=>{const s=document.querySelector('.vh-box select');const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,'qemu64');s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    await b.waitFor(`document.querySelector('.vh-box p.lite').textContent !== ${JSON.stringify(before)}`)
    assert(/très ancien/.test(await b.text('.vh-box p.lite')), 'texte de qemu64')
    await b.click('.vh-box .vh-q')
    await b.waitFor(`!!document.querySelector('.vh-pop table')`, { what: 'tableau comparatif' })
    eq(await b.count('.vh-pop tbody tr'), 4, 'quatre modeles compares')
    await b.press('Escape')
  })

  await step('export : tache nommee, etapes, journal, fin', async () => {
    await tab('machines')
    await b.clickText('.vh-trow', 'ubuntu-preprod')
    await b.clickText('.vh-tabs button', 'copies')
    await b.clickText('.card button, button', 'exporter')
    await tab('tâches')
    await b.waitFor(`[...document.querySelectorAll('.vh-trow .tt')].some(e=>/^Export de ubuntu-preprod · mode normal$/.test(e.textContent))`, { what: 'tache d\'export nommee' })
    await b.waitFor(`document.querySelectorAll('.vh-steps li').length === 4`, { what: '4 etapes' })
    assert(await b.eval(`!!document.querySelector('.vh-steps li.run, .vh-steps li.done')`), 'une etape avancee')
    await shot('07-tache-en-cours')
    await b.waitFor(`document.querySelector('.vh-tdet .vh-tag').textContent==='terminée'`, { timeout: 20000, what: 'fin de l\'export' })
    assert(/virt-sysprep|assainissement/.test(await b.text('.vh-log')), 'journal rempli')
    assert(await b.eval(`document.querySelectorAll('.vh-steps li.done').length===4`), 'toutes les etapes faites')
  })

  await step('archives : l\'export est apparu, import en deux clics', async () => {
    await tab('archives')
    await b.waitFor(`document.querySelectorAll('table tbody tr').length === 3`, { what: '3 archives' })
    await b.clickText('table tbody tr:first-child button', 'importer')
    await b.waitFor(`!!document.querySelector('.vh-dlg input')`)
    await b.eval(`(()=>{const i=document.querySelector('.vh-dlg input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'import-e2e');i.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await b.clickText('.vh-dlg footer button', 'importer')
    await b.waitFor(`!document.querySelector('.vh-dlg')`)
    await tab('accueil')
    await b.waitFor(`[...document.querySelectorAll('.vh-node .nm')].some(e=>e.textContent==='import-e2e')`, { timeout: 20000, what: 'machine importee' })
    await tab('machines'); await b.clickText('.vh-trow', 'import-e2e')
    await b.waitFor(`document.querySelectorAll('.vh-prov .vh-pn').length === 2`, { what: 'provenance de l\'import' })
    assert(/archive importée/.test(await b.text('.vh-prov')), 'lien « archive importee »')
    assert(await b.eval(`document.querySelector('.vh-pa.import').classList.contains('dash')`), 'import = trait pointille')
  })

  await step('bibliotheque : recherche reactive lettre par lettre, retour arriere', async () => {
    await tab('bibliothèque')
    await b.waitFor(`document.querySelectorAll('.vh-lc').length >= 9`)
    const all = await b.count('.vh-lc')
    await b.focus('.vh-lsearch input')
    const seen = []
    for (const ch of 'kde') { await b.type(ch); seen.push(await b.count('.vh-lc')) }
    assert(seen[2] < all && seen[2] >= 1, `kde filtre (${seen})`)
    assert(/KDE/.test(await b.text('.vh-lc mark')), 'mot surligne')
    await b.type('x')
    await b.waitFor(`!!document.querySelector('.vh-empty')`, { what: 'aucun resultat pour kdex' })
    await b.backspace()
    await b.waitFor(`document.querySelectorAll('.vh-lc').length === ${seen[2]}`, { what: 'retour a kde' })
    for (let i = 0; i < 3; i++) await b.backspace()
    await b.waitFor(`document.querySelectorAll('.vh-lc').length === ${all}`, { what: 'recherche videe' })
    // sans accents
    for (const ch of 'leger') await b.type(ch)
    const leger = await b.count('.vh-lc')
    assert(leger >= 3 && leger < all, `leger sans accent (${leger})`)
    await shot('08-bibliotheque')
    return `lettre a lettre : ${seen.join(' > ')} / ${all}, « leger » : ${leger}`
  })

  await step('bibliotheque : plusieurs editions par distribution, choix qui change la fiche', async () => {
    await b.eval(`(()=>{const i=document.querySelector('.vh-lsearch input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'');i.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await b.waitFor(`[...document.querySelectorAll('.vh-lc b')].some(e=>e.textContent==='Fedora 43')`)
    const eds = await b.eval(`[...document.querySelectorAll('.vh-lc')].find(c=>c.querySelector('b').textContent==='Fedora 43').querySelectorAll('.vh-ed').length`)
    assert(eds >= 6, `editions Fedora : ${eds}`)
    const before = await b.eval(`[...document.querySelectorAll('.vh-lc')].find(c=>c.querySelector('b').textContent==='Fedora 43').querySelector('p').textContent`)
    await b.eval(`[...[...document.querySelectorAll('.vh-lc')].find(c=>c.querySelector('b').textContent==='Fedora 43').querySelectorAll('.vh-ed')].find(e=>e.textContent.includes('Sway')).click()`)
    await b.waitFor(`[...document.querySelectorAll('.vh-lc')].find(c=>c.querySelector('b').textContent==='Fedora 43').querySelector('p').textContent !== ${JSON.stringify(before)}`)
  })

  await step('deploiement avec mon environnement : barre et raccourcis seulement avec interface', async () => {
    await b.eval(`[...document.querySelectorAll('.vh-lc')].find(c=>c.querySelector('b').textContent==='Fedora 43').querySelector('.vh-foot button').click()`)
    await b.waitFor(`!!document.querySelector('#dp-n')`)
    await b.eval(`(()=>{const i=document.querySelector('#dp-n');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'fedora-sway-env');i.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await b.clickText('.vh-env label', 'appliquer mon environnement')
    await b.waitFor(`document.querySelectorAll('.vh-env input[type=checkbox]').length === 6`, { what: '5 options + case maitre' })
    assert(await b.eval(`[...document.querySelectorAll('.vh-env input')].filter(i=>i.disabled).length===0`), 'edition graphique : tout actif')
    assert(/hyprland/.test(await b.text('.vh-env')), 'paquets annonces')
    await shot('09-deploiement-env')
    await b.clickText('.vh-dlg footer button', 'déployer')
    await b.waitFor(`!document.querySelector('.vh-dlg')`)
    await tab('tâches')
    await b.waitFor(`[...document.querySelectorAll('.vh-trow .tt')].some(e=>e.textContent==='Déploiement de Fedora 43 (Sway (tuilage)) en fedora-sway-env')`, { what: 'tache de deploiement nommee' })
    // edition sans interface : options graphiques grisees
    await tab('bibliothèque')
    await b.eval(`[...document.querySelectorAll('.vh-lc')].find(c=>c.querySelector('b').textContent==='Debian 12').querySelector('.vh-foot button').click()`)
    await b.waitFor(`!!document.querySelector('#dp-n')`)
    await b.clickText('.vh-env label', 'appliquer mon environnement')
    await b.waitFor(`document.querySelectorAll('.vh-env input[type=checkbox]:disabled').length === 3`, { what: 'barre, raccourcis et lanceur desactives' })
    await b.clickText('.vh-dlg footer button', 'annuler')
  })

  await step('latence : la liste de la bibliotheque suit chaque frappe en moins de 100 ms', async () => {
    await tab('bibliothèque')
    await b.waitFor(`document.querySelectorAll('.vh-lc').length >= 7`)
    const ms = await b.eval(`(async()=>{
      const input=document.querySelector('.vh-lsearch input');
      const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      const out=[];
      for(const q of ['d','de','deb','debi','debia','debian','debian ','debian k','debian kd','debian kde','debian kd','debian k','debian','deb','']){
        const sig=()=>document.querySelector('.vh-lsearch .lite').textContent+'|'+document.querySelectorAll('.vh-lc').length;
        const before=sig();const t0=performance.now();
        set.call(input,q);input.dispatchEvent(new Event('input',{bubbles:true}));
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        out.push(performance.now()-t0);
      }
      return out;})()`)
    const med = [...ms].sort((x, y) => x - y)[Math.floor(ms.length / 2)]
    assert(med < 100, `mediane ${med.toFixed(1)} ms`)
    return `mediane ${med.toFixed(1)} ms, max ${Math.max(...ms).toFixed(1)} ms sur ${ms.length} frappes`
  })

  await step('mobile 390 px : aucun debordement horizontal sur aucun onglet', async () => {
    await b.viewport(390, 844, true)
    await b.goto(`http://127.0.0.1:${server.port}${BASE}?screen=vms`)
    await b.waitFor(`document.querySelectorAll('.vh-node').length >= 9`)
    const bad = []
    for (const t of ['accueil', 'machines', 'bibliothèque', 'modèles', 'archives', 'tâches']) {
      await tab(t)
      await new Promise((r) => setTimeout(r, 350))
      const over = await b.eval(`document.documentElement.scrollWidth - window.innerWidth`)
      if (over > 1) bad.push(`${t}:+${over}px`)
      if (t === 'accueil') await shot('10-mobile-accueil')
    }
    assert(bad.length === 0, `debordement : ${bad.join(', ')}`)
    await tab('accueil')
    const narrow = await b.eval(`[...document.querySelectorAll('.vh-node .nm')].filter(e=>e.getBoundingClientRect().width<70).map(e=>e.textContent)`)
    assert(narrow.length === 0, `noms de machines ecrases (illisibles) : ${narrow.join(', ')}`)
  })

  await step('aucune erreur dans la console du navigateur', async () => {
    const real = b.errors.filter((e) => !/favicon|Failed to load resource/.test(e))
    assert(real.length === 0, real.slice(0, 3).join(' || '))
  })
} finally {
  await b.close()
  await server.close()
}

const w = Math.max(...results.map((r) => r.name.length))
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name.padEnd(w)}  ${String(r.ms).padStart(5)} ms${r.note ? `  ${r.note}` : ''}`)
console.log(`\n${results.length - failed}/${results.length} scenarios passes`)
process.exit(failed ? 1 : 0)
