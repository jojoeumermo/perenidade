# Cursos da Escola (Etapa 4, pacote E4-07)

Os cursos da Escola Lúcia Maria: catálogo por ciclo, página de cada curso (grade, horas, ementa, patrono, biblioteca,
entrar no curso), zine do curso, leitura guiada do Manifesto e a faixa do curso dentro da aula. Tudo atrás do recurso
`escola` (o layout de `/escola` responde "não encontrado" sem ele; na aula, a faixa só existe com `ligado("escola")`).

**Regra de ouro: curso só com aula escrita.** Cada módulo lista `trilha/aula` que existe como arquivo ativo em
`content/trilhas`. O que ainda não tem aula vai em `emConstrucao`, aparece com o selo "em construção" e nunca vira link.
Contagem conferida em 03/11/2026 com a mesma regra de `lib/escola/cursos-servidor.ts`: **198 das 318 trilhas têm aula, e
109 têm 6 ou mais** (os números do R1 batem).

## Os 17 cursos

| Ciclo | Curso | Formato | Aulas | Horas (estimativa) | Semanas | Patrono proposto | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Básico | Aprender a estudar | percurso | 8 | 3 | 1 | — | recomendado antes de qualquer curso longo |
| Básico | EJA de ponta a ponta | percurso | 47 | 15 | 5 | Gregório Bezerra | ENCCEJA fundamental e médio em construção |
| Básico | Matemática para a vida | regular | 17 | 4,5 | 2 | Mehdi Ben Barka | |
| Básico | Português: ler e escrever melhor | regular | 24 | 4,5 | 2 | Luiz Gama | |
| Básico | Ciências da natureza | regular | 33 | 7 | 3 | — | |
| Básico | História do Brasil e das lutas do povo | regular | 36 | 7,5 | 3 | João Cândido | `sensivel: true` (na dúvida, marcado) |
| Básico | Inglês do zero | regular | 14 | 2,5 | 1 | — | |
| Básico | Espanhol do zero | regular | 10 | 2 | 1 | — | |
| Básico | A conta de luz (interdisciplinar) | regular | 12 | 5 | 2 | Berta Cáceres | direito do consumidor e luta por energia em construção |
| Profissional | Eletricista residencial | alternância | 21 | 4,5 | 2 | — | prática só de observar, medir sem energia e anotar |
| Profissional | Costura | alternância | 16 | 3 | 1 | Zuzu Angel | |
| Profissional | Tranças | alternância | 15 | 3 | 1 | — | prática repete a higiene e o "quando não trançar" |
| Profissional | Barbearia | alternância | 14 | 3 | 1 | — | prática repete a rotina de higiene e a lâmina por cliente |
| Profissional | Crochê para vender | alternância | 18 | 3,5 | 2 | — | |
| Profissional | Oratória e liderança | alternância | 15 | 3 | 1 | Martin Luther King Jr. | |
| Avançado | Ano de formação política | regular | 120 | 19,5 | 7 | Antonio Gramsci | `sensivel: true`; dois semestres, quatro eixos |
| Avançado | ENEM | percurso | 24 | 5,5 | 2 | — | aponta para `/enem` (questões, simulados, plano) sem repetir |

Requisitos: o ENEM pede "Português: ler e escrever melhor" e "Matemática para a vida"; o Ano de formação política pede
"História do Brasil e das lutas do povo". Os outros não têm requisito. "Aprender a estudar" é recomendado (não exigido)
na página de todo curso com 20 aulas ou mais.

As horas são as de `horasDoCurso` (E4-01): leitura a 180 palavras por minuto + 2 min por questão + 3 min por exercício,
arredondadas para meia hora. As semanas são `horas / 3` (3 horas por semana), arredondadas para cima. Por essa conta o
"Ano de formação política" dá 7 semanas de aulas: o "ano" é a organização em dois semestres, com a prática (a tarefa no
mundo e as práticas dos módulos de história) correndo junto. **A coordenação decide se mantém o nome ou a duração.**

### Como os cursos foram montados

- Aulas: a ordem é a do `plano.json` de cada trilha (a mesma de `lib/content.ts`). Em "Aprender a estudar", das nove aulas
  indicadas ficaram as oito que servem a quem não vai fazer o ENEM; "Cursinhos populares" (sobre cursinho pré-vestibular)
  e "Como treinar: escrever, reler e reescrever" (presa às competências da redação do ENEM) ficaram de fora. A aula
  `portugues-medio/como-fazer-um-resumo-e-um-fichamento` **já existe**, então entrou no curso em vez de ir para
  "em construção". Em "EJA de ponta a ponta", a aula "Para quem vai ensinar" (`ler-e-escrever/como-funciona-a-alfabetizacao-de-adultos`)
  ficou fora, porque é para educadores.
- "A conta de luz" usa só as aulas achadas na busca por conta de luz, kWh, tarifa e consumo. Não há aula de direito do
  consumidor sobre a conta (cobrança, contestação, corte) nem de luta pelo direito à energia: os dois estão em
  "em construção" e o pedido vai para os educadores.
- Tarefas práticas, tarefa no mundo e projeto final foram escritos a partir do que as aulas ensinam e aparecem com o selo
  "em revisão". No elétrico, nada é feito em instalação ligada: observar, ler etiquetas, medir continuidade só com o
  circuito sem energia (a regra da aula do multímetro) e, se algo não bater, "desligar o disjuntor do chuveiro e chamar
  quem saiba consertar" (a aula do chuveiro).
- Patrono: só pessoa de `content/memorial` cuja ficha mostra ligação com o tema; o motivo é uma frase copiada da ficha e
  `confirmado: false`. Cursos sem ligação clara ficam sem patrono (Ciências, Inglês, Espanhol, Eletricista, Tranças,
  Barbearia, Crochê, Aprender a estudar, ENEM).
- Biblioteca: só obras de `content/acervo` citadas nas fontes das aulas do curso, **duas vezes ou mais** (citação única
  costuma ser uma lei usada de passagem), até 8 por curso, na ordem da primeira citação; o "porque" é a primeira frase da
  sinopse da ficha. No Ano de formação política, o Manifesto entra sempre (tem leitura guiada) e a Constituição fica fora
  (é citada como fonte de dados, não como leitura de formação).

## Páginas e peças

| Ideia | O que faz | Onde |
| --- | --- | --- |
| D1-11, R1-27 Três ciclos | Catálogo por ciclo, filtros por objetivo (os da matrícula) e por área (o grupo de disciplinas de `lib/areas.ts`), cartão com horas, aulas, semanas, formato, patrono, requisitos e o selo "curso montado só com aulas prontas". | `app/[lang]/escola/cursos/page.tsx`, `components/escola/cursos/CatalogoDeCursos.tsx` |
| R1-28 Horas | "x de y horas" com o selo da estimativa, contando `lucia:concluidas` e as trilhas dispensadas da inscrição (`horasFeitas`). | `components/escola/cursos/HorasDoCurso.tsx` |
| R1-29 Ementa | Objetivo; Conteúdo (módulos e aulas, com minutos); Avaliação; Bibliografia (biblioteca + fontes das aulas, sem repetir); Requisitos; Carga horária estimada. "Imprimir ementa" imprime só ela (`data-imprimindo-ementa`). | `components/escola/cursos/Ementa.tsx`, `ImprimirEmenta.tsx` |
| R1-66 Patrono | Nome, datas, a frase da ficha, link `/memorial#slug` e "Patrono proposto, a confirmar pela coordenação". | `components/escola/cursos/Patrono.tsx` |
| R1-43 Biblioteca | Ordem de leitura, licença de cada obra, ficha no Acervo e o link da fonte; com direitos reservados, só a ficha e a fonte legal. | `components/escola/cursos/BibliotecaDoCurso.tsx` |
| R1-44 Leitura guiada | Só o Manifesto: perguntas por seção, o "onde ler" de cada seção (sem reproduzir o texto) e as respostas só no aparelho, em `lucia:escola:leituras`. | `content/escola/leituras/manifesto-do-partido-comunista.json`, `lib/escola/leituras.ts`, `app/[lang]/escola/leituras/[obra]/page.tsx`, `components/escola/cursos/LeituraGuiada.tsx` |
| R1-41 Alternância | Cada módulo: tempo escola (aulas) e tempo trabalho (2 ou 3 tarefas, "em revisão", com o aviso de cuidado). | `components/escola/cursos/GradeDoCurso.tsx` |
| R1-40 Formação política | Dois semestres, eixos Consciência de classe, Teoria e História nos módulos e a Prática como tarefa no mundo e práticas dos módulos de história. Aviso de curso sensível. | `content/escola/cursos/ano-de-formacao-politica.json` |
| R1-36 Interdisciplinar | A conta de luz. | `content/escola/cursos/a-conta-de-luz.json` |
| R1-45, R1-47 | Aprender a estudar; EJA de ponta a ponta. | `content/escola/cursos/` |
| R1-72 Zine do curso | Por módulo, folhas A4 deitadas que viram livrinhos de 8 páginas: capa do módulo, seis aulas (resumo, partes, palavras, primeira pergunta, QR) e contracapa com o QR do curso. Só em português (os outros idiomas redirecionam). | `app/[lang]/escola/cursos/[curso]/zine/page.tsx` |
| Entrar no curso | Sem matrícula: link para `/escola/matricula?curso=<slug>`. Com matrícula: `inscrever()` e `contarEscola('escola_matricula', slug, 'semestre')`. Inscrito: "Continuar: próxima aula". | `components/escola/cursos/EntrarNoCurso.tsx` |
| Faixa na aula | Só para quem está inscrito num curso da aula: "Curso X · módulo 2 · aula 5 de 24", o próximo passo vira a próxima aula do curso, e `contarEscola('escola_presenca', curso, 'dia')`. Sem inscrição, nenhuma faixa e o próximo passo da trilha, como antes. Carga tardia e só nas aulas que fazem parte de algum curso. | `components/escola/cursos/FaixaDoCurso.tsx`, `FaixaDoCursoSobDemanda.tsx`, página da aula |
| Busca | Cada curso entra no índice como página (título, resumo e objetivo, área do curso, contexto "Curso da Escola"). | `lib/escola/indice.ts` (`entradasDosCursos`) |

Os dados que as páginas mostram (aulas com título e minutos, bibliografia, biblioteca, patrono, cursos de cada aula)
são montados por `lib/escola/cursos-vista.ts`, guardados por processo. As rotas `cursos/[curso]`, `cursos/[curso]/zine`
e `leituras/[obra]` usam `dynamicParams = false`: tudo sai na montagem e nada lê `content/escola` em tempo de execução,
por isso `next.config.ts` **não** precisou de `outputFileTracingIncludes` novo. A página da aula já tinha
`content/**/*` incluído (`/*/trilhas/**`). O tempo de montagem não foi medido neste pacote (não rodamos `next build`):
são 17 cursos × 6 idiomas × 2 páginas (a zine fora do português só redireciona) e 6 páginas de leitura.

## Privacidade

- A matrícula, a inscrição, as aulas feitas e as respostas da leitura guiada ficam **só no aparelho**. O servidor recebe
  só as contagens anônimas de `contarEscola` (matrícula por curso e semestre, presença por curso e dia), sem conta, sem
  endereço na chave do freio (docs/escola/banco.md).
- Cursos `sensivel: true`: o vínculo, se guardado no servidor (turma, E4-15), revelaria opinião política, que é dado
  pessoal sensível pela LGPD (Lei 13.709/2018, art. 5º, II: "opinião política"). Por isso a turma pede consentimento
  (banco do E4-02) e a página avisa. "História do Brasil e das lutas do povo" foi marcado por dúvida; a coordenação pode
  desmarcar.
- As respostas da leitura guiada podem expressar opinião política: ficam em `lucia:escola:leituras` (chave reservada da
  Escola), saem no "apagar meus dados" e só vão para outro aparelho pela cópia de segurança que a própria pessoa baixa.

## Testes

- `npm run testar:escola` (E4-01) valida todos os cursos.
- `npm run testar:escola-cursos`: cada aula existe; área e objetivos válidos; nada de universidade, diploma ou créditos
  nos textos do curso; horas, semanas e progresso nos cursos reais; patrono no Memorial com motivo copiado da ficha; obra
  no Acervo com "porque" copiado da sinopse; alternância com tempo trabalho em todo módulo; "em construção" sem link;
  "Ano de formação política" sensível e com o Manifesto; leitura guiada válida e guardada só no aparelho (inclusive sem
  armazenamento); cursos na busca; páginas; faixa acima do botão de concluir; mesmas chaves de texto nos 6 idiomas.
- `e2e/escola-cursos.spec.ts`: catálogo em /pt e /en com filtro; ementa; entrar sem matrícula leva à matrícula; entrar
  com matrícula; faixa na aula de um curso inscrito e nada sem inscrição; zine imprimível e redirecionada; leitura guiada;
  sem rolagem lateral em 360 px.

## Para a coordenação

- Confirmar (ou trocar) cada patrono. Para pessoas que morreram há pouco tempo, sugerimos falar com a família ou a
  organização antes de confirmar (cuidado ético, inferência nossa; não é regra legal conferida): Berta Cáceres (2016) e
  Martin Luther King Jr. (1968, organização e família ainda ativas). Os demais morreram antes de 1990.
- Revisar as perguntas da leitura guiada (marcadas `em-revisao`) e as tarefas práticas, a tarefa no mundo e o projeto
  final de cada curso ("em revisão" na tela). `[A REVISAR PELA COORDENAÇÃO]`: a duração do "Ano de formação política"
  (7 semanas pela estimativa de horas) e a marcação sensível de "História do Brasil e das lutas do povo".
- Pedir aos educadores: aula de direito do consumidor e a conta de luz; aula sobre a luta pelo direito à energia; as
  trilhas de preparação para o ENCCEJA fundamental e médio; uma leitura guiada de *Pedagogia do Oprimido* depende de a
  obra ter licença aberta (no Acervo está "Direitos reservados") e *Quarto de despejo* não está no Acervo.
