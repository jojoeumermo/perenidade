export const meta = {
  name: 'aulas-base-ciencias-humanas',
  description: 'Aulas novas nas disciplinas de base (geografia, história, física, química, biologia, informática): escrever e revisar',
  phases: [{ title: 'Aulas', detail: 'escrever seguindo o roteiro e revisar fatos, fontes e quiz' }],
}
const COMUM = `
Você escreve aulas para o Instituto Lúcia (escola e biblioteca comunitária gratuita, em português; repositório em /home/user/perenidade). Trabalhe DIRETO em /home/user/perenidade (não é um worktree): outras pessoas escrevem em outras pastas ao mesmo tempo. Então: só crie/edite arquivos nas pastas de trilha da sua disciplina (content/trilhas/<trilha>/); não rode comandos git que mudem algo (nada de commit, checkout, stash, reset, add); não rode npm install nem build. Valide com \`cd /home/user/perenidade && /tmp/claude-0/tools/validar.sh\` (regras do build em ~2 s; erro em arquivo que não é seu é de outra pessoa trabalhando agora — ignore; os seus têm de passar). \`node scripts/proximo.mjs\` mostra a próxima aula de cada disciplina.
Leia docs/MANUTENCAO.md (regras da casa e "Como escrever conteúdo") e lib/content.ts (loadLesson/getTracks: campos do cabeçalho, quiz, termos, fontes, nomes de arquivo). Regras: toda aula cita pelo menos uma fonte real e confirmada; nada inventado; sem HTML e sem imagens no texto; sobre pessoas vivas, partidos e empresas, só fatos documentados e linguagem sóbria; português do Brasil claro, para quem estuda sozinho, com exemplos do cotidiano brasileiro e da classe trabalhadora.
INTERNET: o acesso direto aos sites está bloqueado (curl/WebFetch falham quase sempre). Use a ferramenta WebSearch (carregue com ToolSearch "select:WebSearch,WebFetch" se precisar) para CONFIRMAR cada fonte: o endereço só vale se aparecer nos resultados (o mesmo endereço ou a mesma página canônica). Nunca monte endereço de cabeça. Boas fontes abertas: OpenStax, eduCAPES, Portal do MEC/Inep, IBGE, Embrapa, INPE, Fiocruz, SciELO, NASA, Arquivo Marxista na Internet, Wikipédia (como apoio, não única), materiais de universidades públicas.
`
const ESCREVER = (d) => COMUM + `
TAREFA: escrever ${d.n} aulas novas da disciplina "${d.area}" (${d.obs}). Siga a ordem dos roteiros (plano.json) das trilhas da disciplina, começando pelas trilhas de etapa mais básica e pelas primeiras aulas que ainda não têm arquivo (as que já existem ficam como estão). Use o slug exatamente como está no plano.json e o padrão de nome de arquivo que a trilha já usa.
Leia ANTES 3 aulas boas já prontas (de preferência da mesma disciplina, ou de biologia-fundamental/matemática) para pegar o tom, o tamanho (cerca de 900 a 1.500 palavras), a estrutura com subtítulos (##), tabelas e listas, o quiz (3 a 5 perguntas, com explicação) e as fontes no cabeçalho. Cada aula: resumo de uma linha; texto que ensina de verdade, do simples ao mais completo, com exemplos resolvidos quando couber (contas certas, unidades certas) e um fechamento "para praticar" ou "para pensar"; links para outras aulas do site que existem de verdade (confira o caminho); termos no cabeçalho ("termos") quando a aula define conceitos centrais (formato no loader). Se a disciplina tiver ferramenta prática no site (lib/areas.ts, areaTools — calculadora, tabela periódica, Python etc.), sugira o uso dela no texto quando fizer sentido.
Valide a cada duas ou três aulas. RETORNE a lista dos arquivos criados (caminho a partir de content/) e "TOTAL=<n>".
`
const REVISAR = (d, lista) => COMUM + `
TAREFA: revisar, como professor e checador exigente, as aulas novas da disciplina "${d.area}" escritas por outro agente:
${lista}
Para cada aula: (1) todo fato, data, número, fórmula, unidade e conta está certo? Refaça cada conta e confira os fatos e dados (WebSearch quando houver dúvida; dados do IBGE e de órgãos públicos com o ano de referência); (2) cada fonte do cabeçalho existe, é o endereço confirmado pela busca, e sustenta o que a aula diz?; (3) o quiz tem exatamente uma resposta certa, o índice "resposta" aponta para ela e a explicação está certa?; (4) a linguagem está clara para quem estuda sozinho, sem erro de português?; (5) os links internos existem?; (6) segue as regras da casa? Corrija direto nos arquivos. Se uma aula estiver ruim demais para salvar, reescreva-a. Rode o validador no fim.
RETORNE: o que você corrigiu em cada aula (curto) e "PROBLEMAS_GRAVES=<n>".
`
const DISCIPLINAS = [
  { area: 'geografia', n: 10, obs: 'geografia do fundamental e do médio: cartografia, natureza e sociedade, Brasil (regiões, população, campo e cidade, desigualdade), com dados oficiais (IBGE) confirmados e com o ano' },
  { area: 'historia', n: 8, obs: 'história com as lutas do povo no centro, sem perder o rigor: datas, nomes e números conferidos; siga os roteiros (há trilhas como lutas-do-povo)' },
  { area: 'fisica', n: 8, obs: 'física: complete as trilhas que faltam (há aulas faltando na física superior e talvez em outras); contas e unidades impecáveis, exemplos resolvidos' },
  { area: 'quimica', n: 8, obs: 'química: complete as trilhas que faltam; fórmulas, nomenclatura IUPAC em português e contas conferidas; sugira a tabela periódica do site' },
  { area: 'biologia', n: 10, obs: 'biologia: complete as trilhas que faltam (há a trilha superior com biologia molecular etc.); conceitos atualizados e corretos' },
  { area: 'informatica', n: 10, obs: 'informática essencial para quem está começando (arquivos e pastas, internet com segurança, documentos, planilhas, software livre etc.), com passos que funcionem em programas livres e comuns; nada de propaganda' },
]
phase('Aulas')
const res = await pipeline(
  DISCIPLINAS,
  (d) => agent(ESCREVER(d), { label: `aulas ${d.area}`, phase: 'Aulas' }),
  (escrito, d) => agent(REVISAR(d, String(escrito ?? '')), { label: `revisar ${d.area}`, phase: 'Aulas' }),
)
return res
