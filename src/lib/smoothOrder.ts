import { useLayoutEffect, useRef } from 'react'

// Liste de cartes qui se réordonne sans faire sauter la page : la carte qu'on lit reste où elle est à l'écran
// (le défilement compense ce qui change au-dessus d'elle), et les cartes qui changent de place glissent.

const GLISSE_MS = 420
const GLISSE_MAX = 900       // au-delà, glisser sur toute la hauteur fatigue : la carte apparaît en fondu

function defilant(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null       // c'est la fenêtre qui défile
}

type Place = { haut: number; bas: number }

/** `host` contient les cartes (`[data-sid]`) ; `ordre` est la suite de leurs identifiants ; `ancre` la carte à
 * garder en place de préférence (celle qui est dépliée), si elle est à l'écran. */
export function useSmoothOrder(host: React.RefObject<HTMLElement | null>, ordre: string, ancre: string | null): void {
  const avant = useRef<{ ordre: string; places: Map<string, Place> }>({ ordre: '', places: new Map() })
  useLayoutEffect(() => {
    const racine = host.current
    if (!racine) return
    const boite = defilant(racine)
    const scroll = () => (boite ? boite.scrollTop : window.scrollY)
    const hauteurVue = boite ? boite.clientHeight : window.innerHeight
    const origine = boite ? boite.getBoundingClientRect().top : 0
    const cartes = [...racine.querySelectorAll<HTMLElement>('[data-sid]')]
    // une glissade encore en cours fausserait la mesure
    for (const c of cartes) { c.style.transition = 'none'; c.style.transform = '' }
    const mesurer = () => new Map(cartes.map((c) => { const r = c.getBoundingClientRect(); return [c.dataset.sid ?? '', { haut: r.top - origine + scroll(), bas: r.bottom - origine + scroll() }] }))
    let places = mesurer()
    for (const c of cartes) c.style.transition = ''       // les transitions de la feuille de style reprennent la main
    const prec = avant.current
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prec.places.size > 0) {
      // la carte de référence : celle qu'on lit si elle était à l'écran, sinon la première visible
      const haut = scroll(), bas = haut + hauteurVue
      const visible = (id: string) => { const p = prec.places.get(id); return Boolean(p && places.has(id) && p.bas > haut + 8 && p.haut < bas - 8) }
      const repere = (ancre && visible(ancre) ? ancre : null) ?? [...prec.places.keys()].find(visible) ?? null
      const decale = repere ? places.get(repere)!.haut - prec.places.get(repere)!.haut : 0
      // tout en haut de la page, on y reste : c'est là qu'arrive la session qui attend
      if (Math.abs(decale) >= 1 && haut > 4) {
        if (boite) boite.scrollTop += decale; else window.scrollBy(0, decale)
        places = mesurer()
      }
      const compense = scroll() - haut
      if (prec.ordre !== ordre && !reduit) {
        for (const c of cartes) {
          const id = c.dataset.sid ?? ''
          const a = prec.places.get(id), b = places.get(id)
          if (!a || !b) continue
          const dy = a.haut - b.haut + compense
          if (Math.abs(dy) < 2) continue
          if (Math.abs(dy) > GLISSE_MAX) { c.animate([{ opacity: 0.25 }, { opacity: 1 }], { duration: GLISSE_MS, easing: 'ease-out' }); continue }
          c.style.transform = `translateY(${dy}px)`
          void c.offsetHeight       // la position de départ est prise en compte avant de lancer la glissade
          c.style.transition = `transform ${GLISSE_MS}ms cubic-bezier(.2,.8,.2,1)`
          c.style.transform = ''
          c.addEventListener('transitionend', () => { c.style.transition = '' }, { once: true })
        }
      }
    }
    avant.current = { ordre, places }
  })
}
