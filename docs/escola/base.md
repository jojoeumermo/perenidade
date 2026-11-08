# E4-01: fundação da Escola Lúcia Maria

Pacote da onda 1 da Etapa 4. É a base que os outros pacotes usam. O índice da etapa está em `docs/ESCOLA.md`.

## O que entrou

- **Recurso `escola`** em `lib/recursos.ts`, com `PADRAO` (R1-12), `-nome`, `nenhum` e `SO_PELO_NOME`. Veja `docs/RECURSOS.md`.
- **Rotas** (`app/[lang]/escola/`): a entrada, `quem-foi-lucia-maria` e 17 páginas provisórias (`cursos`, `matricula`, `carteirinha`, `plano`, `campus`, `calendario`, `acompanhante`, `vozes`, `lutas`, `assembleia`, `ouvidoria`, `educador-do-mes`, `provas`, `saberes`, `formatura`, `caderneta`, `turmas`), com noindex. O dono de cada uma está em `lib/escola/rotas.ts`.
- **Entrada**, nesta ordem: título e a linha honesta ("Não é universidade e não dá diploma"); o cartão "Quem foi Lúcia Maria" como primeiro item; "Como funciona" em 5 passos com links; o bloco `{/* E4-08: quem volta */}`; Campus e Calendário (com "Calendário proposto, a confirmar pela coordenação").
- **Quem foi Lúcia Maria**: lê `content/escola/quem-foi-lucia-maria.md`, com o texto publicado: em primeira pessoa, escrito pelo neto (o criador do Instituto) só com os fatos de `docs/escola-revolucionaria/FONTES-LUCIA-MARIA.md`. O 2º quadro da abertura mostra só o 1º parágrafo dele (`aberturaDoQuemFoi` em `lib/escola/quem-foi.ts`). O texto é o mesmo nos 6 idiomas; só a moldura é traduzida. Não tem foto e não se mistura com `/dedicatoria`.
- **Abertura (R1-65)**, em `components/escola/AberturaDaEscola.tsx`: aparece só na primeira visita (`lucia:escola:abertura-vista`). "Pular" fica sempre à vista, Esc fecha, o foco fica preso na camada e volta para onde estava. São 4 quadros de 10 s que avançam sozinhos só sem movimento reduzido; com ele, com o `data-parado` do site, no leitor de tinta ou no modo leve, o quadro só muda pelo "Seguir", sem animação.
  - Quadro 3: trecho **copiado** do "Quem somos" publicado, extraído do arquivo por `trechoDoQuemSomos` (a última frase do 2º parágrafo de "O fundador"). Em en, es, ru e zh usa a tradução já publicada. Em francês, onde não há tradução, mostra o original com "(texto em português)". O teste confere que o trecho aparece literalmente em cada arquivo.
  - "Ouvir" usa o leitor do site (`lib/vozes/leitor.ts`) com a voz escolhida em "Ouvir a aula". Por padrão é a voz do aparelho. Se a escolhida for uma voz natural ainda não baixada, o botão **pergunta antes** e mostra o tamanho em MB.
- **Estudante** (`lib/escola/estudante.ts`): número `LM-XXXX-XXXX` em base32 de Crockford a partir de `crypto.getRandomValues`, matrícula validada (forma errada vira `null`), inscrições (inscrever, trancar, formatura, dispensa), caderneta (até 500 registros), abertura vista e `apagarEscola()`.
- **Tempo** (`lib/escola/tempo.ts`): `semestreDe`, `semanaDeProvas` (os 14 últimos dias do semestre) e `hojeEmBrasilia` (a mesma conta de `lib/lambe-do-dia.ts`). Um recesso conta como férias, sem trocar de semestre.
- **Cursos** (`lib/escola/cursos.ts` e `cursos-servidor.ts`): tipo, `validarCurso`, `tempoDaAula`, `horasDoCurso`, `horasFeitas`, `aulaAtual`, `proximaDoCurso` e `moduloDe`. A aula é procurada pelo slug do endereço, sem o número do arquivo (`matematica-fundamental/fracoes` → `01-fracoes.md`), e as aulas com `ativo: false` ficam de fora, como no resto do site.
- **Navegação (R1-14)**: com `escola`, a barra de baixo fica Início, Estudar (`/escola`), Meu estudo, Campus (abre o "Mais") e Buscar (`/busca`). O menu do topo ganha "Escola", o índice do site ganha o item no grupo de estudo e a barra de cima trata `escola` e `meu-estudo` como abas.
- **Apagar**: `components/DataPanel.tsx` apaga também a lista "só apagar", a Escola inteira e a base `lucia-explicacoes`.
- **Interdição**: `/escola`, `/libras` e `/aula-do-dia` entram na área `estudo`; `por-onde-andei` e `modo-seguro` entram na lista de páginas gerais do teste.
- **Scripts e CI**: os 24 scripts da etapa reservados no `package.json`. `testar:etapa4` roda no CI depois de `testar:estudo`.

## Decisões que mudam o desenho

1. **`todos` não liga a Escola.** A produção usa `NEXT_PUBLIC_RECURSOS=todos` (conferido em 03/11/2026 no código publicado de institutolucia.org). Com a regra literal do desenho ("ligado se a variável é `todos`"), a Escola abriria no ar assim que o código entrasse no master, antes do texto de Lúcia Maria. Por isso `escola` está em `SO_PELO_NOME`: só liga com o nome na lista (`todos,escola`).
2. **`PADRAO` com 12 recursos**: `meu-estudo`, `exercicios`, `revisoes`, `turma`, `professores`, `mapa-curricular`, `nivelamento`, `metas`, `vlibras`, `ajudou`, `guia-contribuir` e `pratica-sem-placar`. Os dois documentos os dão como testados, e a produção os liga hoje por meio de `todos`. `enem-curso` e `enem-video` ficam de fora porque `docs/RELATORIO-ESTUDO-NO-APARELHO.md` não os cobre. Na produção, nada muda. Na prévia e na cópia local sem variável, esses 12 passam a nascer ligados.
3. **A flag é conferida no layout** (`notFound()` em `app/[lang]/escola/layout.tsx`), e não em cada página. Assim as páginas que os outros pacotes vão escrever no lugar das provisórias ficam protegidas sem precisar lembrar disso.
4. **Sem `generateStaticParams` em `/escola`**: a página não tem segmento próprio. Os 6 idiomas já saem estáticos pelo `generateStaticParams` de `app/[lang]/layout.tsx`.
5. **Barra de baixo com 5 abas**: são os 4 destinos do R1 mais o Início, que fica porque a página inicial do celular é o painel de quem volta. Acervo e Comunidade continuam no Campus (o "Mais", onde no celular aparece tudo) e nos atalhos.
6. **Os casos de `PADRAO`, `-nome` e `nenhum`** foram para `scripts/testar-meu-estudo.mjs`, que é o teste que lê `lib/recursos.ts`. O desenho fala em "testar:estudo", mas esse script não lê os recursos. Os casos antigos "sem variável, tudo desligado" e "todos liga tudo" deixaram de valer e foram trocados.
7. **`testar:entrada`** foi reservado como `playwright test --project=entrada` (o projeto do E4-04). Fica fora do `testar:etapa4` porque precisa do site no ar.

## Como testar

```
npm run testar:escola          # estudante, tempo, cursos (inclui TODOS os de content/escola/cursos), rotas, trecho
npm run testar:textos-escola   # todas as pastas i18n/escola/*/
npm run testar:meu-estudo      # PADRAO, -nome, nenhum, SO_PELO_NOME
npm run testar:interdicao
npm run testar:etapa4
```

Ponta a ponta (`e2e/escola-base.spec.ts`), com o site montado com a Escola:

```
NEXT_PUBLIC_RECURSOS=escola npm run dev:local
BASE_URL=http://localhost:3100 npx playwright test e2e/escola-base --project=computador --project=celular
```

Sem a flag, os testes de ponta a ponta são pulados.

## Pendências para a coordenação

- Mandar o texto "Quem foi Lúcia Maria" (processo em `docs/ESCOLA.md`). **Não ligar `escola` em produção antes disso.**
- Confirmar o ano letivo (`content/escola/ano-letivo.json`, hoje `"confirmado": false`).
- Decidir se a prévia da Vercel deve ter `NEXT_PUBLIC_RECURSOS` própria. Sem ela, a prévia passa a nascer com os 12 recursos padrão.
