# Relatório da Onda 0: fundação do curso ENEM (30/10/2026)

## O que entrou

- **`content/enem/matriz.yml`**: as 4 áreas, 30 competências de área, as 120 habilidades (resumos nossos), os 5 eixos
  cognitivos, 42 objetos de conhecimento (41 do anexo da Matriz e 1 da equipe, `lin-lem`) e 286 tópicos; as 5
  competências da redação. Conferido na Matriz do Inep (download.inep.gov.br/download/enem/matriz_referencia.pdf).
- **`content/enem/edicao.yml`**: 53 fatos da edição 2026, cada um com fonte oficial, item, trecho e data; 3 a confirmar
  no edital (resultado, reaplicação, cronograma de Sisu/Prouni/Fies de 2027). Tabela completa: `docs/enem/FATOS.md`.
- **Provas oficiais classificadas e resolvidas**: 347 questões (2023: 172; 2022: 175), com área auditada pela numeração,
  habilidade, objeto, tópico, dificuldade, resolução original e o engano de cada alternativa errada, tudo `a-confirmar`.
  Ficaram de fora 11 questões que a importação estragou (enunciado vazio, imagem perdida, alternativa "0" descartada,
  uma questão anulada pelo Inep); a lista está no inventário.
- **`content/enem/incidencia.yml`** (gerado): contagem por objeto, tópico e habilidade nas provas de 2022 e 2023.
- **Validadores**: `lib/enem.ts` (matriz, edição, camada das provas, incidência, redação), etiquetas do ENEM em
  `lib/exercicios.ts`, faixas de habilidade das 4 áreas e campo `objetos` em `lib/mapa-curricular.ts`, seções do percurso
  em `lib/modelo-de-aula.ts` e `npm run pendencias`.
- **Roteiros**: `testar:enem` (780 conferências), `cobertura:enem`, `fila:enem`, `incidencia:enem`; os três primeiros no CI.
- **Fatos nas aulas**: `{{enem:<id>}}` é trocado pelo fato na montagem do site, no livro EPUB e no espelho estático.
- **Chave `enem-curso`** (`lib/recursos.ts`, `docs/RECURSOS.md`) e as páginas: `/enem` (porta), `/enem/provas`,
  `/enem/provas/<ano>/<dia>` (prova oficial com relógio, folha de respostas e relatório por área, habilidade e dificuldade),
  `/enem/praticar` (prática por habilidade), `/enem/dia-da-prova` (tudo do edital, com fonte), "Questões oficiais para
  treinar" no fim das aulas e links na estante da disciplina, no banco de questões e no Meu estudo.
- **Armazenamento**: chave nova `lucia:enem` (cópia de segurança e "apagar"), descrita em `content/paginas/privacidade.md`.
- **Documentação**: `docs/ENEM.md` (formatos, aula do percurso, guia "como produzir uma área", atualização anual),
  `docs/enem/INVENTARIO.md`, `COBERTURA.md`, `FATOS.md`, `FILA-DE-REVISAO.md`.

## A data da prova

Conferido em 30/10/2026 no Edital nº 64/2026 (DOU de 22/5/2026) e na notícia do MEC de 27/10/2026: a prova de 2026 **ainda
não aconteceu**. Será em **8 e 15 de novembro de 2026** (portões das 12h às 13h, início às 13h30, fim às 19h e às 18h30,
horário de Brasília). Os locais de prova foram publicados em 27/10/2026.

## Fatos que não se confirmaram

- Data do resultado individual e da reaplicação: o edital diz "em data a ser divulgada pelo Inep".
- Cronograma do Sisu, do Prouni e do Fies que vão usar as notas de 2026: não localizado em fonte oficial em 30/10/2026.
- O inglês das provas de 2022 e 2023 não está na fonte importada (só o espanhol).

## Decisões

- As áreas são auditadas pela numeração do caderno (a fonte importada erra a área de várias questões).
- A camada das provas pode ficar num arquivo por ano e área (`2023-matematica.yml`), para equipes trabalharem juntas.
- As trilhas de orientação (`enem-como-funciona`, `enem-estrategia-de-prova`) e as aulas de orientação e de redação
  não levam etiquetas de área nos exercícios nem a "questão comentada".
- Ordem das trilhas da disciplina: Comece aqui 1, Reta final 2, Estratégia 3, Redação 4, Quatro áreas 5, Aprofundamento 6.

## Cobertura

Veja `docs/enem/COBERTURA.md`. Esta onda é de fundação: a cobertura de aulas por habilidade ainda é baixa (as aulas de
área são das Ondas 3 a 6).

## Fila de revisão

`docs/enem/FILA-DE-REVISAO.md`. Nada nasce revisado.

## Ligar o curso

`NEXT_PUBLIC_RECURSOS=meu-estudo,exercicios,revisoes,mapa-curricular,nivelamento,metas,enem-curso`
