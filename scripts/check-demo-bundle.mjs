// Garde-fou avant publication de la démo : le bundle ne doit contenir aucune
// donnée de la machine de build (IP locale, Tailscale, chemin personnel, e-mail),
// ni chemin /app/ en dur (la démo vit sous /neutroncore/).
// Un .env.local oublié suffirait à en injecter via import.meta.env.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'dist-demo'
const RULES = [
  [/192\.168\.(?!122\.)\d{1,3}\.\d{1,3}/g, 'IP de réseau local'],
  [/\b100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/g, 'IP Tailscale (100.64/10)'],
  [/\/home\/(?!user\/|runner\/)[a-z][a-z0-9_-]*\//g, 'chemin personnel'],
  [/[\w.+-]+@(gmail|hotmail|outlook|yahoo)\.[a-z]+/gi, 'adresse e-mail'],
  [/[\w-]+\.ts\.net/g, 'nom Tailscale'],
  // la démo est servie sous /neutroncore/ : un chemin /app/ en dur y serait un 404 (polices, icônes)
  [/["'(]\/app\/[\w./-]+/g, 'chemin /app/ en dur (mauvaise base)'],
]

const files = []
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f)
  if (statSync(p).isDirectory()) walk(p)
  else if (/\.(js|html|css|json|webmanifest|txt)$/.test(f)) files.push(p)
})
walk(dir)

let found = 0
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  for (const [rx, label] of RULES) {
    for (const m of text.matchAll(rx)) {
      found++
      console.error(`${f}: ${label} : ${m[0]}`)
    }
  }
}
if (found) {
  console.error(`\n${found} problème(s) dans le bundle de démo : publication refusée.`)
  process.exit(1)
}
console.log(`démo propre : ${files.length} fichiers vérifiés`)
