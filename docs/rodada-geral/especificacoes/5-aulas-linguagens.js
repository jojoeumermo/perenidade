export const meta = {
  name: 'aulas-base-linguagens',
  description: 'Aulas novas nas disciplinas de base (alfabetização, português, inglês, espanhol, chinês, ENEM): escrever e revisar',
  phases: [{ title: 'Aulas', detail: 'escrever seguindo o roteiro e revisar fatos, fontes e quiz' }],
}
const COMUM = `
Você escreve aulas para o Instituto Lúcia (escola e biblioteca comunitária gratuita, em português; repositório em /home/user/perenidade). Trabalhe DIRETO em /home/user/perenidade (não é um worktree): outras pessoas escrevem em outras pastas ao mesmo tempo. Então: só crie/edite arquivos nas pastas de trilha da sua disciplina (content/trilhas/<trilha>/); não rode comandos git que mudem algo (nada de commit, checkout, stash, reset, add); não rode npm install nem build. Valide com \`cd /home/user/perenidade && /tmp/claude-0/tools/validar.sh\` (regras do build em ~2 s; erro em arquivo que não é seu é de outra pessoa trabalhando agora — ignore; os seus têm de passar). \`node scripts/proximo.mjs\` mostra a próxima aula de cada disciplina.
Leia docs/MANUTENCAO.md (regras da casa e "Como escrever conteúdo") e lib/content.ts (loadLesson/getTracks: campos do cabeçalho, quiz, termos, fontes, nomes de arquivo). Regras: toda aula cita pelo menos uma fonte real e confirmada; nada inventado; sem HTML e sem imagens no texto; sobre pessoas vivas, partidos e empresas, só fatos documentados e linguagem sóbria; português do Brasil claro, para quem estuda sozinho, com exemplos do cotidiano brasileiro e da classe trabalhadora.
INTERNET: o acesso direto aos sites está bloqueado (curl/WebFetch falham quase sempre). Use a ferramenta WebSearch (carregue com ToolSearch "select:WebSearch,WebFetch" se precisar) para CONFIRMAR cada fonte: o endereço só vale se aparecer nos resultados (o mesmo endereço ou a mesma página canônica). Nunca monte endereço de cabeça. Boas fontes abertas: OpenStax, eduCAPES, Portal do MEC/Inep, IBGE, Fiocruz, SciELO, Arquivo Marxista na Internet, Wikipédia (como apoio, não única), dicionários e gramáticas abertas, materiais de universidades públicas.
`
const ESCREVER = (d) => COMUM + `
TAREFA: escrever ${d.n} aulas novas da disciplina "${d.area}" (${d.obs}). Siga a ordem dos roteiros (plano.json) das trilhas da disciplina, começando pelas trilhas de etapa mais básica e pelas primeiras aulas que ainda não têm arquivo (as que já existem ficam como estão). Use o slug exatamente como está no plano.json e o padrão de nome de arquivo que a trilha já usa.
Leia ANTES 3 aulas boas já prontas do site (de preferência da mesma disciplina, ou de biologia-fundamental/matemática) para pegar o tom, o tamanho (cerca de 900 a 1.500 palavras), a estrutura com subtítulos (##), as tabelas e listas, o quiz (3 a 5 perguntas, com explicação) e as fontes no cabeçalho. Cada aula: resumo de uma linha; texto que ensina de verdade, do simples ao mais completo, com exemplos resolvidos quando couber e um fechamento "para praticar" ou "para pensar"; links para outras aulas do site que existem de verdade (confira o caminho); termos do glossário no cabeçalho ("termos") quando a aula define conceitos centrais (veja o formato no loader).
Valide a cada duas ou três aulas. RETORNE a lista dos arquivos criados (caminho a partir de content/) e "TOTAL=<n>".
`
const REVISAR = (d, lista) => COMUM + `
TAREFA: revisar, como professor e checador exigente, as aulas novas da disciplina "${d.area}" escritas por outro agente:
${lista}
Para cada aula: (1) todo fato, data, número, regra gramatical, tradução, pronúncia, fórmula e conta está certo? Refaça as contas e confira os fatos (WebSearch quando houver dúvida); (2) cada fonte do cabeçalho existe, é o endereço confirmado pela busca, e sustenta o que a aula diz?; (3) o quiz tem exatamente uma resposta certa, o índice "resposta" aponta para ela e a explicação está certa?; (4) a linguagem está clara para quem estuda sozinho, sem erro de português?; (5) os links internos existem?; (6) segue as regras da casa (fontes, sobriedade, sem HTML)? Corrija direto nos arquivos. Se uma aula estiver ruim demais para salvar, reescreva-a. Rode o validador no fim.
RETORNE: o que você corrigiu em cada aula (curto) e "PROBLEMAS_GRAVES=<n>".
`
const DISCIPLINAS = [
  { area: 'alfabetizacao', n: 8, obs: 'alfabetização de jovens e adultos: frases curtíssimas, palavras do cotidiano, letra e som, sílabas, muito exemplo, tom respeitoso de educação popular (Paulo Freire), nada infantilizado; o quiz também bem simples' },
  { area: 'portugues', n: 8, obs: 'gramática, leitura e escrita para o ensino fundamental e médio, com exemplos do português falado no Brasil, sem preconceito linguístico' },
  { area: 'ingles', n: 8, obs: 'inglês do zero em diante, explicado em português, com pronúncia aproximada e exemplos de uso real' },
  { area: 'espanhol', n: 8, obs: 'espanhol do zero, explicado em português, atenção aos falsos cognatos e à variação latino-americana' },
  { area: 'chines', n: 6, obs: 'mandarim do zero, explicado em português, com pinyin e tons corretos e caracteres simplificados; confira cada caractere, pinyin e tom' },
  { area: 'enem', n: 8, obs: 'ENEM: como funciona (inscrição, isenção, dias de prova, TRI), estudo por área e redação; dados oficiais do Inep confirmados e atualizados (diga o ano a que o dado se refere)' },
]
phase('Aulas')
const res = await pipeline(
  DISCIPLINAS,
  (d) => agent(ESCREVER(d), { label: `aulas ${d.area}`, phase: 'Aulas' }),
  (escrito, d) => agent(REVISAR(d, String(escrito ?? '')), { label: `revisar ${d.area}`, phase: 'Aulas' }),
)
return res
