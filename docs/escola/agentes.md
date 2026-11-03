# Agentes de trabalho, turma e equipe (E4-16)

Pacote da onda 3 da Etapa 4. Entrega as TELAS dos agentes sobre o assistente que já existe (`supabase/functions/assistente`,
`lib/backend.ts`, docs/escola/acompanhante.md). O backend já aceitava os modos `entrevista`, `oratoria`, `papelada`, `turma` e
`educador`; **nada nele mudou** (nem `install.sql`, nem `testar-assistente.mjs`). Rota: `/escola/agentes` (hub) e
`/escola/agentes/<agente>` com 7 agentes, porque o E4-10 deixou `/escola/acompanhante` só com dúvida, pista, redação, documento e idioma.

## Os 7 agentes

| Agente | Rota | Servidor? | O que faz |
|---|---|---|---|
| Ensaio de entrevista | `/escola/agentes/entrevista` | sim (`entrevista`) | 5 perguntas para a vaga, uma por vez, com retorno gentil e sem nota. Contador local "Pergunta n de 5". |
| Ensaio de oratória | `/escola/agentes/oratoria` | sim (`oratoria`) | Fala por microfone (opcional) ou texto, cronômetro, ritmo medido no aparelho, comentário de clareza e estrutura. |
| Ajudante de papelada | `/escola/agentes/papelada` | sim (`papelada`) | Lista e explica os campos de um formulário EM BRANCO (foto riscada ou texto colado). Não preenche nada. |
| Agente da turma | `/escola/agentes/turma` | sim (`turma`) | De uma aula do índice leve saem de 4 a 6 perguntas abertas de debate. |
| Agente do educador | `/escola/agentes/educador` | sim (`educador`) | Rascunho de aula no modelo de 6 partes, sempre "em revisão" e sem marca de autor. |
| Revisão de conteúdo | `/escola/agentes/revisao` | **não** | Links, fontes e modelo de aula, só regras, 100% no aparelho. |
| Tradutor supervisionado | `/escola/agentes/traducao` | **não** | A pessoa traduz; o aparelho confere números, endereços, parágrafos e termos protegidos. |

## Arquivos

| Arquivo | O que faz |
|---|---|
| `lib/escola/agentes.ts` | Puro (roda no Node, sem `@/`, sem `fs`): `AGENTES`, `agenteDe`, `LIMITES_DOS_AGENTES`, `etapaDaEntrevista`, `contextoDaEntrevista`, `analisarFala`, `palavrasQueSeRepetem`, ensaios (`lerEnsaios`, `gravarEnsaio`, `apagarEnsaios`, `CHAVE_ENSAIOS`), `achaDadoPessoal`, `conferirCampo`, `resumoDaAula`, `levarRascunho`, `pegarRascunho`. |
| `lib/escola/revisao-de-texto.ts` | Puro: `revisarConteudo` e `conferirTraducao` (+ `podeCopiarTraducao`, `copiarComMarca`). |
| `lib/escola/acompanhante.ts` | Edição aditiva: `MODOS_DOS_AGENTES`, `ModoDeAgente`, `ModoDeConversa`; o validador de conversa e o `montarPedido` aceitam os 10 modos. `MODOS_DO_ACOMPANHANTE` e `ModoDoAcompanhante` não mudaram. |
| `components/escola/acompanhante/Conversa.tsx` | Edição aditiva: tipo do modo; props opcionais `encerrarQuando` e `conferirTexto`; o `extraNoCampo` recebe também o texto de agora (2º argumento). Sem as props, o comportamento é o de antes. |
| `components/escola/acompanhante/Escolha.tsx` | Nome do modo com fallback para o próprio modo. |
| `app/[lang]/escola/acompanhante/page.tsx` | Um parágrafo com link para `/escola/agentes`. |
| `components/escola/agentes/*.tsx` | `Hub`, `Moldura` (servidor), `Entrevista`, `Oratoria`, `MicrofoneDeFala`, `Papelada`, `DebateDaTurma`, `RascunhoDoEducador`, `RevisaoDeConteudo`, `TraducaoSupervisionada`, `conferir.ts`. |
| `app/[lang]/escola/agentes/page.tsx` e `[agente]/page.tsx` | O hub e a página dinâmica com `generateStaticParams` dos 7 agentes (`dynamicParams = false`). |
| `i18n/escola/agentes/{index.ts,pt,en,es,fr,ru,zh}.json` | Textos nos 6 idiomas. Chaves novas também em `i18n/escola/acompanhante/*.json`: `hub.nomesDosModos` (5 modos) e `comum.itens` (`vaga`, `fala`, `formulario`, `resumo`, `tema`). |
| `scripts/testar-agentes.mjs` | `npm run testar:agentes` (o script já estava reservado no `package.json`). |
| `e2e/escola-agentes.spec.ts` | Com a função `assistente` simulada por rota interceptada. |

As rotas novas ficam abaixo de `/escola`, que já está em `lib/interdicao.ts` (área "estudo"): não houve linha nova lá.
Nenhum CSS novo: só as classes `acompanhante-*` e tokens que já existem.

## O que vai ao servidor, e o aviso antes do botão

Os 5 agentes que usam o assistente usam a `Conversa` do E4-10: antes do botão, `AvisoDoQueVai` diz o que vai (a vaga, o texto da
fala, o texto do formulário, o título e o resumo da aula, o tema, a foto riscada, as últimas falas), com o selo de provedor de
inteligência artificial fora do Brasil e o link "Como funciona". Só envia ao apertar. O servidor do Instituto não guarda a pergunta,
a foto nem a resposta. O histórico fica só no aparelho, em `lucia:escola-privado:conversas` (20 conversas, 30 dias, fora da cópia,
nada no modo seguro), e é o mesmo histórico do acompanhante: `validarConversa` agora aceita os modos dos agentes (sem isso a conversa
de um agente seria descartada ao ser lida).

Revisão e tradução NÃO usam servidor nem IA: mostram o selo "fica no aparelho". O texto fica só na memória da página.

### Conferência de dado pessoal (princípio da necessidade)

`achaDadoPessoal` / `conferirCampo` olham o campo antes do envio: **CPF** (com pontos, ou 11 dígitos que passam na conta do CPF) e
**cartão** (13 a 19 dígitos que passam no cálculo de Luhn) **bloqueiam** o botão ("tire o número"); **e-mail** e **telefone** só
avisam. Um número comum de 11 dígitos que não é CPF válido não bloqueia. A conferência é do aparelho e o texto não é gravado.
Base: princípio da necessidade da LGPD (Lei 13.709/2018). **[A CONFERIR NA CÓPIA LOCAL DA LEI]** o artigo exato antes de citá-lo
nesta página (a cópia em `leis-do-brasil` não estava ao alcance de quem escreveu este pacote). O art. 33 (transferência
internacional) já foi conferido no E4-10 e está em "Como funciona".

## Entrevista

- A vaga é um campo livre de 120 caracteres (só o cargo, sem empresa), ou "Usar o meu trabalho" (`lerTrabalho()`, só lido, nunca
  regravado aqui), ou um de 5 exemplos de rótulo, **em revisão**. **[A REVISAR PELA COORDENAÇÃO]** a lista de vagas de exemplo.
- A primeira mensagem ("Pode começar a entrevista.", no idioma da página) só abre a entrevista e **não conta** como resposta (sem
  texto o backend cairia no padrão "Não entendi este trecho."). As 5 respostas seguintes são contadas por `etapaDaEntrevista`.
  Terminou: 5 respostas dadas e a última fala é do assistente (o resumo).
- O histórico que a função aceita tem no máximo 8 falas, e a 5ª resposta perderia a conta. `contextoDaEntrevista` resolve sem mexer
  no backend: o contexto leva `trecho = "Esta é a resposta n de 5; a pergunta n já foi feita."` (e, na abertura, "pergunta 1 de 5").
- No fim: "Treino concluído, sem nota" e "Começar outra". Não há link para o Memorial de currículo: **[A REVISAR PELA
  COORDENAÇÃO]** se o Memorial de currículo existir, indicar a rota para entrar aqui; sem ela, nada aparece.

## Oratória

- A fala vem do microfone (opcional) ou é escrita/colada: no mínimo 50 caracteres, no máximo 2.800.
- `MicrofoneDeFala` usa o reconhecimento de fala do navegador (`continuous`, com a transcrição em tempo real no campo editável),
  no idioma da página (pt-BR, en-US, es-ES, fr-FR, ru-RU, zh-CN). Reusa o aviso da busca por voz (`useAvisoDaVoz`, que só segue
  depois do "Entendi") e o selo `reconhecimentoDeFala`. A tela diz que a transcrição pode errar e que o áudio pode ir à empresa do
  navegador (Google ou Apple). **O Instituto não grava áudio**; o que pode sair é só o texto do campo, quando a pessoa aperta o botão.
- Cronômetro mm:ss no relógio do aparelho (até 300 s), que preenche "Quanto tempo durou" (editável).
- `analisarFala`: palavras (em chinês, caracteres), palavras por minuto (**só com 10 s ou mais**), duração e até 3 palavras de
  conteúdo que se repetem 4 vezes ou mais (só em português, com `termosDe`). **Não há faixa de "ritmo bom"**: seria número sem fonte.
  A tela compara com o ensaio anterior da própria pessoa.
- Ensaios: `lucia:escola-privado:ensaios`, **só números** (`{id, em, segundos, palavras, ppm}`), até 10, até 30 dias, validação ao
  ler, `try/catch`, evento `lucia:estudo`, nada no modo seguro. Fora da cópia e apagado pelo "apagar meus dados" (prefixo privado).
  Nunca o texto, a voz ou a transcrição.

## Papelada

Só formulário **em branco**. A foto só pode ser escolhida depois do "Li o aviso" ("formulário em branco; não mande dados de ninguém,
inclusive crianças"); passa por `imageForAssistant` (reduz e tira o EXIF) e pela mesma `Tarja` do "Entender um documento", e as
tarjas ficam gravadas nos pixels. O caminho em texto cola só as perguntas do formulário (10 a 3.000 caracteres). A instrução do modo
no backend já proíbe preencher. Frase fixa "Isto não é orientação jurídica" e links: Defensoria Pública da União
(`https://www.dpu.def.br/`) e Meu INSS (`https://meu.inss.gov.br/`), os dois já em `content/direitos.json`. **[A REVISAR PELA
COORDENAÇÃO]** o endereço do Procon (não há um no repositório; hoje o nome aparece sem link, para não inventar endereço).

## Agente da turma

`DebateDaTurma` baixa `/<idioma>/indice-leve.json` no cliente, filtra `kind = "aula"` e usa o mesmo `buildSearch` do círculo de
cultura do E4-15 (sem editar aquele arquivo). `resumoDaAula` pega o começo do texto do índice, **copiado como está** (só espaços
juntados) e cortado em frase inteira até 1.200 caracteres; a pessoa confere e edita antes de mandar. Vão ao assistente só o título e
o resumo, nunca nome de aluno. Botões: "Copiar as perguntas", "Ver a aula" e "Levar para o círculo de cultura" (só um link para
`/escola/turmas/circulo`; nada é escrito lá). Aviso: "perguntas feitas por máquina, em revisão: leia antes de levar à turma; não
escreva nomes de colegas". Sem o assistente, o círculo já tem 5 perguntas-guia.

## Agente do educador

Tema de 10 a 600 caracteres; o modo `educador` devolve um rascunho com as 6 seções do modelo de aula (`lib/modelo-de-aula.ts`),
sem marca de autor e com "[acrescente as fontes]" na seção Fontes (a instrução do modo). Moldura fixa: "Rascunho de máquina: confira
cada fato e acrescente as fontes antes de qualquer uso. Nada aqui é publicado." Botões: Copiar, "Conferir este rascunho" (`levarRascunho`
e vai para `/escola/agentes/revisao`; o texto fica em `sessionStorage` na chave `lucia:escola-privado:rascunho-para-revisao`, é lido
uma vez e apagado, no padrão de `lucia:redacao-para-correcao`) e o link para `/contribuir`. Quem publica é a pessoa.

## Revisão de conteúdo (sem servidor, sem IA)

`revisarConteudo(texto, { naEscola })` devolve achados `{ tipo, gravidade, linha, trecho, regra }`, `gravidade` "corrigir" ou
"conferir", sempre na mesma ordem para o mesmo texto.

- **Links**: `http` sem s, encurtadores (bit.ly, tinyurl.com, t.co, goo.gl, ow.ly, is.gd, cutt.ly), rastreio (`utm_*`, `fbclid`,
  `gclid`), repetido, texto de link vazio, "clique aqui".
- **Fontes**: seção ausente ou vazia, o marcador "[acrescente as fontes]" ainda no texto, fonte sem ano nem endereço, número ou % sem
  nenhuma fonte. Entende o cabeçalho de aula (`fontes:` e `quiz:`) e títulos em negrito (como o rascunho do educador escreve).
- **Modelo**: as partes do modelo de 6 partes por `conferirModelo` (a parte Fontes é conferida pelas regras acima).
- **naEscola**: "universidade"/"diploma" nos 6 idiomas (a mesma lista de `scripts/testar-textos-escola.mjs`), como "conferir"
  (pode ser negação).

A tela **não abre os links** (CORS e exposição do IP a terceiros): manda a coordenação rodar `npm run conferir:links`. Se há CPF,
cartão, e-mail ou telefone no texto, a tela avisa.

## Tradutor supervisionado (decisão de escopo)

Não foi criado modo `traducao` no assistente. Isso exigiria mexer em `assistente.ts`, `lib/backend.ts` e na linha de
`testar-assistente.mjs` que trava a lista exata de modos, e publicar a função de novo. Quem traduz é a pessoa. `conferirTraducao`
compara com o original: mesma quantidade de parágrafos, títulos e itens de lista; os mesmos números e endereços (comparação de
multiconjunto, ignorando separador de milhar e vírgula decimal); termos protegidos mantidos (Instituto Lúcia, Escola Lúcia Maria,
Gaveta Aberta e os que a pessoa acrescentar); alerta de tamanho "conferir" só abaixo de 30% ou acima de 300% do original (nunca erro;
em chinês a tradução costuma ficar bem mais curta, então o alerta pode aparecer sem problema); com `naEscola`, universidade/diploma
na língua de destino. A tela diz "Esta ferramenta não traduz" e só libera "Copiar com a marca em revisão" depois da caixa "Um
falante do idioma revisou", marcada à mão (`podeCopiarTraducao`).

## Deploy

Nenhum `fs` em módulo novo, nada no layout raiz, na página da aula ou em componente global. Só uma página dinâmica `[agente]` com 7
parâmetros fixos: 6 idiomas × (1 hub + 7 agentes) = 48 páginas leves, sem acesso a disco e sem `fetch` no servidor. Os dicionários
são importados só nas páginas do servidor, e o componente de cliente recebe só a fatia do agente. Se o build ainda estourar, dá para
trocar por uma única página `/escola/agentes` com `?agente=` (6 páginas), sem mudar o código dos componentes.

## Pendências e decisões da coordenação

- **Rota na lista da Escola**: acrescentar `{ chave: "agentes", caminho: "/escola/agentes", pacote: "E4-16" }` (fora da faixa) em
  `lib/escola/rotas.ts` e um texto em `i18n/escola/base`, para o hub da Escola e o índice de busca (dono E4-01/E4-05).
- **[A REVISAR PELA COORDENAÇÃO]**: lista de vagas de exemplo; link do Procon; rota do Memorial de currículo; todo o texto dos 6
  idiomas escrito neste pacote (está "em revisão"), em especial as traduções.
- **Artigo da LGPD** do princípio da necessidade: conferir na cópia local antes de citar.
- Sem alvos de contagem novos (`scripts/alvos-de-contagem.mjs` é do E4-02): o uso dos agentes não é contado.

## Fora do escopo

Modo `traducao` com máquina no assistente; mudar qualquer modo existente, a lista de provedores, o limite do dia ou o `install.sql`;
modelo pequeno no aparelho (R1-63, parte 2); escrever no círculo (E4-15), na caderneta (E4-14), nas avaliações (E4-13) ou em qualquer
chave de outro pacote; nota, ranking, perfil e avaliação automática; verificador que abra links de terceiros.
