export const meta = {
  name: 'ferramentas-e-assistente',
  description: 'Cadeia de código: caixa de ferramentas + ferramentas de ciências (C5a) -> mais ferramentas (C5b) -> assistente de reforço e resolvedor por foto (C4)',
  phases: [
    { title: 'C5a Caixa', detail: 'caixa de ferramentas nas aulas e ferramentas de matemática e ciências' },
    { title: 'C5b Ferramentas', detail: 'ferramentas das outras disciplinas' },
    { title: 'C4 Assistente', detail: 'assistente de reforço (Claude) e foto no resolvedor' },
  ],
}

const COMUM = `
Você trabalha no repositório do Instituto Lúcia (escola e biblioteca comunitária gratuita; Next.js 16 + React 19 + Tailwind 4 + Supabase/Postgres). Você está num git worktree isolado (seu diretório atual). Tudo o que aparece no site é em português do Brasil, com tradução para en, es, zh, ru.

ANTES DE COMEÇAR
- Rode \`npm ci\` no seu worktree (node_modules não vem junto).
- Leia docs/MANUTENCAO.md inteiro (regras da casa).
- Regras da casa que você DEVE seguir: não mexer em fontes, cores nem no texto central da página inicial; páginas e peças novas reaproveitam as que existem (tokens de cor do Tailwind do projeto como text-oxblood, bg-parchment, border-rule, text-gold, text-ink-soft; componentes como PageHeading, Cartaz); acessibilidade de verdade (teclado, foco visível, aria, contraste); nada de rastreador nem serviço de terceiros carregado no navegador (o Content-Security-Policy de next.config.ts só permite o próprio domínio e o serviço de contas — não afrouxe a política sem necessidade forte e justificada); sem "eval"/"new Function" para avaliar expressões digitadas (escreva um analisador seguro); todo arquivo novo começa com a linha de licença igual aos outros ("// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE)."); comentários curtos, em português, explicando o porquê, na densidade do código ao redor.
- Textos da interface pública vão em i18n/ nos CINCO idiomas (pt é a referência; en, es, zh, ru com tradução de verdade); \`npm run conferir:i18n\` precisa passar. Os tipos dos dicionários ficam em i18n/types (confira como são gerados/declarados).
- Toda conta e todo método explicado ao estudante precisa estar CERTO. Para cada ferramenta de cálculo, escreva conferências automáticas com muitos casos (incluindo bordas: divisão por zero, raízes complexas, entradas inválidas) e deixe-as no repositório como um script (por exemplo scripts/testar-ferramentas.mjs + "testar:ferramentas" no package.json), rodando a lógica pura das ferramentas (mantenha a lógica em módulos sem React, em lib/, para poder testar; Node 22 roda .ts sem dependências extras com --experimental-strip-types se o módulo não usar os atalhos "@/" — ou use o esbuild/tsx que estiverem disponíveis; o que importa é o script rodar com um comando simples e sem instalar nada novo no package.json, a não ser que valha muito a pena).

PORTAS (se precisar subir o site): \`npx next dev -p {{SITE}}\` (sem banco) ou \`LUCIA_BACKEND_PORTA={{BACKEND}} npm run dev:local -- {{SITE}}\` (com banco de teste; contas no começo de scripts/backend-local.mjs). O Chromium está em /opt/pw-browsers (Playwright configurado; NÃO rode "playwright install"). Pode instalar o pacote playwright numa pasta temporária fora do repositório (por exemplo /tmp/claude-0/pw-{{ID}}) para tirar capturas de tela e conferir no celular (360×740, e também no modo aplicativo — veja como o site detecta o app, procure a variante "app:" do Tailwind) e no computador. Olhe as capturas (a ferramenta Read abre imagens). Desligue os servidores que subir.

VERIFICAÇÃO OBRIGATÓRIA antes do commit final: \`npm run typecheck\`, \`npm run lint\`, \`npm run conferir:i18n\`, as suas conferências de ferramentas, \`npm run testar:banco\` se mexer no SQL, \`/tmp/claude-0/tools/validar.sh\` (valida content/ com as regras do build) e, uma vez no fim, \`npm run build\` (~2–3 min). Tudo tem de passar.

GIT
- Trabalhe no ramo {{RAMO}}. {{BASE}}
- Commits com mensagens no estilo do repositório ("Área: o que mudou", em português), terminando com:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RC8WhefzeEqi4x664juFrr
- NÃO faça push, NÃO faça merge em outros ramos. Ao terminar, o worktree deve estar limpo.

RELATÓRIO FINAL (é o valor de retorno): ramo, hash do último commit, o que foi feito, como foi verificado (com números: quantas conferências passaram), o que ficou de fora e por quê, decisões que o dono precisa conhecer, passos manuais de produção.
`
const prep = (txt, o) => txt.replaceAll('{{RAMO}}', o.ramo).replaceAll('{{BASE}}', o.base).replaceAll('{{BACKEND}}', o.backend).replaceAll('{{SITE}}', o.site).replaceAll('{{ID}}', o.id)

const C5A = `
TAREFA C5a — Caixa de ferramentas dentro das aulas + ferramentas de matemática e ciências.

O pedido do dono: "Aumentar ferramentas práticas. Verifica todos os cursos, disciplinas, etc e verifica qual seria cabível ter uma ferramenta prática ali. Lembrando que as ferramentas práticas devem estar disponíveis para uso enquanto o aluno estuda, seja num pop up sei lá, tipo ele tá numa aula agora que precisa de calculadora científica, ele não tem que sair da página e ir até a seção de ferramentas práticas, tem que estar ali disponível para ele."

Hoje: lib/areas.ts tem "tools" (ids) e "areaTools" (ferramentas por disciplina); as ferramentas moram em components/tools/ (CodeRunner, Music, Pronounce, Science) e têm página em app/[lang]/ferramentas/[tool]; a estante de cada disciplina lista as ferramentas dela.

1) CAIXA DE FERRAMENTAS (o principal): um botão fixo e discreto nas páginas de aula (e também na página da trilha e na estante da disciplina) que abre um painel com as ferramentas daquela disciplina, mais as universais (ao menos a calculadora científica). O painel NÃO é modal: a aula continua visível e rolável ao lado (painel lateral no computador; folha que sobe de baixo no celular, com altura ajustável, acima da barra de navegação de baixo e respeitando a área segura do aparelho e o modo aplicativo). As ferramentas carregam só quando a pessoa abre (import dinâmico), e o que ela digitou não se perde ao fechar e abrir de novo (mantenha montado depois da primeira abertura). Esc fecha, o foco volta ao botão, tudo funciona por teclado e leitor de tela. Guarde no navegador a última ferramenta usada por disciplina (lib/storage.ts tem o padrão de chaves). A aula pode sugerir ferramentas específicas por um campo opcional no cabeçalho (por exemplo "ferramentas: [resolvedor, graficos]"), validado em lib/content.ts contra a lista de ids (id inválido quebra o build, como os outros campos). Não atrapalhe a impressão da aula (no-print) nem o modo zine. Use o desenho do site (confira em celular e computador com capturas de tela).
2) AUDITORIA DAS DISCIPLINAS: percorra todas as disciplinas de lib/areas.ts (e os títulos das trilhas/aulas em content/trilhas) e ligue em areaTools cada ferramenta a todas as disciplinas em que ela é cabível (inclusive as existentes: python, php, calculadora etc.). Registre a tabela final no relatório.
3) FERRAMENTAS NOVAS DESTA TAREFA (cada uma com página em /ferramentas/<id>, nome e descrição nos 5 idiomas, e disponível na caixa):
   - Calculadora científica: veja a "calculadora" atual; se não for científica, transforme (sen/cos/tg em graus e radianos e inversas, log, ln, potência, raiz, fatorial, π, e, parênteses, memória, histórico), mantendo o id "calculadora" (não quebre links).
   - "resolvedor": resolve PASSO A PASSO, explicando cada passo em linguagem simples (é o que o dono chamou de "Photomath embutido" — o Photomath em si é um aplicativo fechado do Google e não pode ser embutido; esta é a alternativa livre): expressões numéricas com frações (com MMC e simplificação), porcentagem, regra de três simples, equação do 1º grau, equação do 2º grau (discriminante, Bhaskara, casos sem raiz real e raiz dupla, com raízes complexas mostradas quando o estudante pedir), sistemas 2×2 (substituição e adição). Entrada com um teclado matemático na tela além do teclado normal. Deixe um ponto de encaixe claro (um botão "Foto do exercício" escondido por padrão, controlado por uma propriedade ou função) porque a próxima tarefa vai ligar a leitura de foto pelo assistente.
   - "graficos": desenha funções y = f(x) (várias de uma vez, cores distintas e acessíveis, zoom e arrasto, grade, eixos, valores ao tocar, raízes e interseções aproximadas), em SVG ou canvas, sem bibliotecas externas.
   - "conversor-de-unidades": comprimento, área, volume, massa, tempo, temperatura, velocidade, energia, pressão, potência, dados digitais; mostra o fator e a conta feita.
   - "massa-molar": massa molar a partir da fórmula (parênteses, colchetes, hidratos com ·, coeficientes), usando lib/elementos.json; composição percentual. E "balanceamento": balanceia equações químicas (método algébrico/matriz com inteiros mínimos), explicando a conservação dos átomos e conferindo o resultado átomo por átomo; diz quando a equação não tem solução.
   - "punnett": quadro de Punnett para mono e di-hibridismo (e herança ligada ao X), com proporções genotípicas e fenotípicas e uma explicação curta.
   - "estatistica": média, mediana, moda, amplitude, variância e desvio-padrão (amostral e populacional, deixando claro qual), quartis, gráfico de barras/histograma; colar números separados por vírgula, ponto e vírgula, espaço ou quebra de linha (cuidado com o separador decimal em pt: aceite vírgula decimal).
   - "tabela-verdade": lógica proposicional (¬ ∧ ∨ → ↔ ⊕, com digitação alternativa por palavras/ASCII), monta a tabela, classifica tautologia/contradição/contingência.
   - "sistema-solar": tamanhos e distâncias em escala, peso da pessoa em cada planeta, tempo que a luz leva; dados com fonte citada na própria página (NASA Planetary Fact Sheet).
   Um analisador de expressões único e seguro (lib/) serve calculadora, gráficos e resolvedor.
4) Conferências automáticas (script no repositório) com muitos casos para cada ferramenta de cálculo, e conferência visual (capturas) da caixa aberta numa aula de matemática, numa de química e numa de biologia, no celular e no computador.
`

const C5B = `
TAREFA C5b — Mais ferramentas práticas, para as disciplinas que ainda não têm.

Comece lendo o relatório da tarefa anterior (C5a), que criou a caixa de ferramentas nas aulas e as ferramentas de ciências; você continua no mesmo padrão:
---- RELATÓRIO C5a ----
{{C5A}}
---- FIM ----

Ferramentas novas (cada uma com página em /ferramentas/<id>, nome e descrição nos 5 idiomas, ligadas em areaTools às disciplinas cabíveis e disponíveis na caixa das aulas). Confira cada dado e cada recomendação de saúde contra fonte confiável e cite a fonte na própria ferramenta quando houver número de referência:
   - "cronometro": Pomodoro (tempos ajustáveis) e cronômetro de prova do ENEM com os tempos oficiais de cada dia (confira no edital/portal do Inep a duração de cada dia), aviso sonoro opcional e sem notificação invasiva. Universal (toda disciplina) e principalmente ENEM.
   - "redacao": folha de redação no formato do ENEM (até 30 linhas; conte linhas aproximando o tamanho da linha da folha oficial e diga que é aproximação), contador de palavras, caracteres e parágrafos, roteiro das cinco competências com link para as aulas de redação existentes (content/trilhas/enem-redacao) — para português, literatura e ENEM.
   - "rcp": metrônomo para compressões torácicas (100–120 por minuto) com o passo a passo para leigos (ligar 192/SAMU, mãos no centro do peito, profundidade de 5 a 6 cm em adulto, deixar o peito voltar, não parar), conforme as diretrizes vigentes (American Heart Association/ILCOR e material do Ministério da Saúde) — com aviso claro de que não substitui um curso. Para primeiros socorros.
   - "escala-cartografica" (mapa ↔ real, escala numérica e gráfica, com a conta) e "fusos-horarios" (comparar horários entre cidades do Brasil e do mundo usando Intl, sem tabela fixa de deslocamentos) — para geografia.
   - "frequencia-cardiaca": frequência cardíaca máxima estimada (diga qual fórmula e a fonte; por exemplo Tanaka, 208 − 0,7 × idade) e zonas de treino, com aviso de saúde — para educação física.
   - "cores": roda de cores, harmonias (complementar, análogas, tríade), conversão HEX/RGB/HSL e conferência de contraste para leitura (WCAG) — para artes, design e desenho.
   - "mais-valia": calculadora didática do conceito de Marx: jornada de trabalho, tempo de trabalho necessário e excedente, salário (capital variável), valor novo produzido, taxa de mais-valia (m/v), com uma explicação curta e a fonte (O Capital, livro I, no Arquivo Marxista na Internet) — para marxismo, economia, capitalismo, trabalho, sindicalismo.
   - "html": um ateliê de HTML e CSS (e JavaScript, se o Content-Security-Policy permitir com segurança: estude next.config.ts; um iframe com sandbox e srcdoc é um caminho; se não for seguro, faça só HTML+CSS e explique) com a prévia ao lado — para informática, programação e design.
   - "silabario": para alfabetização: letras e famílias silábicas (BA BE BI BO BU…) que falam em voz alta ao tocar (síntese de voz do navegador; reaproveite lib/speech.ts se fizer sentido), montar palavras com sílabas — com letras grandes e botões fáceis de tocar.
   Avalie também se mais alguma disciplina precisa de uma ferramenta (por exemplo, idiomas: cartões de vocabulário com pronúncia) e faça se for cabível e der para fazer com qualidade.
Conferências automáticas para as contas (escala, fusos, frequência, cores/contraste, mais-valia) no script de conferências que a C5a deixou, e capturas de tela no celular e no computador.
`

const C4 = `
TAREFA C4 — Assistente de reforço automático (quando não há voluntário disponível) e leitura de foto no resolvedor.

O pedido do dono: "API de aula de reforço/respostas automáticas. Não sei se existe necessariamente uma API para isso, pode ser qualquer ferramenta que você consiga colocar que faça esse serviço. Tipo um assistente quando não tivermos um humano disponível." E também "Photomath embutido" — o Photomath é um aplicativo fechado do Google e não pode ser embutido; a tarefa C5a criou o "resolvedor" passo a passo, e você liga nele a leitura de uma foto do exercício.

Comece lendo os relatórios das tarefas anteriores:
---- RELATÓRIO C5a ----
{{C5A}}
---- RELATÓRIO C5b ----
{{C5B}}
---- FIM ----

Estude antes: a aula de reforço (app/[lang]/reforco, components/Tutoring.tsx, a tabela interno.reforco e suas funções em supabase/install.sql), a função de borda que já existe (supabase/functions/avaliar-comunidade: o padrão de segredos, CORS, chamada ao banco com a chave de serviço, "nasce desligada", teste de funcionamento pelo painel, e o documento docs/privacidade-avaliacao-automatica.md que só entra na página de privacidade no dia em que a função for ligada), a busca do site (lib/search.ts e o índice gerado em app/[lang]/indice.json).

1) RESPOSTAS AUTOMÁTICAS SEM IA (sempre funcionam, sem custo e sem mandar dado para fora): ao escrever a dúvida no reforço, o site mostra na hora "Aulas e verbetes que podem ajudar", usando o índice de busca local (aulas, glossário, acervo), filtrando pela disciplina escolhida. Isso vale com ou sem o assistente ligado.

2) ASSISTENTE COM IA (função de borda nova supabase/functions/assistente), DESLIGADO de nascença:
   - Usa a API do Claude pelo SDK oficial da Anthropic dentro do Deno: import Anthropic from "npm:@anthropic-ai/sdk@0.133.0" (versão fixa). Segredo ANTHROPIC_API_KEY (nunca aparece em resposta nem em registro). Modelo padrão "claude-opus-5-5", trocável pelo segredo opcional ASSISTENTE_MODELO (o dono decide se quer um modelo mais barato, como "claude-haiku-5-5"; diga isso no MANUTENCAO.md).
   - Chamada: client.beta.messages.create({ model, max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "medium" }, system, messages }). Não envie o parâmetro "thinking" (no claude-opus-5-5 o raciocínio é sempre adaptativo e { type: "disabled" } dá erro 400), não envie temperature/top_p/top_k (dão 400 nesse modelo), não use prefill de resposta. Sempre confira stop_reason antes de ler o conteúdo: "refusal" → resposta educada de que o assistente não pode ajudar com aquilo e que a pergunta pode ir para um voluntário; "max_tokens" → devolva o que veio com aviso. Leia só os blocos de tipo "text". Trate os erros pelas classes tipadas do SDK (Anthropic.RateLimitError, Anthropic.AuthenticationError, Anthropic.APIError…), nunca por comparação de texto. Instale o mesmo SDK numa pasta temporária fora do repositório (npm i @anthropic-ai/sdk@0.133.0 em /tmp/claude-0/sdk-c4) e confira nos tipos (.d.ts) que client.beta.messages.create aceita "betas", "fallbacks" e "output_config" e que o bloco de imagem é { type: "image", source: { type: "base64", media_type: "image/jpeg" | "image/webp" | "image/png", data } }; se algum campo não existir nos tipos dessa versão, ajuste de acordo com os tipos (sem gambiarra).
   - Prompt de sistema (em português, fixo, sem data nem nada que mude a cada pedido): é o assistente de estudos do Instituto Lúcia; explica passo a passo, com linguagem simples, dialogando como na educação popular (Paulo Freire), puxando o estudante a pensar em vez de só entregar a resposta, mas sem esconder a resposta quando ela é pedida; usa as aulas do próprio site que o navegador mandar como referência (título e endereço) e as recomenda; nunca inventa fonte nem link; diz quando não sabe; em saúde, direito e segurança dá orientação geral e manda procurar serviço/profissional (e 192/SAMU em emergência); não pede nem guarda dados pessoais. Formato: Markdown simples, que o site já sabe mostrar (veja components/Markdown.tsx), sem HTML.
   - Entradas aceitas: pergunta (texto, com limite de tamanho), disciplina, até umas 5 aulas sugeridas pelo navegador (título + caminho, validados como caminhos do próprio site), e opcionalmente UMA imagem (foto do exercício), redesenhada e reduzida no navegador antes de sair (reaproveite cleanImage de lib/upload.ts, que tira os dados embutidos da foto) e com limite de tamanho.
   - Quem usa e quanto: exige conta (participante da comunidade já serve) e respeita banimentos e a pausa; limites no banco (função pública chamada pela função de borda com a sessão de quem pediu, no padrão de avaliar-comunidade): por pessoa por dia e um teto geral por dia, ambos configuráveis pela coordenação; a função de borda só chama a API depois do "sim" do banco. Nenhuma pergunta nem resposta é guardada no banco: só os contadores.
   - Painel (Controles do site, no padrão do cartão da moderação): ligar/desligar, limites, "testar funcionamento" (chamada real com um texto fixo e inofensivo, guardando só se deu certo e o tipo de falha), estado (habilitado no banco? a função respondeu ao teste? usos hoje). Só coordenação e vice.
   - No site: na página de reforço, quando o assistente está ligado, um quadro "Sem voluntário agora? Pergunte ao assistente" com aviso claro ANTES do envio de que a pergunta (e a foto, se houver) vai para um serviço de inteligência artificial de outra empresa (Anthropic) e não deve conter dados pessoais; resposta mostrada como Markdown, com aviso de que pode errar e com o botão para mandar a dúvida a um voluntário (o pedido de reforço de sempre). Quando desligado, o quadro não aparece (só as sugestões locais do item 1).
   - No resolvedor (criado na C5a): ligue o botão "Foto do exercício" — só aparece com o assistente ligado e a pessoa logada; manda a foto pedindo para transcrever o exercício e resolver passo a passo; se a transcrição for uma equação que o resolvedor local entende, ofereça também resolver localmente.
   - Privacidade: escreva docs/privacidade-assistente.md no padrão de docs/privacidade-avaliacao-automatica.md (o texto que entra em content/paginas/privacidade.md no dia em que for ligado), e NÃO mude a página de privacidade agora, já que nasce desligado. Documente em docs/MANUTENCAO.md: como publicar a função (supabase functions deploy assistente), os segredos, como ligar, quanto pode custar e como limitar.
   - CSP: a função de borda fica no mesmo endereço do serviço de contas, que já está em connect-src; confira.
3) Testes: no testar-banco, os limites e permissões (anônimo não usa, banido não usa, limite por pessoa e geral, desligado recusa, só coordenação/vice configuram). Para a função de borda, separe a lógica pura (montar o pedido, validar entradas, interpretar a resposta e stop_reason) num módulo .mjs testável com Node, como avaliar-comunidade faz com moderacao.mjs, e teste com respostas simuladas (sem chave, não chame a API de verdade). Confira a interface no site de teste (o assistente desligado não aparece; ligado, aparece com o aviso; as sugestões locais aparecem enquanto se digita).
`

phase('C5a Caixa')
const a = await agent(prep(COMUM, { ramo: 'wf/c5a-ferramentas', base: 'Crie o ramo a partir do HEAD atual: git checkout -b wf/c5a-ferramentas.', backend: '54411', site: '3411', id: 'c5a' }) + C5A, { label: 'C5a caixa de ferramentas', phase: 'C5a Caixa', isolation: 'worktree' })
log('C5a terminou')
phase('C5b Ferramentas')
const b = await agent(prep(COMUM, { ramo: 'wf/c5b-ferramentas', base: 'Continue o ramo wf/c5a-ferramentas: git checkout -b wf/c5b-ferramentas wf/c5a-ferramentas. Se ele não existir, pare e relate.', backend: '54412', site: '3412', id: 'c5b' }) + C5B.replace('{{C5A}}', String(a ?? '(sem relatório)')), { label: 'C5b mais ferramentas', phase: 'C5b Ferramentas', isolation: 'worktree' })
log('C5b terminou')
phase('C4 Assistente')
const c = await agent(prep(COMUM, { ramo: 'wf/c4-assistente', base: 'Continue o ramo wf/c5b-ferramentas: git checkout -b wf/c4-assistente wf/c5b-ferramentas. Se ele não existir, pare e relate.', backend: '54413', site: '3413', id: 'c4' }) + C4.replace('{{C5A}}', String(a ?? '(sem relatório)')).replace('{{C5B}}', String(b ?? '(sem relatório)')), { label: 'C4 assistente', phase: 'C4 Assistente', isolation: 'worktree' })
return { c5a: a, c5b: b, c4: c }
