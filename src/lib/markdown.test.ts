import { describe, expect, it } from 'vitest'
import { inline, isDrawingLine, markerLabel, parse, splitRow } from './markdown'

const kinds = (src: string) => parse(src).map((b) => b.kind)

describe('tableaux', () => {
  const table = '| pièce | état | masse |\n|:------|:----:|------:|\n| corps | ok | 80 g |\n| couvercle | **ko** | 49 g |'
  it('en-tête, alignements et lignes', () => {
    const [b] = parse(table)
    expect(b).toEqual({ kind: 'table', head: ['pièce', 'état', 'masse'], align: ['left', 'center', 'right'], rows: [['corps', 'ok', '80 g'], ['couvercle', '**ko**', '49 g']] })
  })
  it('sans barres aux bords', () => {
    expect(parse('a | b\n--- | ---\n1 | 2')[0]).toMatchObject({ kind: 'table', head: ['a', 'b'], rows: [['1', '2']] })
  })
  it('ligne trop courte complétée, trop longue coupée', () => {
    expect(parse('| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |')[0]).toMatchObject({ rows: [['1', ''], ['1', '2']] })
  })
  it('une barre échappée reste dans sa cellule', () => {
    expect(splitRow('| a \\| b | c |')).toEqual(['a | b', 'c'])
  })
  it('texte avant et après, le tableau s’arrête à la ligne vide', () => {
    expect(kinds(`Voici :\n\n${table}\n\nEt la suite.`)).toEqual(['para', 'table', 'para'])
  })
  it('une phrase avec une barre n’est pas un tableau', () => {
    expect(kinds('soit a | b, au choix')).toEqual(['para'])
  })
  it('colonnes de tirets qui ne correspondent pas : pas de tableau, mais rien n’est perdu', () => {
    const blocks = parse('| a | b |\n|---|\n| 1 | 2 |')
    expect(blocks.some((b) => b.kind === 'table')).toBe(false)
    expect(JSON.stringify(blocks)).toContain('1 | 2')
  })
})

describe('schémas et art ascii', () => {
  it('cadre en traits de boîte, espaces gardés', () => {
    const src = '┌──────┐\n│ corps │\n└──────┘'
    expect(parse(src)).toEqual([{ kind: 'ascii', body: src }])
  })
  it('arborescence de fichiers', () => {
    const src = 'src/\n├── lib/\n│   └── atelier.ts\n└── screens/'
    const blocks = parse(src)
    expect(blocks.at(-1)).toMatchObject({ kind: 'ascii' })
    expect(JSON.stringify(blocks)).toContain('atelier.ts')
  })
  it('cadre en + et -, avec son texte au milieu', () => {
    const src = '+-------+-------+\n|  a    |   b   |\n+-------+-------+'
    expect(parse(src)).toEqual([{ kind: 'ascii', body: src }])
  })
  it('un schéma entre deux paragraphes ne les avale pas', () => {
    expect(kinds('Le flux :\n\n  A ──▶ B ──▶ C\n\nvoilà.')).toEqual(['para', 'ascii', 'para'])
  })
  it('ligne vide à l’intérieur d’un schéma', () => {
    expect(parse('┌─┐\n\n└─┘')).toHaveLength(1)
  })
  it.each([
    ['======================', true], ['-----> suite', true], ['Une phrase normale, avec de la ponctuation !', false], ['- élément de liste', false],
    ['prix : 12,50 € (lot de 25)', false], ['', false], ['|-- fichier.ts', true],
    ['Le flux A --> B devient plus simple quand on y pense vraiment.', false], ['A --> B --> C', true],
  ])('« %s » dessin ? %s', (line, drawing) => {
    expect(isDrawingLine(line)).toBe(drawing)
  })
})

describe('listes et propositions', () => {
  it('numéros d’origine gardés', () => {
    const [b] = parse('2. deuxième option\n3) troisième')
    expect(b).toMatchObject({ kind: 'list', ordered: true, items: [{ text: 'deuxième option', marker: '2.' }, { text: 'troisième', marker: '3)' }] })
    expect([markerLabel('3)'), markerLabel('-')]).toEqual(['3.', '•'])
  })
  it('imbrication, suite d’élément et ligne vide entre deux', () => {
    const [b] = parse('1. **Option A** — rapide\n   moins solide\n\n2. Option B\n   - détail\n   - autre')
    expect(b.kind === 'list' && b.items.map((x) => [x.depth, x.text])).toEqual([[0, '**Option A** — rapide\nmoins solide'], [0, 'Option B'], [1, 'détail'], [1, 'autre']])
  })
  it('cases à cocher', () => {
    const [b] = parse('- [x] fait\n- [ ] à faire')
    expect(b.kind === 'list' && b.items.map((x) => x.checked)).toEqual([true, false])
  })
  it('un tiret au milieu d’une phrase ne fait pas une liste', () => {
    expect(kinds('un résultat - provisoire')).toEqual(['para'])
  })
})

describe('code, titres, citations', () => {
  it('bloc de code avec langue ; son contenu n’est pas réinterprété', () => {
    expect(parse('```bash\n| a | b |\n# pas un titre\n```')).toEqual([{ kind: 'code', lang: 'bash', body: '| a | b |\n# pas un titre' }])
  })
  it('bloc resté ouvert (réponse coupée) : tout est gardé', () => {
    expect(parse('texte\n```\nnpm run build')).toEqual([{ kind: 'para', text: 'texte' }, { kind: 'code', lang: '', body: 'npm run build' }])
  })
  it('titres, règle, citation', () => {
    expect(parse('## Plan\n---\n> attention\n> ici')).toEqual([{ kind: 'heading', level: 2, text: 'Plan' }, { kind: 'rule' }, { kind: 'quote', text: 'attention\nici' }])
  })
  it('un dièse collé au titre en fait partie', () => {
    expect(parse('# Intro à C#')).toEqual([{ kind: 'heading', level: 1, text: 'Intro à C#' }])
    expect(parse('## Plan ##')).toEqual([{ kind: 'heading', level: 2, text: 'Plan' }])
  })
  it('#hashtag sans espace : du texte', () => {
    expect(kinds('#73 est fermé')).toEqual(['para'])
  })
  it('fins de ligne Windows et tabulations', () => {
    expect(parse('a\r\nb')).toEqual([{ kind: 'para', text: 'a\nb' }])
  })
  it('texte vide', () => {
    expect(parse('')).toEqual([])
    expect(parse('\n\n  \n')).toEqual([])
  })
})

describe('mise en forme dans la ligne', () => {
  it('code, gras, italique, barré', () => {
    expect(inline('un `code`, du **gras**, de l’*italique* et ~~barré~~')).toEqual([
      { kind: 'text', text: 'un ' }, { kind: 'code', text: 'code' }, { kind: 'text', text: ', du ' }, { kind: 'bold', text: 'gras' },
      { kind: 'text', text: ', de l’' }, { kind: 'italic', text: 'italique' }, { kind: 'text', text: ' et ' }, { kind: 'strike', text: 'barré' },
    ])
  })
  it('le contenu d’un code n’est pas mis en forme', () => {
    expect(inline('`a **b** c`')).toEqual([{ kind: 'code', text: 'a **b** c' }])
  })
  it('noms avec tirets bas et multiplications laissés tels quels', () => {
    expect(inline('cale_cellule_+x et 2 * 3 * 4')).toEqual([{ kind: 'text', text: 'cale_cellule_+x et 2 * 3 * 4' }])
  })
  it('lien http cliquable, autre schéma rendu en texte', () => {
    expect(inline('[doc](https://example.org/a)')).toEqual([{ kind: 'link', text: 'doc', href: 'https://example.org/a' }])
    expect(inline('[piège](javascript:alert(1))')[0]).toMatchObject({ kind: 'text' })
    expect(JSON.stringify(inline('[x](data:text/html,abc)'))).not.toContain('"link"')
  })
})
