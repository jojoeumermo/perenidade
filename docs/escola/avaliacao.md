# Avaliação e aprender ativo (E4-13)

Pacote da onda 3 da Etapa 4 (`docs/ESCOLA.md`). Ideias: D1-8, R1-26, R1-30, R1-31, R1-32, R1-33, R1-34 e R1-48.

**Regras que valem para tudo daqui:** sem nota pública, sem porcentagem na tela, sem ranking e sem comparação entre pessoas. Respostas, explicações e gravações ficam **só no aparelho**; nada disto chama servidor (o teste confere que os arquivos não têm `fetch`, `rpc` nem `@/lib/backend`). A Escola não se apresenta como universidade e o reconhecimento de saberes **não é certificação oficial nem diploma**. Fora de `/escola`, tudo fica atrás de `ligado("escola")`: desligada, a prova da trilha, a aula, a prática de idiomas e os jogos ficam como eram.

## Onde está cada coisa

| Peça | Arquivo |
| --- | --- |
| Regras puras (retorno, dispensa, provas guardadas, "lembra?", explicações, semana de provas, `.ics`, reconhecimento) | `lib/escola/avaliacao.ts` |
| Trilhas de cada curso com e sem prova (só servidor) | `lib/escola/avaliacao-servidor.ts` |
| Resposta digitada com erro de digitação perdoado | `lib/resposta-confere.ts` |
| Revisão que mistura matérias | `intercalar` em `lib/estudo.ts` |
| Retorno por competência e retorno do módulo | `components/escola/avaliacao/RetornoPorCompetencia.tsx` |
| As questões da prova nos três modos | `components/escola/avaliacao/QuestoesDaProva.tsx` e `usar-prova.ts` |
| Prova em dupla, proficiência e oferta de dispensa | `ProvaEmDupla.tsx`, `Proficiencia.tsx` |
| Semana de provas e reconhecimento de saberes | `SemanaDeProvas.tsx`, `ReconhecimentoDeSaberes.tsx` |
| Na aula: "lembra?" e "explique com suas palavras" | `components/aula/LembraDaAnterior.tsx`, `ExpliqueComSuasPalavras.tsx`, carregados por `AprenderAtivoSobDemanda.tsx` (sem servidor, só com a Escola ligada) |
| Páginas | `app/[lang]/escola/provas`, `app/[lang]/escola/saberes`, `app/[lang]/escola/cursos/[curso]/modulo/[n]`, e a prova `app/[lang]/trilhas/[track]/prova` |
| Textos (6 idiomas) | `i18n/escola/avaliacao/*.json`; no núcleo só `blocks.almost` ("Quase! A grafia é {w}") e `lesson.yourExplanation` |
| Visual | `styles/escola-avaliacao.css` |
| Testes | `npm run testar:escola-avaliacao` e `e2e/escola-avaliacao.spec.ts` |

## Chaves no aparelho

| Chave | Forma | Cópia de segurança |
| --- | --- | --- |
| `lucia:escola:provas` | `{[trilha]: [{data, acertos, total, modo: "normal" \| "dupla" \| "proficiencia", porTema: {[aula]: {acertos, total}}}]}`, no máximo 20 por trilha | entra |
| `lucia:escola:avaliacoes` | `{lembrados: {[aula]: "AAAA-MM-DD"}, recuperacoes: [{aula, data, acertos, total, origem: "recuperacao"}]}` (até 200) | entra |
| `lucia:escola:explicacoes` | `{[aula]: {texto (até 1000), em}}` | entra |
| IndexedDB `lucia-explicacoes`, loja `audios` | o áudio de cada aula (até 2 minutos) | **não** entra (é grande); o "apagar meus dados" apaga a base |

`lucia:testes` (o "Meu estudo") recebe o resultado da prova por aula com `registrarTeste`, menos na dupla, que é de duas pessoas.

## Como funciona

- **Retorno por competência (R1-30).** Por tema: "já sabe" (80% ou mais, com 3 questões ou mais), "quase lá" (50 a 79%), "vale rever" (abaixo de 50%) e "pouco dado ainda" (menos de 3 questões). A tela só mostra a palavra e o link para rever a aula. Aparece no fim da prova (o tema é a aula) e em `/escola/cursos/[curso]/modulo/[n]`, que junta o teste de fim de aula de cada aula do módulo e os exercícios dessas aulas (`porTema` de `lib/meu-estudo.ts`), com links para o módulo anterior e o próximo. A página do módulo é `noindex` (o retorno é de cada pessoa).
- **Prova de sempre.** Com a Escola ligada, a prova continua igual (resposta na hora, régua verde e vermelha, "Você acertou X de Y"), grava no aparelho e mostra o retorno. Embaixo do botão, os links "Em dupla" e "Prova de proficiência".
- **Prova de proficiência (R1-31).** `/trilhas/[trilha]/prova?modo=proficiencia` (o parâmetro não identifica ninguém). São **todas** as questões da trilha e a resposta não aparece a cada questão. Antes, o texto diz que é para quem já sabe e que dá para refazer. No fim, para cada curso em que a pessoa está inscrita e que contém a trilha, se todos os temas deram "já sabe", aparece "Marcar esta trilha como dispensada no curso" (`marcarDispensa`). Aula com menos de 3 questões não chega a "já sabe" pela regra geral; nela vale acertar todas as que existem (`podeDispensar`). Nenhuma aula some: a dispensa só conta a trilha como feita no progresso do curso.
- **Semana de provas solidária (D1-8).** `/escola/provas` usa `semanaDeProvas` (`lib/escola/tempo.ts`), calculada no navegador (a página é montada uma vez só). Fora da semana, mostra a data (a do semestre seguinte, nas férias) e diz que a prova de cada trilha continua aberta para treinar. Dentro, lista as trilhas com prova (10 questões ou mais) dos cursos em que a pessoa entrou, sozinho ou em dupla. A prova em dupla alterna "Pessoa A" e "Pessoa B" a cada questão, com "Combinem a resposta antes de tocar", e termina sem placar. "Estudar junto antes" leva a `/estudo-em-grupo` e a `/escola/turmas`. O lembrete `.ics` é um evento de dia inteiro do primeiro ao último dia, com aviso às 9h, no mesmo formato de `lib/agenda.ts`.
- **Revisão que mistura matérias (R1-32).** `intercalar(itens, grupoDe?, depoisDe?)` faz um rodízio determinístico: um item de cada trilha por vez, mantendo a ordem de vencimento dentro de cada uma. `paraHoje` continua devolvendo o mesmo conjunto. O Praticar ("revisar meus erros") usa a trilha do exercício. Os cartões do caderno não guardam a trilha: a revisão do caderno agrupa pela **origem** do cartão (a aula ou a fonte de onde ele veio) e começa depois da origem do último cartão respondido, para não voltar à mesma matéria.
- **Lembra da aula anterior (R1-33).** No começo da aula: se a aula anterior do curso (para quem está inscrito num curso com esta aula) ou da trilha foi concluída há **mais** de 1 dia (data em `lucia:concluidas-em`; data 0 é conclusão antiga) e tem teste, mostra 2 questões dela escolhidas pelo dia. "Pular" sempre visível; não aparece duas vezes no mesmo dia na mesma aula. A resposta fica em `lucia:escola:avaliacoes` com origem `recuperacao`, e a errada vai para o caderno de erros com origem `recuperacao`.
- **Explique com suas palavras (R1-34).** No fim da aula, antes do "Marcar como concluída": campo de até 1000 caracteres ou gravação de até 2 minutos (MediaRecorder, sem reconhecimento de fala). O que a pessoa explicou volta na aula ("O que você explicou da outra vez") e na revisão da aula no Praticar. Botão "Apagar" leva o texto e o áudio.
- **Erros de digitação perdoados (R1-26).** `confere(dada, esperadas, opcoes)` normaliza (minúsculas, sem acento, pontuação vira espaço, sem espaços nas pontas) e aceita, palavra por palavra, a distância de Damerau–Levenshtein 1 para palavras de 5 a 8 letras e 2 para 9 ou mais; nunca para números, palavras de até 4 letras ou escrita sem alfabeto (chinês, japonês). Devolve `{certo, quase, grafia}`; "quase" é aceita e mostra "Quase! A grafia é X". Trocado em: prática de idiomas (`components/Pratica.tsx`, via `conferirDigitada` de `lib/pratica.ts`, com o acento contando como "quase") e lacunas dos jogos (`components/blocos/Jogos.tsx`). No **Cantinho da Lua (Letras)** a palavra é montada tocando sílabas, sem campo digitado: não há comparador de texto a trocar, e nada passou a ser guardado nem enviado (`docs/CRIANCAS-CONFORMIDADE.md`). Os exercícios numéricos não mudam (já aceitam 3/4 e 0,75). `lib/pratica.ts` mantém `confere` (sim ou não, sem perdão) para quem a usava.
- **Reconhecimento de saberes (R1-48).** `/escola/saberes`: a pessoa escolhe um curso que já domina pela vida. (1) A prova de proficiência de cada trilha do curso, com o estado (a fazer, já mostrou, dispensada). (2) Nos cursos de alternância, a lista de `pratica` dos módulos vira um roteiro de avaliação prática, marcado "Roteiro em revisão", para fazer ao vivo com um educador ou alguém do Núcleo. (3) "Registrar na caderneta" grava `{tipo: "saberes", curso, data, titulo: "Saberes reconhecidos", detalhe, pessoas: [nome]}`; o nome de quem avaliou só entra com a caixa "essa pessoa permitiu" marcada, e prática conferida pede esse nome. Texto fixo: "Registro da Escola Lúcia Maria, não é certificação oficial nem diploma." Para a certificação oficial de escolaridade, o caminho é o ENCCEJA, com link para `/escola/calendario`.

## Decisões e desvios do desenho

- `registrarTeste` (`lib/meu-estudo.ts`) não tem o campo de origem. Em vez de sobrescrever o teste da aula com as 2 questões do "lembra?", a recuperação vai para `lucia:escola:avaliacoes` com `origem: "recuperacao"`. Se a coordenação quiser no "Meu estudo", o dono de `lib/meu-estudo.ts` acrescenta a origem.
- A prova normal grava cada aula com `registrarTeste`, como pede o desenho: o "vale o último" de `lucia:testes` passa a ser o resultado daquela aula na prova.
- As questões da prova ficam num componente próprio (`QuestoesDaProva`), com a mesma marcação do teste da aula (`components/Quiz.tsx`, que não mudou), porque o `Quiz` não devolve as respostas.
- O modo da prova é lido com `useSearchParams` dentro de um `Suspense` (a página é estática).

## Teste

`npm run testar:escola-avaliacao`: limites do retorno e "pouco dado", dispensa, `intercalar` com 3 trilhas, `confere` (acentos, distâncias, inversão, números, palavras curtas, ideogramas, várias respostas), gravação da prova (limite de 20 e leitura do estragado), regra do "lembra?" (dia, conclusão, curso inscrito), explicações, semana de provas e `.ics`, rotas e interdição, textos sem número no retorno e as promessas no código (sem servidor, sem número no retorno, aula sem esconder). Rodar também `testar:estudo`, `testar:meu-estudo`, `testar:exercicios`, `testar:escola` e `testar:textos-escola`.

`e2e/escola-avaliacao.spec.ts` (site com `escola` ligada): prova normal grava e mostra o retorno sem número; a proficiência oferece a dispensa e a aula continua abrindo; prova em dupla alterna e termina sem placar; o cartão "lembra?" aparece, some e não volta no dia; explicação guardada e apagada; 360 px sem rolagem lateral. O caso "resposta com erro de digitação aceita como quase" está como `test.fixme`: hoje nenhuma aula publicada tem prática com resposta digitada (conferido em 03/11/2026); a regra está coberta no teste do Node.

## Para a coordenação

- O roteiro de avaliação prática usa as tarefas de `pratica` dos cursos (E4-07) e está marcado "Roteiro em revisão" até alguém da coordenação revisar.
- O calendário da semana de provas segue `content/escola/ano-letivo.json`, ainda proposto.
- A página do curso (`GradeDoCurso`, do E4-07) ainda não aponta para `/escola/cursos/[curso]/modulo/[n]`; hoje se chega lá pela semana de provas. Um link por módulo na grade ajudaria.
