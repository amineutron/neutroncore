import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Markdown } from './Markdown'

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />)

// Rendu réel (HTML produit), pas seulement l'analyse : ce que Claude envoie doit arriver intact à l'écran.
describe('rendu des réponses de Claude', () => {
  it('un tableau devient un vrai tableau, dans un cadre défilant', () => {
    const out = html('| pièce | masse |\n|---|--:|\n| corps | **80 g** |')
    expect(out).toContain('<div class="md-table-wrap"')
    expect(out).toContain('<th style="text-align:left">pièce</th>')
    expect(out).toContain('<td style="text-align:right"><b>80 g</b></td>')
  })
  it('un schéma garde ses espaces et ses caractères, sans mise en forme parasite', () => {
    const art = '┌────────┐\n│ *corps* │  __x__\n└────────┘'
    const out = html(art)
    expect(out).toContain(`<pre>${art}</pre>`)
    expect(out).not.toContain('<i>')
  })
  it('les propositions gardent leur numéro', () => {
    const out = html('1. première\n2. **seconde**\n4. quatrième')
    expect(out.match(/class="md-marker"[^>]*>([^<]+)</g)?.map((m) => m.split('>')[1].replace('<', ''))).toEqual(['1.', '2.', '4.'])
    expect(out).toContain('<b>seconde</b>')
  })
  it('le contenu est toujours échappé', () => {
    const out = html('<img src=x onerror=alert(1)> et `<script>`\n\n| <b>a</b> | b |\n|---|---|\n| <i>1</i> | 2 |')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;b&gt;a&lt;/b&gt;')
  })
  it('un lien douteux n’est pas cliquable', () => {
    expect(html('[clic](javascript:alert(1))')).not.toContain('<a ')
    expect(html('[doc](https://example.org)')).toContain('rel="noreferrer noopener"')
  })
  it('cases à cocher lisibles par un lecteur d’écran', () => {
    const out = html('- [x] tests\n- [ ] doc')
    expect(out).toContain('fait : ')
    expect(out).toContain('à faire : ')
  })
  it('les retours à la ligne d’un paragraphe sont gardés', () => {
    expect(html('ligne une\nligne deux')).toContain('<br/>')
  })
})
