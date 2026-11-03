# Escola Lúcia Maria (Etapa 4)

A Escola Lúcia Maria é a parte do site em `/[idioma]/escola`: escola popular e gratuita, **sem cadastro**. Ela **não é universidade e não dá diploma**: dá caminho, turma e registro do que a pessoa estudou. Na interface ela nunca se chama universidade. "A universidade da classe trabalhadora" é frase só de divulgação e não entra no site.

Este arquivo é o índice. Cada pacote da etapa escreve o seu `docs/escola/<pacote>.md`.

## Ligar e desligar

Tudo fica atrás do recurso `escola` (`lib/recursos.ts`, `docs/RECURSOS.md`). Ele **só liga pelo nome**: `todos` não basta, porque a produção usa `NEXT_PUBLIC_RECURSOS=todos`. Para ligar, use `NEXT_PUBLIC_RECURSOS=todos,escola`.

- Desligado, o layout de `/escola` responde "não encontrado" para todas as páginas de baixo, e a barra do celular, o menu do topo e o índice do site ficam como antes.
- Fora de `/escola`, tudo o que a etapa acrescenta fica atrás de `ligado("escola")`.

> **Não ligar `escola` em produção antes de o texto "Quem foi Lúcia Maria" chegar.**

## Arquitetura

| Peça | Arquivo | O que faz |
| --- | --- | --- |
| Moldura | `app/[lang]/escola/layout.tsx` | confere a flag, põe `data-escola` no invólucro e a faixa de links (`NavDaEscola`). O E4-09 acrescenta `data-semestre` no mesmo invólucro |
| Rotas | `lib/escola/rotas.ts` | `{chave, caminho, pacote}` de cada página, quais entram na faixa e quais começam provisórias |
| Estudante | `lib/escola/estudante.ts` | matrícula, inscrições, caderneta, abertura vista e `apagarEscola()`, só no aparelho |
| Ganchos | `components/escola/guardado-escola.ts` | `useMatricula`, `useInscricoes` e `useCaderneta`, sem diferença de HTML na hidratação |
| Tempo | `lib/escola/tempo.ts` e `content/escola/ano-letivo.json` | `semestreDe`, `semanaDeProvas` e `hojeEmBrasilia` |
| Cursos | `lib/escola/cursos.ts` (puro) e `lib/escola/cursos-servidor.ts` (fs) | formato, validação, horas estimadas e progresso; `carregarCursos()` lê `content/escola/cursos/` |
| Textos | `lib/escola/textos.ts` e `i18n/escola/<pacote>/*.json` | `escolher(dicionarios, lang)`, `textosDaBase(lang)` e o trecho publicado do "Quem somos" |
| Páginas provisórias | `components/escola/EmConstrucao.tsx` | "Esta parte da Escola está sendo montada", com noindex. O pacote dono substitui a sua |

Os arquivos `lib/escola/*.ts` não usam `@/`: os testes os rodam direto no Node (`scripts/carregar-ts.mjs`).

## Chaves no aparelho

Tudo o que a Escola guarda fica no `localStorage` de quem estuda, com `try/catch`, e cada escrita dispara o evento `lucia:estudo`. O servidor só recebe contagem anônima ou o que a pessoa mandar de propósito.

| Prefixo | Cópia de segurança | "Apagar meus dados" |
| --- | --- | --- |
| `lucia:escola:` | entra | apaga |
| `lucia:escola-privado:` | **não** entra | apaga |

As chaves reservadas estão em `CHAVES_DA_ESCOLA` e `CHAVES_PRIVADAS` (`lib/escola/estudante.ts`): `matricula`, `cursos`, `plano`, `passaporte`, `avaliacoes`, `provas`, `explicacoes`, `tarefas`, `projeto`, `caderneta`, `assembleia`, `contou`, `abertura-vista`, `avisos-lidos`, `missoes`, `ouvidoria-protocolos`, `leituras`, `circulos` e `meu-documento`, além de `lucia:escola-privado:conversas` e `lucia:escola-privado:trabalho`.

**Pacote que precisar de chave nova usa um dos dois prefixos, sem editar `lib/escola/estudante.ts`.** Chave fora desses prefixos só com registro em `lib/estudo.ts` (`CHAVES_DA_COPIA` ou `SO_APAGAR`), feito pelo dono de `lib/estudo.ts` na onda. Quem não for o dono anota no relatório.

### A lista "só apagar"

`lib/estudo.ts` exporta `SO_APAGAR` e `PREFIXOS_SO_APAGAR`, mais `chavesSoApagar(armazenamento)`. São chaves que ficam **fora** da cópia de segurança, mas que o "apagar meus dados" (`components/DataPanel.tsx`) apaga, porque a página de privacidade promete que tudo sai:

- `lucia:historico`, `lucia:historico-ligado` (por onde andei, E4-05)
- `lucia:radio-retomar` (E4-06)
- `lucia:modo-pacote-convite` (E4-17)
- prefixos `lucia:escola-privado:` e `lucia:ajudou-contou:` (as marcas do +1 anônimo do "Isso ajudou?", E4-02)

O "apagar" também chama `apagarEscola()` e tenta `indexedDB.deleteDatabase("lucia-explicacoes")` (E4-10), sem erro se a base não existir.

Na onda 1 entram na cópia, além do prefixo da Escola, `lucia:posicao-da-aula`, `lucia:aula-em-partes` e `lucia:uma-mao` (E4-03).

Chaves novas da onda 4 (todas dentro dos dois prefixos, sem editar `estudante.ts`):

- E4-17 ([leveza](escola/leveza.md)): `lucia:escola:aula-leve` (entra na cópia, sai no apagar) e `lucia:modo-pacote-convite` (fora da cópia, em `SO_APAGAR`); a preferência `pacote` vive dentro de `lucia:acessibilidade`.
- E4-11 ([vida](escola/vida.md)): `lucia:escola:tarefas` e `lucia:escola:missoes` (entram na cópia); `lucia:escola-privado:vozes` e `lucia:escola-privado:caso-do-bairro` (fora da cópia); IndexedDB `lucia-explicacoes` (áudios, apagada no "apagar meus dados").
- E4-12 ([organização](escola/organizacao.md)): `lucia:escola:assembleia`, `lucia:escola:roda-do-semestre` e `lucia:escola:ouvidoria-protocolos` (entram na cópia).
- E4-14 ([formatura](escola/formatura.md)): `lucia:escola:caderneta` e `lucia:escola:projeto` (entram na cópia, e `restaurarCopia` junta por id e por curso, sem substituir) e `lucia:escola-privado:mural-rascunho` (fora da cópia).
- E4-16 ([agentes](escola/agentes.md)): `lucia:escola-privado:ensaios` (só números), `lucia:escola-privado:conversas` (o histórico do acompanhante, compartilhado) e, em `sessionStorage`, `lucia:escola-privado:rascunho-para-revisao` (lido uma vez e apagado).

## Formato do curso

Explicado em `content/escola/cursos/LEIA-ME.md`. Em resumo: um `<slug>.json` por curso; só aulas que existem (`trilha/aula`, o slug do endereço); pelo menos 6 aulas e nenhuma repetida; patrono só do Memorial; leituras só do Acervo; requisitos sem ciclo. As horas são **estimativa** (leitura + 2 min por questão + 3 min por exercício, arredondadas para meia hora). `npm run testar:escola` valida todos os arquivos da pasta.

## Convenção de textos

- Textos de interface: `i18n/escola/<pacote>/{pt,en,es,fr,ru,zh}.json`, **completos nos 6 idiomas**. O servidor importa os seis, escolhe com `escolher(dicionarios, lang)` e passa a parte de cada componente por props. O componente de cliente importa só tipos. Esses textos não entram no núcleo do i18n.
- Conteúdo (aulas, cursos) fica em português, como no resto do site.
- `npm run testar:textos-escola` percorre **todas** as pastas `i18n/escola/*/` e falha quando falta chave do português, quando há valor vazio ou quando um texto diz universidade ou diploma (universidade, universidad, university, université, университет, 大学, diploma, diplôme, диплом, 文凭, 学位). Só ficam liberadas as chaves com `nao` no nome, que são as negações.
- Nada inventado: fato com fonte; pessoa só do Memorial; curso só com aula que existe; data só com fonte ou marcada como "proposta". Texto escrito pelo pacote (pergunta, tarefa, roteiro, termo) leva a marca "em revisão" e não é atribuído a ninguém. O que precisa da coordenação leva "[A REVISAR PELA COORDENAÇÃO]".

## Processos da coordenação

### Texto "Quem foi Lúcia Maria"

1. A coordenação escreve o texto (sem foto, a não ser que decida pôr e tenha a autorização de uso da imagem).
2. O texto substitui o marcador `[TEXTO A ENVIAR PELA COORDENAÇÃO]` em `content/escola/quem-foi-lucia-maria.md`. Pode usar Markdown. O mesmo texto aparece nos 6 idiomas (a moldura é traduzida e avisa "texto em português") e no 2º quadro da abertura.
3. Ajustar o teste "Quem foi Lúcia Maria tem só o marcador" em `scripts/testar-escola.mjs` e a conferência do marcador em `e2e/escola-base.spec.ts`.
4. Só então ligar `escola` em produção.

Esta página não se mistura com `/dedicatoria`, que fala do nome "Lúcia" do instituto.

### Ano letivo

`content/escola/ano-letivo.json` traz datas **propostas** pelo plano (1º semestre de 01/02 a 30/06; 2º de 01/08 a 15/12; provas nas duas últimas semanas). Enquanto `"confirmado": false`, a interface mostra "Calendário proposto, a confirmar pela coordenação". Para confirmar: a coordenação decide as datas e os recessos, alguém atualiza o JSON e troca para `"confirmado": true`, e `npm run testar:escola` passa a conferir as datas novas (ajustar os casos de borda do teste).

## Pacotes da etapa

| Onda | Pacote | Assunto | Arquivos compartilhados de que é dono na onda | Depende de | Documento |
| --- | --- | --- | --- | --- | --- |
| 1 | E4-01 | Fundação: rota, Quem foi Lúcia Maria, abertura, estudante, tempo, cursos, navegação, recursos por padrão, testes | `lib/recursos.ts`, `lib/estudo.ts`, `components/BottomNav.tsx`, `components/celular/BarraDoCelular.tsx`, `lib/interdicao.ts` (todas as ondas), `i18n/*.json` principais, `package.json` e `ci.yml` (todas as ondas) | — | [base](escola/base.md) |
| 1 | E4-02 | Banco da Escola (só acréscimo): contagens anônimas, presença, turmas, ouvidoria, "Isso ajudou?" somado | `scripts/alvos-de-contagem.mjs`, `content/paginas/privacidade.md` | — | [banco](escola/banco.md) |
| 1 | E4-03 | A aula por dentro | página da aula, `components/aula/BarraDaAula.tsx`, `lib/vozes/leitor.ts`, `lib/content.ts` | — | [aula](escola/aula.md) |
| 1 | E4-04 | Acesso e confiança | `playwright.config.ts` | — | [acesso](escola/acesso.md) |
| 1 | E4-05 | Busca que entende pergunta, por onde andei, modo seguro | `components/BuscaDoTopo.tsx`, `lib/indice-de-busca.ts`, `components/estudo/Praticar.tsx`, `app/[lang]/layout.tsx` | — | [busca](escola/busca.md) |
| 2 | E4-07 | Cursos | página da aula, `next.config.ts` | E4-01, E4-02, E4-03, E4-05 | [cursos](escola/cursos.md) |
| 2 | E4-08 | Matrícula, carteirinha, plano da semana, quem volta | — | E4-01, E4-02, E4-04 | [matrícula](escola/matricula.md) |
| 2 | E4-10 | Acompanhante do estudante | `supabase/functions/assistente/assistente.ts`, `BarraDaAula.tsx`, `Exercicio.tsx`, `privacidade.md` | E4-01, E4-03, E4-04, E4-05 | [acompanhante](escola/acompanhante.md) |
| 3 | E4-06 | Som do campus | `lib/radio.ts`, `components/RadioPlayer.tsx`, `next.config.ts` | E4-01, E4-03 | [som](escola/som.md) |
| 3 | E4-09 | Campus e calendário | `components/MaisGaveta.tsx`, `lib/secoes-do-site.ts`, `app/[lang]/layout.tsx` | E4-01, E4-02, E4-03, E4-05 | [campus](escola/campus.md) |
| 3 | E4-13 | Avaliação e aprender ativo | `lib/estudo.ts`, página da aula | E4-01, E4-03, E4-07, E4-10 | [avaliação](escola/avaliacao.md) |
| 3 | E4-15 | Turmas por curso | — | E4-01, E4-02, E4-07 | [turma](escola/turma.md) |
| 4 | E4-11 | Vida real e vozes | `lib/interativos-mais.ts` ou `lib/interativos.ts` | E4-01, E4-04 | [vida](escola/vida.md) |
| 4 | E4-12 | Núcleos e organização estudantil | — | E4-01, E4-02, E4-04 | [organização](escola/organizacao.md) |
| 4 | E4-14 | Do projeto final à formatura | `lib/turma.ts`, `scripts/testar-estudo.mjs` | E4-01, E4-02, E4-07, E4-08, E4-11, E4-13, E4-15 | [formatura](escola/formatura.md) |
| 4 | E4-16 | Agentes de trabalho, turma e equipe | — | E4-01, E4-07, E4-10 | [agentes](escola/agentes.md) |
| 4 | E4-17 | Leveza e alcance | `lib/prefs.ts`, `lib/content.ts`, página da aula, `next.config.ts` | E4-01, E4-03, E4-04 | [leveza](escola/leveza.md) |

Os documentos de cada pacote são os nomes declarados no desenho da etapa (`docs/plano-2026-11/notas/etapa4-desenho.json`).

## Testes da etapa

Os scripts estão todos reservados no `package.json` (só o E4-01 edita esse arquivo). `npm run testar:etapa4` roda em sequência todo teste da etapa cujo arquivo já existe, diz quais ainda faltam e falha se algum falhar. O CI o roda depois de `testar:estudo`. `testar:entrada` (Playwright, celular de entrada) precisa do site no ar e roda à parte.
