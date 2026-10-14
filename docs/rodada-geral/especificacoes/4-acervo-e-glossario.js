export const meta = {
  name: 'acervo-1200-e-glossario',
  description: 'Conteúdo: +330 fichas no acervo (4 escritores + conferência de links) até passar de 1.200, e +200 verbetes no glossário',
  phases: [
    { title: 'Acervo', detail: '4 lotes por grupo de disciplinas, cada um conferido' },
    { title: 'Completar', detail: 'completa até 1.200 se faltar' },
    { title: 'Glossário', detail: '2 lotes temáticos' },
  ],
}

const COMUM = `
Você escreve conteúdo para o Instituto Lúcia (escola e biblioteca comunitária gratuita, em português; repositório em /home/user/perenidade). Trabalhe DIRETO em /home/user/perenidade (não é um worktree): outras pessoas estão escrevendo em outras pastas ao mesmo tempo. Por isso:
- só crie/edite arquivos na(s) pasta(s) da sua tarefa; não rode comandos git que mudem algo (nada de commit, checkout, stash, reset, add); não rode npm install nem build.
- valide o que escreveu com \`cd /home/user/perenidade && /tmp/claude-0/tools/validar.sh\` (aplica as regras do build em ~2 s; se apontar erro em arquivo que NÃO é seu, ignore — é de outra pessoa trabalhando agora — mas os seus têm de passar).
Leia docs/MANUTENCAO.md (seções de regras da casa e "Como escrever conteúdo") antes. Regras: toda informação com fonte real, nada inventado; direitos autorais: nenhum link direto para PDF, nunca link de loja ou de editora comercial; obra protegida vira "ficha de referência" apontando para catálogo de biblioteca (o padrão do acervo é a Open Library); sobre pessoas vivas, partidos e empresas só fatos documentados e linguagem sóbria; português do Brasil correto e claro, frases curtas, para quem estuda.
INTERNET: o acesso direto aos sites está bloqueado neste ambiente (curl e WebFetch falham para quase todos os sites). Use a ferramenta WebSearch (carregue com ToolSearch "select:WebSearch,WebFetch" se ela não estiver disponível) para CONFIRMAR cada endereço: um endereço só vale se aparecer nos resultados da busca (o mesmo endereço, ou claramente a mesma página canônica). Nunca monte endereço de cabeça. Se não conseguir confirmar, não use. Pode tentar WebFetch, mas não conte com ele.
`

const AREAS = [
  { id: 'a1', nome: 'linguagens', areas: 'literatura, portugues, artes, musica, teatro, cinema, danca, desenho, design, educacao-fisica, alfabetizacao, enem, ingles, espanhol, chines' },
  { id: 'a2', nome: 'ciências e tecnologia', areas: 'matematica, fisica, quimica, biologia, astronomia, informatica, programacao, inteligencia-artificial, manutencao, primeiros-socorros, meio-ambiente, ecossocialismo, geografia, arquitetura, arquivologia' },
  { id: 'a3', nome: 'humanidades', areas: 'historia, sociologia, antropologia, filosofia, economia, politica, direito, psicologia, servico-social, teologia, educacao-popular, midia' },
  { id: 'a4', nome: 'teoria e lutas do povo', areas: 'capitalismo, marxismo, socialismo, comunismo, ideologia-e-politica, dependencia, imperialismo, trabalho, sindicalismo, luta-negra, feminismo, lgbtqia, deficiencia, povos-indigenas, luta-pela-terra, favelas, luta-dos-professores, movimento-estudantil, pessoas-idosas' },
]

const ESCREVER = (g) => COMUM + `
TAREFA: acrescentar ao acervo (content/acervo/, uma ficha por arquivo .md) PELO MENOS 85 obras novas das disciplinas: ${g.areas}. O acervo tem 881 fichas e o dono quer passar de 1.200 com outros três lotes paralelos ao seu (cada lote cuida de disciplinas diferentes — só use as suas no campo "area").
1. Estude o formato: leia 15 fichas existentes de vários tipos (domínio público, Creative Commons, "Direitos reservados"), lib/content.ts (getBooks: campos obrigatórios e validações) e lib/areas.ts (licenças válidas). Liste os títulos que já existem (grep -h '^titulo:' content/acervo/*.md) e, para cada disciplina sua, olhe o catálogo ampliado content/catalogo/<disciplina>.json para não repetir o que já está ali sem motivo. Não repita obra que já tem ficha.
2. Escolha obras que valem a pena para quem estuda, equilibradas entre as suas disciplinas (ao menos 3 por disciplina, mais nas maiores), dando preferência a obras em português e a acesso livre e legítimo: domínio público (no Brasil, autor morto até 1955), obras com licença Creative Commons (livros abertos de editoras universitárias no SciELO Livros, Editora UFBA/EDUFBA, CLACSO, livros didáticos abertos como OpenStax e eduCAPES, publicações abertas de fundações e institutos), publicações públicas de órgãos de governo (MEC, IBGE, Ipea, Fiocruz), Arquivo Marxista na Internet, Domínio Público (MEC), Wikisource, Project Gutenberg. Obras importantes ainda protegidas entram como "Direitos reservados" com link para a ficha da obra na Open Library (confirme que a ficha existe pela busca).
3. Para cada obra: confirme pela WebSearch o endereço exato da página da obra na fonte (não PDF), a autoria, o ano e a licença. Licença: use exatamente um dos valores de lib/areas.ts; se a fonte não diz a licença com clareza, use "Conforme a fonte" ou não use a obra. Sinopse: 1 a 3 frases suas, factuais, sem copiar texto da fonte. Para "Direitos reservados", termine a sinopse com "Ficha de referência: procure o livro em uma biblioteca." Nome do arquivo: slug do título (minúsculas, números e hífens), sem colidir com arquivo existente. Campo "autores" só se houver página em content/autores com aquele slug.
4. Valide com o validador. Conte: \`ls content/acervo/*.md | grep -vE '\\.[a-z]{2}\\.md$' | wc -l\`.
RETORNE (texto): a lista dos arquivos que você criou (um por linha, só o nome), e no fim uma linha "TOTAL_CRIADOS=<n>".
`

const CONFERIR = (g, lista) => COMUM + `
TAREFA: conferir, uma por uma, as fichas novas do acervo criadas por outro agente para as disciplinas ${g.areas}. Lista dos arquivos (em content/acervo/):
${lista}

Para CADA ficha: (a) confirme pela WebSearch que a obra existe com esse título e essa autoria, que o endereço do campo "url" é a página dessa obra na fonte indicada (o endereço aparece nos resultados ou é claramente a mesma página canônica) e que não é PDF nem loja/editora comercial; (b) confirme que a licença declarada é a verdadeira (domínio público só se o autor morreu até 1955 ou a obra é pública por natureza; Creative Commons só se a fonte diz qual); (c) a sinopse é correta e não copia texto; (d) a área está entre as do lote; (e) não duplica ficha antiga (compare títulos com o resto de content/acervo). Corrija o que der para corrigir com segurança; APAGUE a ficha que não der para confirmar. Não crie fichas novas. Rode o validador no fim.
RETORNE: quantas fichas conferidas, corrigidas e apagadas (com o motivo de cada apagada), e a linha final "APAGADAS=<n>".
`

const CONTAR = COMUM + `
TAREFA: só conte as fichas do acervo e confira duplicatas. Rode: \`cd /home/user/perenidade && ls content/acervo/*.md | grep -vE '\\.[a-z]{2}\\.md$' | wc -l\`. Procure títulos repetidos (\`grep -h '^titulo:' content/acervo/*.md | sort | uniq -d\`) e endereços repetidos (\`grep -h '^url:' content/acervo/*.md | sort | uniq -d\`); se houver repetição entre uma ficha antiga e uma nova, apague a NOVA (as novas são as que não estão no git: \`git status --porcelain content/acervo\` mostra "??" nelas). Rode o validador. RETORNE só um JSON: {"total": <número de fichas depois da limpeza>, "apagadas": <n>}.
`

phase('Acervo')
const lotes = await pipeline(
  AREAS,
  (g) => agent(ESCREVER(g), { label: `acervo ${g.nome}`, phase: 'Acervo' }),
  (escrito, g) => agent(CONFERIR(g, String(escrito ?? '')), { label: `conferir ${g.nome}`, phase: 'Acervo' }),
)
log('Lotes do acervo escritos e conferidos')

phase('Completar')
let contagem = await agent(CONTAR, { label: 'contar acervo', phase: 'Completar', schema: { type: 'object', properties: { total: { type: 'number' }, apagadas: { type: 'number' } }, required: ['total', 'apagadas'] } })
let rodada = 0
while (contagem && contagem.total < 1205 && rodada < 3) {
  rodada++
  const falta = 1205 - contagem.total + 10
  log(`Acervo com ${contagem.total}; completando mais ${falta}`)
  const g = { id: 'extra' + rodada, nome: 'completar ' + rodada, areas: 'qualquer disciplina de lib/areas.ts, dando preferência às que têm menos fichas no acervo (conte por "area:")' }
  const escrito = await agent(ESCREVER(g).replace('PELO MENOS 85 obras novas', `PELO MENOS ${falta} obras novas`), { label: `completar acervo ${rodada}`, phase: 'Completar' })
  await agent(CONFERIR(g, String(escrito ?? '')), { label: `conferir completar ${rodada}`, phase: 'Completar' })
  contagem = await agent(CONTAR, { label: `contar acervo ${rodada}`, phase: 'Completar', schema: { type: 'object', properties: { total: { type: 'number' }, apagadas: { type: 'number' } }, required: ['total', 'apagadas'] } })
}
log(`Acervo final: ${contagem ? contagem.total : '?'}`)

phase('Glossário')
const GLOSS = (tema) => COMUM + `
TAREFA: expandir o glossário (content/glossario/, um verbete por arquivo .md). O dono disse: "Expandir glossário. Para a quantidade de coisas que temos no site, acho que ele ainda não englobou tudo." Seu tema: ${tema}. Outro agente cuida do outro tema ao mesmo tempo — fique no seu.
1. Estude o formato: leia vários verbetes existentes, lib/content.ts (getGlossary e getGlossaryIndex: o índice junta os verbetes da curadoria e os termos que as aulas definem no cabeçalho "termos", e procura cada termo nas aulas).
2. Descubra o que falta: percorra as aulas (content/trilhas/*/*.md) das disciplinas do seu tema, as páginas e coleções do site, e levante termos importantes que aparecem e não têm verbete (nem como verbete da curadoria nem como termo de aula). Faça ao menos 110 verbetes novos, cobrindo as disciplinas do seu tema de forma equilibrada.
3. Cada verbete: "termo" (como se escreve normalmente), "resumo" (uma linha clara), e no corpo 1 a 3 parágrafos curtos que explicam com exemplo, e — quando existir — "Veja a aula [Título](/trilhas/<trilha>/<slug-da-aula>)" com caminho que EXISTE de verdade (confira o arquivo e o slug: aulas "NN-slug.md" têm slug sem o número; veja como getTracks monta). Siga o padrão dos verbetes existentes quanto a fontes (se eles citam fonte, cite; definições técnicas e históricas devem bater com fontes confiáveis — confirme pela WebSearch quando tiver dúvida). Nome do arquivo: slug do termo, sem colidir.
4. Valide com o validador. RETORNE a lista dos verbetes criados e "TOTAL=<n>".
`
const gl = await parallel([
  () => agent(GLOSS('ciências, matemática, tecnologia, informática e programação, saúde e primeiros socorros, línguas (português, inglês, espanhol, chinês), artes, música, cinema, educação física, ENEM e vida escolar, e os termos do próprio site (licenças livres, domínio público, software livre, checagem de fatos, acessibilidade etc.)'), { label: 'glossário ciências e linguagens', phase: 'Glossário' }),
  () => agent(GLOSS('história, geografia, sociologia, antropologia, filosofia, economia, política, direito, psicologia, serviço social, teologia, educação popular, mídia, meio ambiente, teoria marxista e socialista, imperialismo e dependência, trabalho e sindicalismo, e as lutas do povo (luta negra, feminismo, LGBTQIA+, pessoas com deficiência, povos indígenas, terra, favelas, professores, estudantes, pessoas idosas)'), { label: 'glossário humanidades e lutas', phase: 'Glossário' }),
])
return { lotes, contagem, glossario: gl }
