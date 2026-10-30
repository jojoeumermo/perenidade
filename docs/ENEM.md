# O curso ENEM

O ENEM é a disciplina carro-chefe do site: um curso completo, guiado, gratuito, sem conta e sem anúncio. Este guia
explica como o curso é montado, os formatos de cada arquivo, os roteiros de conferência e como produzir uma área
inteira. Vale junto com `CONTRIBUTING.md`, `docs/MANUTENCAO.md` (seção 2, Regras da casa), `docs/MODELO-DE-AULA.md`
e `docs/EXERCICIOS.md`.

- [1. Como o curso é montado](#1-como-o-curso-é-montado)
- [2. A fonte da verdade: content/enem/](#2-a-fonte-da-verdade-contentenem)
- [3. A aula do percurso](#3-a-aula-do-percurso)
- [4. Exercícios com as etiquetas do ENEM](#4-exercícios-com-as-etiquetas-do-enem)
- [5. Mapa curricular: aula → habilidade e objeto](#5-mapa-curricular-aula--habilidade-e-objeto)
- [6. Provas oficiais: a camada do instituto](#6-provas-oficiais-a-camada-do-instituto)
- [7. Incidência: o que mais cai](#7-incidência-o-que-mais-cai)
- [8. Redação](#8-redação)
- [9. Roteiros](#9-roteiros)
- [10. Como produzir uma área (guia para as equipes)](#10-como-produzir-uma-área-guia-para-as-equipes)
- [11. Todo ano: atualizar a edição](#11-todo-ano-atualizar-a-edição)
- [12. O que é proibido](#12-o-que-é-proibido)

## 1. Como o curso é montado

| Peça | Onde mora | Para quê |
| --- | --- | --- |
| Matriz de Referência | `content/enem/matriz.yml` | áreas, competências, habilidades H1–H30, objetos de conhecimento e tópicos; as 5 competências da redação |
| Edição corrente | `content/enem/edicao.yml` | toda data e regra da edição, com fonte oficial, trecho e data de conferência |
| Provas oficiais | `public/questoes/enem-<ano>.json` (importador, **não editar**) + `content/enem/questoes-oficiais/<ano>.yml` (nossa camada) | treino com as provas reais, classificadas e resolvidas por nós |
| Incidência | `content/enem/incidencia.yml` (gerado) | o que mais cai, por objeto e por habilidade |
| Redação | `content/enem/redacao/` | temas oficiais, propostas de treino, repertório, modelos e grade |
| Trilhas | `content/trilhas/enem-*` | as aulas do percurso (disciplina `enem`, etapa `medio`) |
| Exercícios | `content/exercicios/enem-*/<aula>.yml` | questões originais com as etiquetas do ENEM |
| Mapa curricular | `content/curriculo/enem-*.yml` | cada aula ligada a habilidades e objetos |
| Página do curso | `app/[lang]/enem` | a porta do curso (recurso `enem-curso`) |
| Validadores | `lib/enem.ts`, `lib/exercicios.ts`, `lib/mapa-curricular.ts`, `lib/modelo-de-aula.ts` | conferem tudo na montagem e nos roteiros |

O percurso (as trilhas, em `ordem`): `enem-como-funciona` (1, Comece aqui), `enem-reta-final` (2), `enem-estrategia-de-prova`
(3), `enem-redacao` (4), `enem-por-area` (5), `enem-aprofundamento` (6). As trilhas de área entram a partir da ordem 10:
Matemática 10–14, Linguagens 20–26, Natureza 30–32, Humanas 40–44, `enem-redacao-oficina` 50, `enem-base` 60.

As páginas e funções novas do curso ficam atrás da chave `enem-curso` (`lib/recursos.ts`, `docs/RECURSOS.md`). As aulas e os
exercícios seguem o caminho normal do repositório (aparecem como qualquer aula).

## 2. A fonte da verdade: content/enem/

### matriz.yml

- `areas.<area>` (`linguagens`, `humanas`, `natureza`, `matematica`): `nome`, `sigla`, `dia` (1 ou 2), `componentes`,
  `competencias` (cada uma com `numero`, `resumo` e `habilidades` com `numero` e `resumo`) e `objetos`.
- Os números de competência e habilidade são os oficiais; a divisão H por competência está em `FAIXAS_DO_ENEM`
  (`lib/mapa-curricular.ts`) e o validador confere que o arquivo bate com ela. O `resumo` é **nosso** (nunca a redação oficial).
- `objetos`: os do anexo da Matriz. Cada um tem `id` estável com o prefixo da área (`lin-`, `mat-`, `nat-`, `hum-`;
  Natureza ainda com `fis-`, `qui-`, `bio-`), `nome`, `resumo`, `habilidades` (proposta da equipe, `situacao: a-confirmar`)
  e `topicos`. Objeto que não está no anexo leva `anexo: false` (caso de `lin-lem`, a língua estrangeira).
- `topicos`: a quebra de cada objeto nas aulas do percurso. O id do tópico **começa pelo id do objeto**
  (`mat-numeros` → `mat-numeros-porcentagem`). É a lista de produção das equipes de área: cada tópico ganha ao menos uma aula.
- Ids nunca mudam depois de publicados (exercícios, questões e o aparelho de quem estuda apontam para eles). Para
  dividir um tópico, crie ids novos e mantenha o antigo.

### edicao.yml

```yaml
fatos:
  aplicacao-dia-1:
    afirmacao: "Primeiro dia de provas"   # o que o fato diz, em uma linha
    tipo: data                            # data | hora | minutos | numero | dinheiro | texto | lista
    valor: "2026-11-08"                   # no formato do tipo (data AAAA-MM-DD, hora HH:MM, minutos inteiro)
    fonte: edital-64                      # id de uma das "fontes" (só endereços oficiais: gov.br, in.gov.br)
    item: "1.3"                           # o item do edital, quando houver
    trecho: "Aplicação 8/11 e 15/11/2026" # a passagem conferida, copiada da fonte
    conferido: "2026-10-30"
```

Fato não confirmado leva `situacao: confirmar-no-edital`, **sem** `valor`, com `nota` dizendo o que falta; o site
mostra "confirmar no edital". Os fatos de `FATOS_OBRIGATORIOS` (`lib/enem.ts`) são usados pelas páginas e não podem faltar.

**Nas aulas, nunca escreva data ou regra da edição.** Cite o fato: `{{enem:aplicacao-dia-1}}` vira "8 de novembro de 2026"
na montagem (`substituirFatos`, em `lib/enem.ts`). Id inexistente para a montagem. A tabela completa, com onde cada
fato aparece, está em `docs/enem/FATOS.md` (gerada por `npm run cobertura:enem`).

## 3. A aula do percurso

Toda aula segue as seis partes de `docs/MODELO-DE-AULA.md` e usa os blocos da aula-experiência quando couber. Nas trilhas
`enem-*` de conteúdo (todas menos `enem-como-funciona` e `enem-estrategia-de-prova`) entram ainda três seções, que
`npm run pendencias -- <trilha>` cobra:

| Seção | Título aceito | O que tem |
| --- | --- | --- |
| Como cai | `## Como isso cai no ENEM` | os formatos em que o conteúdo aparece, as habilidades ligadas (H e resumo) e as armadilhas frequentes |
| Questão comentada | `## Questão comentada` | uma questão **original** no estilo ENEM (texto-base, comando, 5 alternativas A–E), resolvida passo a passo, com o engano de cada errada |
| Para aprofundar | `## Para aprofundar` | links para as aulas de disciplina do site que sustentam o assunto (`[Título](/trilhas/<trilha>/<aula>)`) |

Na redação (`enem-redacao*`), a "questão comentada" não é cobrada: o exemplo é o trecho de redação comentado.
"Questões oficiais para treinar" **não se escreve à mão**: a página monta a lista a partir de `questoes-oficiais/` (as
questões classificadas cujo campo `aulas` cita a aula).

Esqueleto:

````markdown
---
titulo: "Porcentagem no ENEM"
resumo: "Calcular porcentagens, aumentos e descontos do jeito que a prova cobra."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "…"
    autor: "…"
    url: "https://…"
quiz:                    # 3 ou mais; a posição da certa (resposta, a partir de 0) varia entre as questões
  - pergunta: "…"
    opcoes: ["…", "…", "…", "…"]
    resposta: 2
    explicacao: "…"
---

```provocacao
…
```

## O que você vai aprender
…
## (explicação, uma ideia por seção, ≥ 250 palavras no total)
…
```verificar
…
```
## Exemplo resolvido
…
## Como isso cai no ENEM
- **Formatos:** …
- **Habilidades:** H3 (resolver problemas com conhecimentos numéricos), H16 …
- **Armadilhas:** …
## Questão comentada
**Texto-base.** …
**Comando.** …
A) … B) … C) … D) … E) …
**Resolução.** passo a passo … **Gabarito: C.**
**Por que as outras não:** A) … B) … D) … E) …
## Resumo
- …
## Para aprofundar
- [Porcentagem](/trilhas/matematica-fundamental/porcentagem)
````

Regras: frases curtas; palavra difícil explicada na primeira vez; nada de ponto, ranking ou sequência de dias; toda
afirmação com fonte; data da edição só por `{{enem:…}}`; nada copiado de cursinho ou livro; texto-base de terceiros só em
domínio público ou licença livre, com crédito; sem `revisoes` nem `revisada: true`.

## 4. Exercícios com as etiquetas do ENEM

Formato de `docs/EXERCICIOS.md`, mais estes campos (validados por `lib/exercicios.ts` e, contra a matriz, por `testar:enem`):

```yaml
- id: enem-mat-porcentagem-07      # prefixo do percurso: enem-<área curta>-<tópico curto>-NN
  tema: "Porcentagem"              # o nome do tópico (ou do objeto), para o Meu estudo agrupar
  area: matematica
  competencia: 1                   # opcional; se vier, tem de bater com a habilidade
  habilidade: 3
  objeto: mat-numeros-porcentagem  # id de objeto ou de tópico de matriz.yml (da mesma área)
  estilo: enem                     # opcional: texto_base + comando (enunciado) + 5 alternativas
  dificuldade: 2
  texto_base: |
    …
  enunciado: "…"                   # o comando
  alternativas:
    - texto: "…"
      erro: "o engano mais comum que leva aqui e como corrigir, sem humilhar"
    - texto: "…"
      certa: true
    …
  explicacao: "…"
  conferir: "…"                    # em toda questão numérica
  fonte: "Questão original do Instituto Lúcia"
  revisao: { status: em-revisao }
```

- Em todo exercício de `content/exercicios/enem-*` as etiquetas `area`, `habilidade` e `objeto` são obrigatórias.
- Por tópico: os três níveis, com pelo menos 2 no estilo ENEM; meta de distribuição 30% / 45% / 25% (níveis 1/2/3).
- **Posição da certa:** distribua de forma equilibrada entre A, B, C, D e E (a tela embaralha os testes das aulas, mas
  o arquivo é lido por quem revisa e pela apostila). `npm run cobertura:enem` mostra a distribuição.

## 5. Mapa curricular: aula → habilidade e objeto

`content/curriculo/<trilha>.yml`, no formato de `lib/mapa-curricular.ts`, com o campo novo `objetos`:

```yaml
fontes:
  - "Matriz de Referência do Enem, Inep: https://download.inep.gov.br/download/enem/matriz_referencia.pdf"
aulas:
  porcentagem-no-enem:
    enem:
      - area: matematica
        competencia: 1
        habilidade: 3
        resumo: "Resolver problemas com conhecimentos numéricos."
        situacao: a-confirmar
    objetos: [mat-numeros-porcentagem, mat-numeros-aumentos-e-descontos]
```

`situacao` nasce `a-confirmar`; só um educador que conferiu muda para `confirmado`. A competência tem de ser a da habilidade
(todas as áreas são conferidas).

## 6. Provas oficiais: a camada do instituto

`public/questoes/enem-<ano>.json` é regravado toda semana pelo importador (`scripts/importar-questoes.mjs`): **não edite**.
A nossa camada fica em `content/enem/questoes-oficiais/<ano>.yml`:

```yaml
ano: 2023
questoes:
  - id: enem-2023-136              # o id do importador
    area: matematica               # auditada pela numeração (veja abaixo); o validador recusa se não bater
    competencia: 1
    habilidade: 3
    objeto: mat-numeros            # objeto de matriz.yml (da mesma área)
    topico: mat-numeros-porcentagem   # opcional, mais fino
    dificuldade: 2                 # estimada pela equipe (1 a 3)
    situacao: a-confirmar
    gabarito: C                    # a letra certa; o validador confere com o gabarito importado
    resolucao: |
      Passo a passo, com as contas.
    enganos:                       # o engano por trás de cada alternativa errada (todas menos a certa)
      A: "…"
      B: "…"
      D: "…"
      E: "…"
    aulas: [enem-reta-final/matematica-o-essencial]   # "trilha/aula" onde estudar
```

**Área auditada.** A fonte importada traz áreas trocadas em várias edições (contagens diferentes de 45). A área certa sai
da posição no caderno (`areaPelaNumeracao`, em `lib/enem.ts`): até 2016, 1–45 Humanas, 46–90 Natureza, 91–135 Linguagens
(91–95 língua estrangeira), 136–180 Matemática; desde 2017, 1–45 Linguagens (1–5 língua estrangeira), 46–90 Humanas,
91–135 Natureza, 136–180 Matemática. A mudança de 2017 (redação e Linguagens com Humanas no 1º domingo) está em
<https://portal.mec.gov.br/ultimas-noticias/418-enem-946573306/46041-enem-passa-a-ser-realizado-em-dois-domingos-seguidos>;
a posição da língua estrangeira (91–95 até 2016, 1–5 desde 2017) confere com os próprios arquivos importados.

**Resolução original.** Escreva com as suas palavras; não copie resolução de cursinho. Questão que depende de imagem:
abra a imagem (o link está em `imagens` do JSON), descreva na resolução o que é preciso dela e marque `imagem: true`.
Ordem de trabalho: das edições mais recentes para as mais antigas.

## 7. Incidência: o que mais cai

`content/enem/incidencia.yml` é **gerado** (`npm run incidencia:enem`) a partir das classificações: para cada área, quantas
questões caem em cada objeto e em cada habilidade, nas últimas 10 edições classificadas, e a parte (porcentagem) sobre as
questões classificadas da área. `testar:enem` falha se o arquivo estiver desatualizado. É contagem nossa: nunca escreva um
número de incidência que não saia daqui. Enquanto poucas edições estiverem classificadas, diga a base ("nas provas de 2023,
classificadas pelo instituto").

## 8. Redação

`content/enem/redacao/`:

- `temas-oficiais.yml`: `ano`, `aplicacao` ("regular", "reaplicação", "PPL"), `tema` e `fonte` (página oficial do Inep ou do MEC).
- `propostas.yml`: propostas de treino originais: `id`, `tema`, `eixo` (um de `EIXOS_DA_REDACAO`), `recorte` (o que o tema
  pede e onde mora a fuga ou o tangenciamento), `textos` (2 a 4 motivadores, cada um com `fonte`: texto original do instituto
  ou fonte livre com licença), `fonte` e `revisao: { status: em-revisao }`.
- `repertorio.yml`: `id`, `titulo`, `eixos`, `tipo` (`lei`, `dado`, `obra`, `pensador`, `fato-historico`, `conceito`), `resumo`,
  `como_usar`, `fonte` (`titulo`, `autor`, `ano`, `url`; nunca link direto para PDF) e `coringa: true` para os que servem a
  muitos temas. A Cartilha 2026 alerta contra o "repertório de bolso" decorado e sem ligação com o tema: o `como_usar` mostra
  a ligação, não só o enfeite.
- `modelos/` e `grade.yml`: Onda 7.

## 9. Roteiros

| Comando | O que faz |
| --- | --- |
| `npm run testar:enem` | confere tudo de `content/enem/` e as ligações; testa as funções puras (fatos, numeração, incidência, plano, TRI, Sisu) |
| `npm run cobertura:enem` | relatório por área, competência, habilidade e objeto; grava `docs/enem/COBERTURA.md` e `docs/enem/FATOS.md` |
| `npm run fila:enem` | grava `docs/enem/FILA-DE-REVISAO.md`: o que está em revisão, por disciplina e função |
| `npm run incidencia:enem` | refaz `content/enem/incidencia.yml` (com `-- --conferir`, só confere) |
| `npm run pendencias -- <trilha>` | aula por aula: as seis partes e as seções do percurso |

## 10. Como produzir uma área (guia para as equipes)

1. **Leia** este guia, `docs/MODELO-DE-AULA.md`, `docs/EXERCICIOS.md` e a área em `content/enem/matriz.yml`.
2. **Crie as trilhas** da área (seção 1: slug e ordem), cada uma com `_trilha.md` (`area: enem`, `etapa: medio`, `ordem`),
   `plano.json` (todas as aulas previstas, uma ou mais por tópico) e `content/curriculo/<trilha>.yml`. Trilha com mais de
   ~30 aulas vira duas.
3. **Para cada tópico**, escreva a aula (seção 3) e o arquivo de exercícios (seção 4): pelo menos 4 por aula e 10 por
   habilidade ao fim da área, nos três níveis, 2 ou mais no estilo ENEM, certa em posição equilibrada.
4. **Ligue** a aula no mapa curricular (habilidades e `objetos`).
5. **Classifique e resolva** as questões oficiais da área (seção 6), das edições mais recentes para as mais antigas, e
   ponha em `aulas` a aula que ensina aquilo. Rode `npm run incidencia:enem`.
6. **Glossário**: verbete para cada conceito-chave que ainda não exista em `content/glossario`.
7. **Revisão independente**: um revisor que não escreveu aplica `docs/CHECKLIST-DE-REVISAO.md` e confere fatos e contas;
   o parecer vai para `docs/enem/revisao-onda-N.md`. Isso não é a revisão do site: nada de `revisoes` nem `revisada`.
8. **Confira**: `npm run testar:enem`, `testar:exercicios`, `pendencias -- <trilha>`, `cobertura:enem`, `fila:enem`, lint,
   typecheck e build.
9. **Relatório** em `docs/enem/RELATORIO-ONDA-N.md` (o que entrou, cobertura antes e depois, fatos, o que ficou).

## 11. Todo ano: atualizar a edição

1. Quando o Inep publicar o edital, abra a página de legislação do ano (`https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enem/<ano>`).
2. Copie `content/enem/edicao.yml`, troque `edicao`, as `fontes` e, fato por fato, `valor`, `item`, `trecho` e `conferido`.
   O que o edital não fixar fica `confirmar-no-edital`.
3. Confira a Cartilha do Participante da redação do ano (número de linhas, motivos de nota zero, elementos da intervenção).
4. Rode `npm run testar:enem` e `npm run cobertura:enem` (que refaz `docs/enem/FATOS.md`). Nenhuma aula precisa mudar:
   elas citam os fatos por `{{enem:…}}`.
5. Acrescente o tema da redação do ano em `redacao/temas-oficiais.yml` e, quando o importador trouxer a prova nova,
   comece a classificação por ela.

## 12. O que é proibido

- Inventar dado, data, número de incidência, nota de corte ou nota TRI. O simulado mostra acertos por habilidade, nunca uma
  nota oficial.
- Correção automática da redação por IA, ou ligar o assistente pago.
- Copiar questão, resolução ou texto de cursinho, livro protegido, letra de música ou poema protegido.
- Editar `public/questoes/*.json` à mão.
- Marcar como revisado (`revisoes`, `revisada: true`, `status: revisada`, `situacao: confirmado`) sem revisão humana.
