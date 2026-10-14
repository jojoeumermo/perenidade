export const meta = {
  name: 'cabecalho-historico-falacias',
  description: 'Código: cabeçalho (notícias no app, Olá nome) + histórico só pedagógico (C6) e guia das falácias + ferramentas de checagem (C7), em paralelo',
  phases: [{ title: 'Código', detail: 'C6 e C7 em worktrees próprios' }],
}

const COMUM = `
Você trabalha no repositório do Instituto Lúcia (escola e biblioteca comunitária gratuita; Next.js 16 + React 19 + Tailwind 4 + Supabase). Você está num git worktree isolado (seu diretório atual). Tudo o que aparece no site é em português do Brasil, com tradução para en, es, zh, ru.

ANTES DE COMEÇAR
- Rode \`npm ci\` no seu worktree.
- Leia docs/MANUTENCAO.md inteiro (regras da casa). Regras que você DEVE seguir: não mexer em fontes, cores nem no texto central da página inicial; peças novas reaproveitam as existentes; acessibilidade; nada de serviço de terceiros carregado no navegador (CSP em next.config.ts); fontes citadas em todo conteúdo, nada inventado; sobre pessoas vivas, partidos e empresas só fatos documentados e linguagem sóbria; todo arquivo novo começa com a linha de licença igual aos outros; comentários curtos em português na densidade do código ao redor.
- Textos da interface pública em i18n/ nos CINCO idiomas (pt, en, es, zh, ru), com tradução de verdade; \`npm run conferir:i18n\` precisa passar. Ao acrescentar chaves no topo dos dicionários, ponha o bloco novo logo depois da chave indicada na sua tarefa (para não colidir com outras tarefas que também mexem nos dicionários).

PORTAS: \`npx next dev -p {{SITE}}\` (sem banco) ou \`LUCIA_BACKEND_PORTA={{BACKEND}} npm run dev:local -- {{SITE}}\` (com banco de teste; contas no começo de scripts/backend-local.mjs). Chromium em /opt/pw-browsers (Playwright configurado; NÃO rode "playwright install"); pode instalar o pacote playwright numa pasta temporária fora do repositório (/tmp/claude-0/pw-{{ID}}) e tirar capturas de tela (a ferramenta Read abre imagens). Desligue os servidores que subir.

VERIFICAÇÃO OBRIGATÓRIA antes do commit final: \`npm run typecheck\`, \`npm run lint\`, \`npm run conferir:i18n\`, \`/tmp/claude-0/tools/validar.sh\` (valida content/ com as regras do build em ~2 s) e, no fim, \`npm run build\`. Tudo tem de passar.

GIT: trabalhe no ramo {{RAMO}} (git checkout -b {{RAMO}} a partir do HEAD atual). Commits no estilo do repositório ("Área: o que mudou"), terminando com:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RC8WhefzeEqi4x664juFrr
NÃO faça push nem merge. Worktree limpo ao terminar.

RELATÓRIO FINAL (valor de retorno): ramo, hash do último commit, o que foi feito, como foi verificado, o que ficou de fora e por quê.
`
const prep = (txt, o) => txt.replaceAll('{{RAMO}}', o.ramo).replaceAll('{{BACKEND}}', o.backend).replaceAll('{{SITE}}', o.site).replaceAll('{{ID}}', o.id)

const C6 = `
TAREFA C6 — Cabeçalho e histórico do acervo.

1) GIRO DE NOTÍCIAS DE VOLTA NO APP: o dono disse "o botão sumiu da header ao lado do ícone do rádio no aplicativo do celular". Em components/Header.tsx o NewsLink está dentro de um <span className="contents max-lg:hidden"> junto com o seletor de idioma, por isso some em telas pequenas e no app. Ponha o NewsLink de volta ao lado do RadioLink no celular e no aplicativo (o seletor de idioma pode continuar escondido no celular, como está). Confira que no celular estreito (360 px) e no modo aplicativo (procure a variante "app:" e como o site sabe que está no app — lib/device.ts, globals.css) o cabeçalho cabe numa linha sem cortar nada, junto com o item da conta do item 2. Atualize o comentário do Header que diz que as notícias saem da barra.

2) "OLÁ, NOME" NO LUGAR DE "PAINEL": hoje AccountLink (components/NavLinks.tsx) mostra "Entrar" ou "Painel". O dono quer: depois de entrar, onde está "Painel" aparece "Olá, [nome do usuário]", mas continuando claro que o painel é ali. Faça: para quem tem sessão, "Olá, Primeironome" (só o primeiro nome, truncado se for longo) com uma indicação discreta de que leva ao painel (por exemplo um pequeno rótulo "painel" ou ícone, e aria-label/title "Abrir o painel"). O nome vem da conta (useMe em lib/backend.ts chama a função "eu"); para não piscar a cada página, guarde o primeiro nome no navegador (use o padrão de chaves de lib/storage.ts) depois de carregar, mostre o guardado de imediato e atualize quando chegar; apague ao sair (signOut). Sem conta ou sem nome carregado ainda: mostre "Painel" como hoje. Textos novos nos 5 idiomas, dentro do objeto "nav" (logo depois da chave "panel"). Confira com o banco de teste local: entre com coord@local e veja "Olá, Jonathan" no computador, no celular e no modo aplicativo (capturas de tela).

3) HISTÓRICO DO ACERVO SEM PROCESSOS INTERNOS: o dono disse "O histórico do acervo está expondo informações sensíveis demais. Tipo quando dou um merge no GitHub. É para mostrar só coisas em relação ao pedagógico, acervo, murais, jornais, etc. Não os processos internos." Hoje lib/history.ts lê o git log de content/ e mostra o assunto de cada commit (com um filtro de palavras); aparecem commits de merge ("Merge branch…", "Merge pull request #…") e assuntos de commits que mexeram em content/ mas falam de funcionamento interno. Refaça:
   - ignore commits de merge (--no-merges) e conte só arquivos de conteúdo pedagógico e público: trilhas/aulas, acervo, catálogo, autores, memorial, glossário, jornal/notícias, checagens, debates, vídeos, galeria, frases, perguntas, por onde começar, rádios e outras coleções públicas que existirem (e as que outras tarefas estão criando: content/falacias). Fora: páginas institucionais e legais (content/paginas/privacidade.md, termos.md), content/abertura.json, content/busca.json e qualquer coisa de funcionamento.
   - não mostre mais o assunto do commit cru (é o que vaza processo interno): mostre um resumo GERADO a partir dos arquivos, por categoria e tipo de mudança (por exemplo "12 obras novas no acervo · 3 verbetes atualizados no glossário · 2 aulas novas em Geografia"), usando git log --name-status para saber o que foi acrescentado (A), mudado (M) ou retirado (D), com os textos nos 5 idiomas (objeto "history" dos dicionários; plural certo). As aulas novas podem ter os títulos listados (lidos do conteúdo), limitado a alguns. Nada de nome de autor do commit, hash nem e-mail.
   - commits que só mexeram em arquivos de fora ficam de fora.
   - confira onde mais o histórico aparece (a página inicial mostra as novidades? procure usos de publicHistory/getHistory) e ajuste igual. fileHistory (data de atualização de cada aula) continua funcionando.
   - lembre: em clones rasos o histórico é curto (comentário existente).
   Confira rodando o build e olhando a página /historico com a captura de tela: nada de "Merge", nada de assunto interno.
`

const C7 = `
TAREFA C7 — Guia das falácias e ferramentas de checagem de fatos.

1) GUIA DAS FALÁCIAS (pedido do dono: "Aumentar cartões de debate e incluir um guia das falácias"): uma coleção nova de conteúdo content/falacias/<slug>.md, com carregador em lib/content.ts no mesmo padrão das outras (campos validados no build: nome, nome em latim ou inglês quando houver, resumo de uma linha, e no corpo: o que é, um exemplo do dia a dia e um exemplo do debate público brasileiro — sóbrio, sem atacar pessoa viva nem partido pelo nome —, como responder; fontes obrigatórias, com fontes reais e abertas que você confirme pela busca na web, por exemplo a Internet Encyclopedia of Philosophy (iep.utm.edu/fallacy), a Stanford Encyclopedia of Philosophy (plato.stanford.edu/entries/fallacies), livros abertos de lógica como o forall x, materiais universitários abertos). Escreva cerca de 30 falácias (ad hominem, espantalho, falso dilema, ladeira escorregadia, apelo à autoridade, apelo à maioria, generalização apressada, post hoc, falsa equivalência, tu quoque/"e o fulano?", petição de princípio, pista falsa, apelo à emoção, apelo à natureza, nenhum escocês de verdade, composição e divisão, escolha a dedo (cherry picking), inversão do ônus da prova, apelo à ignorância, causa única, falácia do jogador, falsa analogia, apelo à tradição, apelo à novidade, envenenamento do poço, culpa por associação, galope de Gish, mover as traves, pergunta complexa, equívoco/ambiguidade, evidência anedótica, falácia genética). Página /falacias ("Guia das falácias") no desenho das páginas de cartaz do site (reaproveite Cartaz, PageHeading e as listas de /debates e /glossario), com índice, filtro por busca e âncoras; entrada em /explorar (no array de itens, logo depois de debates), na busca do site (lib/search.ts / app/[lang]/indice.json: inclua as falácias no índice) e em sitemap se houver. Na página /debates, um chamado no topo "Antes de debater: conheça as falácias" levando ao guia. Os cartões de debate (content/debates) ganham um campo opcional "falacias: [slugs]" validado no build (slug inexistente quebra o build) e mostram "Falácias neste argumento" com links — preencha nos cartões existentes onde for honesto.
   i18n: novo objeto no topo dos dicionários chamado "fallacies", logo depois do objeto "debates"; e nav.fallacies logo depois da chave "debates" dentro de "nav". O conteúdo das falácias pode ficar só em português (o site mostra o original com aviso de não traduzido, como as outras coleções) — mas a interface da página nos 5 idiomas.

2) FERRAMENTAS DE CHECAGEM (pedido: "Aumentar checagem de fatos e ferramentas que ajudem, está muito enxuto"): na página /checagens (e em subpáginas se fizer sentido), acrescente:
   - "Como checar em 6 passos": um roteiro interativo (componente cliente, estado só local, sem enviar nada) em que a pessoa cola a alegação e vai marcando os passos (quem diz, qual a fonte original, data, outras fontes confirmam, a imagem/vídeo é daquele contexto, o que os checadores dizem), com o resultado sugerido no fim e um botão de copiar o resumo.
   - "Caixa de ferramentas de checagem": links organizados por tipo — busca reversa de imagem (Google Lens, TinEye, Bing Visual Search, Yandex), vídeo (InVID-WeVerify), páginas antigas (Wayback Machine, archive.today), agências brasileiras de checagem (Agência Lupa, Aos Fatos, Fato ou Fake, Estadão Verifica, UOL Confere, Projeto Comprova, Boatos.org, E-farsas), buscador de checagens (Google Fact Check Explorer), dados oficiais (IBGE, Portal da Transparência, TSE/Divulgação de Candidaturas, DATASUS/TabNet, Diário Oficial da União, Câmara e Senado), quem é dono do site (Registro.br WHOIS), guias (Bellingcat). CONFIRME pela busca na web que cada endereço existe e está atual antes de pôr (não invente endereço); só links simples, nada carregado de fora.
   - O selo de cada veredito (Falso, Enganoso, Falta contexto, Verdadeiro) explicado.
   i18n: os textos novos dentro do objeto "factCheck" já existente, nos 5 idiomas.
   Obs.: outra tarefa está acrescentando checagens e cartões de debate novos em content/checagens e content/debates ao mesmo tempo — NÃO crie arquivos novos nessas duas pastas; só edite os cartões de debate existentes para o campo "falacias".

Confira com capturas de tela (/falacias, /debates, /checagens) no celular e no computador.
`

phase('Código')
const res = await parallel([
  () => agent(prep(COMUM, { ramo: 'wf/c6-cabecalho', backend: '54421', site: '3421', id: 'c6' }) + C6, { label: 'C6 cabeçalho e histórico', phase: 'Código', isolation: 'worktree' }),
  () => agent(prep(COMUM, { ramo: 'wf/c7-falacias', backend: '54422', site: '3422', id: 'c7' }) + C7, { label: 'C7 falácias e checagem', phase: 'Código', isolation: 'worktree' }),
])
return { c6: res[0], c7: res[1] }
