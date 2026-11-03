# Banco da Escola Lúcia Maria (E4-02)

Pacote da onda 1 da Etapa 4. Ideias D1-14 (presença somada) e R1-91 ("Isso ajudou?" somado). Só acréscimo no banco:
nenhuma função que já existia foi redefinida (`contar`, `turma_mes`, `turma_mes_entrar`, `erro_relatar`,
`aulas_funcionam`, `jornal_mais_lidas` e `interno.limite` ficam como estavam).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `supabase/migracoes/2026-11-escola.sql` | A migração. O mesmo bloco está no fim de `supabase/install.sql` (o teste confere). |
| `lib/escola/contagem-local.ts` | Puro: `chaveDoPeriodo`, `deveContar`, `marcar`, `lerMarcas`. Marcas em `lucia:escola:contou`, no máximo 300. |
| `lib/escola/banco.ts` | O que o navegador pede ao banco (lista abaixo). |
| `components/escola/PresencaSomada.tsx` | D1-14. Quem monta: E4-08 (entrada) e E4-09 (quadro de avisos). |
| `i18n/escola/presenca/*.json` | Textos da presença nos 6 idiomas. |
| `components/estudo/IssoAjudou.tsx` | R1-91: com `ligado("escola")`, a primeira resposta soma +1 anônimo. |
| `i18n/estudo/*.json` | Chave nova `ajudou.soma`. |
| `scripts/alvos-de-contagem.mjs` | `alvosDaEscola()` e o filtro que ignora `*.facil.md`. |
| `content/paginas/privacidade.md` | Frase honesta em "Se você só estuda", seção "Escola Lúcia Maria" e o link para `/modo-seguro`. |
| `scripts/testar-escola-banco.mjs` | Teste do banco, das marcas e da lista de alvos. |
| `e2e/escola-presenca.spec.ts` | Serviço fora: nada aparece e não há erro no console. |

## Banco

### Por que o alvo nunca entra na chave do freio

`interno.limite` grava em `interno.limites` a chave `'<acao>:' || coalesce(conta, md5('lucia:' || endereço))` por até
dois dias. O md5 não tem sal; um endereço IPv4 se recupera por tentativa (são 2^32 possibilidades). O `contar` antigo
usa `'contar:' || tipo || ':' || alvo`, o que liga a origem à aula. Nas funções novas a chave é só
`contar_escola:<tipo>` e `contar_escola` (e `turma_curso_entrar`, `ouvidoria_enviar`): o banco pode saber que uma origem
votou num minuto, nunca em quê, e nunca que uma origem se interessou por um curso de formação política.

### Tabelas (todas em `interno`, com segurança por linha e sem permissão direta)

- `contagens_escola (tipo, alvo, dia, total)`: tipos `escola_presenca`, `escola_matricula`, `escola_formatura`,
  `escola_turma`, `assembleia_voto`. Alvo `^[a-z0-9/._-]{1,160}$`. Dia no fuso de Brasília.
- `escola_alvos (grupo, alvo)`: grupos `curso` (cursos e `escola`), `curso-sensivel`, `assembleia` (`AAAA.S/trilha`).
- `turmas_curso (mes, curso, usuario, entrou_em, consentiu_sensivel)` e `turmas_curso_salas (mes, curso, sala)`.
- `ouvidoria (id, sobre, caminho, texto, contato, status, resumo_publico, resposta_publica, publicar, respondida_em, criado_em)`.
  Sem coluna de conta nem de endereço de rede.

`turmas_curso` e `ouvidoria` têm o gatilho `lucia_pausa` (a função `interno.pausa()` que já existia): com os envios do
público pausados pela coordenação, ou de uma origem barrada pela mediação, não entra linha nova. Sair da turma (apagar)
nunca é barrado.

### Funções

| Função | Quem | O que faz |
|---|---|---|
| `contar_escola(p_tipo, p_alvo)` | todos | Soma 1 no dia. Devolve sempre `{}`. Tipo ou alvo inválido, ou alvo fora da lista do grupo: não grava. Freio 5/min por tipo e 120/min no total, por origem ou conta. |
| `escola_contagens(p_tipo, p_dias=30, p_prefixo=null)` | todos | `[{alvo, total}]` dos últimos 1 a 400 dias, em ordem de alvo (nunca por total). `p_prefixo` `'AAAA.S/'` filtra a assembleia. |
| `escola_presenca_hoje()` | todos | `{aulas_hoje, aulas_terminadas_7d, matriculas_mes}`. Lê `interno.contagens` (só leitura) e `contagens_escola`. |
| `escola_alvos_definir(p_grupo, p_alvos)` | só serviço | Troca a lista de um grupo (cópia do padrão de `contagens_alvos_definir`). |
| `turma_curso(p_mes, p_curso)` | todos | `{inscritos, eu, sala, sensivel}`. A sala só para quem entrou; sem conta, `eu=false`. |
| `turma_curso_entrar(p_mes, p_curso, p_entrar, p_consentimento=false)` | conta | Entrar: só mês atual ou seguinte (Brasília), curso na lista (lista vazia: só o formato), área `estudo` aberta, freio 30/h. Curso sensível sem `p_consentimento=true`: erro `consentimento`. Sair (`p_entrar=false`): apaga a linha, em qualquer mês. Primeira inscrição sorteia a sala `InstitutoLucia-Curso-<10 hex>`. |
| `turmas_curso_minhas()` | todos | `[{mes, curso}]` da conta logada; sem conta, `[]`. |
| `ouvidoria_enviar(p)` | todos | Campo-isca `site`; área `estudo` aberta; freio 4/h; `sobre` em aula/curso/educador/escola/outro; `texto` 10 a 3000; `caminho` opcional `^/[a-z0-9/._-]{0,199}$`; `contato` até 200. Devolve `{ok, protocolo}` (8 primeiros caracteres do id). |
| `ouvidoria_fila()` | coordenação, vice ou mediação | Último ano, até 500, com `protocolo`. |
| `ouvidoria_responder(p_id, p_status, p_resumo, p_resposta, p_publicar)` | coordenação, vice ou mediação | Publicar exige resumo e resposta. `respondida` marca a data. Anota no registro (`ouvidoria_respondida`, só o protocolo). |
| `ouvidoria_publicas()` | todos | `[{protocolo, sobre, resumo_publico, resposta_publica, respondida_em}]`, publicadas e respondidas nos últimos 2 anos, até 200. Nunca texto, contato nem caminho. |

Códigos de recusa: `entre_primeiro`, `conta_suspensa`, `invalido:mes`, `invalido:curso`, `consentimento`,
`area_interditada`, `envios_pausados`, `acesso_bloqueado`, `muitos_pedidos`, `invalido:sobre`, `invalido:caminho`,
`invalido:texto`, `invalido:contato`, `sem_permissao`, `invalido:status`, `invalido:resumo`, `invalido:resposta`,
`invalido:publicar`, `nao_encontrado`.

### Rotinas (pg_cron, só se a extensão existir)

- `lucia-turmas-curso-faxina` (05:23 todo dia): apaga turmas e salas de meses com mais de 13 meses.
- `lucia-ouvidoria-faxina` (05:29 todo dia): texto e contato viram `''` depois de 365 dias. O resumo e a resposta públicos ficam.

A Turma do mês (`turmas_mes`) não tem rotina de faxina hoje; a das turmas por curso foi criada mesmo assim, porque o
vínculo com um curso sensível é dado sensível e não deve ficar para sempre.

O expurgo (`interno.areas_expurgo`) não ganhou a ouvidoria: ele limpa o que o público publica nas áreas abertas, e a
ouvidoria não publica nada do público (só o resumo da mediação), tem freio próprio e fila da mediação. Acrescentá-la
exigiria redefinir `areas_expurgo` e `expurgo_aplicar`, que este pacote não muda.

## Cliente (`lib/escola/banco.ts`)

- `contarEscola(tipo, alvo, periodo)`: uma vez por período (`dia`, `mes`, `semestre`) e aparelho. Grava a marca antes
  do pedido; sem armazenamento, não conta (não teria como segurar a repetição). Engole erros.
- `jaContou(tipo, alvo, periodo)`: para a tela dizer "seu voto já foi somado".
- `lerContagensEscola(tipo, dias?, prefixo?)`: `[]` sem serviço ou com falha.
- `presencaHoje()`: um pedido por visita (memória do módulo); `null` sem serviço ou com falha.
- `turmaDoCurso(mes, curso)`: `null` sem serviço ou com falha.
- `entrarNaTurmaDoCurso(mes, curso, entrar, consentimento?)`: `null` sem serviço; recusa do banco lança `BackendError`
  com o código (a tela de E4-15 explica `entre_primeiro` e `consentimento`).
- `minhasTurmasDeCurso()`: `[]` sem serviço, sem conta ou com falha.
- `ouvidoriaEnviar(dados)`: `null` sem serviço; recusa lança `BackendError`.
- `ouvidoriaPublicas()`: `[]` sem serviço ou com falha.

As marcas (`lucia:escola:contou`) são `tipo|alvo|período` (`d2026-11-03`, `m2026-11`, `s2026.2`, no relógio do
aparelho). Cada marca nova tira as de período que já passou; ficam as 300 mais novas.

## Presença somada (D1-14)

`<PresencaSomada s={textos} lang={lang} />`, de cliente. Os textos vêm de `i18n/escola/presenca/<lang>.json`, lidos no
servidor (por exemplo com `escolher` de `lib/escola/textos.ts`, do E4-01) e passados por props. Frases: "Hoje, {n} aulas
foram abertas na Escola", "Nos últimos 7 dias, {n} aulas foram terminadas", "Este mês, {n} matrículas", com singular
escolhido por `Intl.PluralRules` e números por `Intl.NumberFormat` do idioma. Sem serviço, não ocupa espaço. Com serviço,
reserva a altura de três linhas (`min-h-28`) desde o primeiro desenho; linha com zero não aparece; tudo zero ou falha
deixa o espaço vazio, sem pulo.

O número "aulas abertas" vem de `contar('aula_abriu')`, que soma todas as aulas do site, não só as dos cursos.

## "Isso ajudou?" somado (R1-91)

Só com `ligado("escola")` e o serviço no ar. A primeira resposta de cada aula chama `contar` com `aula_ajudou` ("Ajudou")
ou `aula_nao_ajudou` ("Em parte" e "Não ajudou": as duas dizem que a aula precisa melhorar). A marca fica em
`lucia:ajudou-contou:<aula>` (lista "só apagar" do E4-01); trocar ou desmarcar a resposta não soma de novo. Sem
armazenamento, conta assim mesmo, como `contarUmaVez` da barra da aula. Antes do clique aparece `ajudou.soma`; com a
soma ligada, a frase antiga "fica só neste aparelho" (`ajudou.obrigado`) deixa de aparecer, porque não seria verdade. A
equipe vê a soma em `components/painel/RetornoDosAlunos.tsx` (`aulas_funcionam`). O banco não mudou: os dois tipos já
existiam no `contar`.

## Lista de alvos (`scripts/alvos-de-contagem.mjs`)

`alvosDaEscola(base)` devolve só os grupos que têm arquivo: `curso` (slugs de `content/escola/cursos/*.json`, mais
`escola`), `curso-sensivel` (os de `"sensivel": true`) e `assembleia` (`<semestre>/<trilha>` de
`content/escola/assembleia.json`). Curso com JSON estragado fica de fora, com aviso. Grupo presente é mandado mesmo
vazio (um curso que deixa de ser sensível precisa sair da lista sensível). `--mostrar` mostra quantos acharia.
O filtro de originais passou a ignorar `*.facil.md` (versões fáceis do E4-03): a expressão de idioma não as pegava, e
`aula.facil` virava alvo.

## Testes

- `npm run testar:escola-banco` (script reservado pelo E4-01; enquanto não estiver no package.json:
  `node --import ./scripts/carregar-ts.mjs scripts/testar-escola-banco.mjs`): 82 conferências.
- `npm run testar:banco` inteiro continua passando (1739 conferências), prova de que nada antigo mudou.
- `e2e/escola-presenca.spec.ts`: com `NEXT_PUBLIC_RECURSOS=escola npm run dev:local`.

## Produção (com a coordenação)

1. Abrir o SQL Editor do Supabase e colar o conteúdo inteiro de `supabase/migracoes/2026-11-escola.sql`. Pode rodar mais
   de uma vez.
2. Conferir: `select proname from pg_proc where proname in ('contar_escola', 'escola_presenca_hoje', 'turma_curso_entrar', 'ouvidoria_enviar');`
   (4 linhas) e `select jobname from cron.job where jobname like 'lucia-%faxina';` (inclui as duas novas).
3. Na publicação seguinte, `node scripts/alvos-de-contagem.mjs` manda as listas da Escola (precisa de `SUPABASE_URL` e
   `SUPABASE_SERVICE_ROLE_KEY`, como hoje).

Pendência fora desta etapa: o `contar` antigo grava `contar:<tipo>:<aula>` com o código da origem por dois dias (o mesmo
problema descrito acima, para aulas, "Isso ajudou?" e jornal). A correção seria igual à daqui (chave sem o alvo), mas
muda o comportamento de uma função existente; fica para a coordenação decidir. A página de privacidade já descreve isso
como está hoje.
