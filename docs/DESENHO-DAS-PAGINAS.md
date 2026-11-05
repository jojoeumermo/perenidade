# O desenho das páginas: Caderno do Povo

As páginas do site público seguem o mesmo desenho, o **Caderno do Povo**: papel de caderno, sombra dura preta ou vermelha, letra de livro nos títulos, letra de máquina nos rótulos, carimbos e faixas de jornal operário. Este guia diz como montar uma página nova (ou refazer uma antiga) para ela ter a mesma cara do resto, e, no fim, **quais lugares fogem do desenho de propósito e por quê** (o painel, o Vale o Escrito, as páginas dos coletivos, a Rede v2 e a casca do aplicativo).

Hoje há duas famílias de abertura de página: a **`<Capa>`** (faixa de ponta a ponta, descrita abaixo, usada em cerca de 20 arquivos, entre eles `/jogos`) e o **`<PageHeading>`** (`components/PageHeading.tsx`: rótulo, título e linha fina dentro de uma coluna, usado nas páginas mais simples, como `/imprensa` e `/laboratorios/externos`). Página nova de leitura ou de escolha usa a `Capa`; página de formulário ou texto curto pode usar o `PageHeading`. Não misture as duas na mesma página.

## As peças

### Capa da página: `components/pagina/Capa.tsx`

```tsx
import { Capa, Corpo, Secao } from "@/components/pagina/Capa";

<Capa rotulo={s.eyebrow} titulo={s.title} destaque="do povo" tom="papel" lado={<CartaoDeDestaque />} acoes={<Link className="botao botao-prelo" …>…</Link>}>
  {s.lead}
</Capa>
```

- **Faixa de ponta a ponta**, logo abaixo do cabeçalho do site. Nunca dentro de uma coluna estreita.
- `tom`: `papel` (papel pontilhado: o padrão, para estudar e ler), `preto` (arquivo, rádio, memória, checagem) ou `vermelho` (chamada para ação: apoio, assembleia, voluntariado).
- `destaque`: uma palavra ou trecho em itálico vermelho depois do título. Use pouco: uma por página.
- `lado`: o que a página põe em evidência à direita (um cartaz, um número, um cartão preto). No celular, desce para baixo do título.
- `acoes`: um ou dois botões (`.botao botao-prelo`, `.botao botao-tinta`, `.botao botao-papel`).
- `estrela`: a estrela grande recortada no canto, só nas capas preta e vermelha.
- `largura`: `estreita`, `media` ou `larga` (padrão `larga`).

### Miolo: `<Corpo largura="estreita | media | larga">`

- `estreita` (48rem): texto corrido, termos, privacidade, guias.
- `media` (64rem): listas, formulários com explicação ao lado.
- `larga` (78rem): grades de cartões, estantes, painéis de dados.

### Seções: `<Secao titulo="Lutas" tarja="vermelha" id="lutas" acao={<Link …>Ver todas →</Link>}>`

A etiqueta com a estrela e o fio até o fim da linha. Alterne `preta` e `vermelha` quando houver muitas seções seguidas. A `Secao` aceita `descricao` (a linha fina embaixo do título) e `className`; a página `/jogos` tem exemplos de todas.

## As classes do sistema (app/globals.css)

| Classe | O que é |
| --- | --- |
| `.pont` | papel pontilhado (fundo das áreas de escolha) |
| `.pauta` | papel pautado (fundo de leitura) |
| `.cartao` | cartão de papel com sombra dura preta |
| `.cartao-v` | o mesmo, com a sombra vermelha |
| `.cartao-preto` | cartão preto, letra clara, sombra vermelha |
| `.botao` + `botao-prelo` / `botao-tinta` / `botao-papel` / `botao-menor` | botões que sobem ao passar o mouse e afundam ao clicar |
| `.rotulo` | rótulo de arquivo: letra de máquina, espaçada, em vermelho |
| `.tarja` | etiqueta preta ou vermelha |
| `.lambe` | o grito do lambe-lambe: Inter Black, itálico, maiúsculas |
| `.carimbo` | carimbo redondo e torto |
| `.chip` | filtro ou atalho pequeno |
| `.selo` / `<Selo nome="…">` | pictogramas em traço (`components/Selo.tsx`). **Nunca emoji.** |

Cores (tokens que já mudam sozinhos no tema escuro, no alto contraste e na tinta eletrônica): `--parchment` (papel), `--folha` (folha clara dos cartões), `--ink` (tinta), `--ink-soft`, `--prelo` (vermelho do prelo), `--prelo-texto` (o vermelho que passa no contraste para texto), `--sombra`, `--rule`. Nas classes do Tailwind: `bg-parchment`, `bg-folha`, `text-ink`, `text-ink-soft`, `text-prelo-texto`, `border-ink`, `border-rule`. Os cartões pretos usam as cores fixas `#1f1a14` (fundo) e `#f4ecd8` (letra), iguais nos dois temas.

Letras: `font-serif` (EB Garamond: títulos e leitura), `font-sans` (Inter: botões, menus, formulários), `font-mono` (IBM Plex Mono: rótulos, datas, números de página).

## Regras

- **Nada de emoji**, nem como ícone nem no texto: use `<Selo>` ou um SVG em traço.
- **Texto sempre de dicionário**, nos seis idiomas (português, inglês, espanhol, francês, russo e chinês), conferido com `npm run conferir:i18n`. As páginas grandes têm dicionário próprio em subpasta (`i18n/jogos/`, `i18n/rede/`, `i18n/vale-o-escrito/`, `i18n/escola/`, `i18n/painel/`), com o português como referência final e os outros cinco **marcados como rascunho** (`_rascunho: true`) até alguém de dentro do idioma revisar. Página que só existe em português (a `/imprensa`, o conteúdo dos coletivos) mostra `<Untranslated>` nos outros idiomas e põe `lang="pt"` no trecho; não traduza às pressas.
- **Celular primeiro**: tudo precisa funcionar em 375 px, sem rolagem lateral, com alvos de toque de 44 px ou mais.
- **Dois temas e alto contraste**: confira a página no claro, no escuro e com o alto contraste ligado (menu de acessibilidade).
- **Nada apertado**: respiro generoso entre as seções (`gap-10` a `gap-14`), títulos grandes, leitura em 18 a 21 px.
- **Sem gamificação**: nada de pontos, rankings, sequências ou prêmios. Os jogos do Instituto são de treino e de decisão, sem placar público.
- **Sem "cara de app genérico"**: nada de degradê, cartão com borda colorida à esquerda, sombra borrada ou cantos arredondados. A sombra é dura e o canto é reto.
- **Nada de fora carrega sozinho**: vídeo, mapa, quadro de outro site, jogo pesado e laboratório só carregam depois do clique da pessoa, com aviso do que vai abrir (privacidade e peso). Biblioteca pesada entra por `dynamic import`.
- **Nunca "universidade" nem "diploma"** no texto da interface.
- **O peso da página no deploy conta**: a página não lê disco com caminho dinâmico, e nada que leia disco entra no layout raiz nem em componente global. O limite está em `npm run conferir:rastreio` (veja `docs/MANUTENCAO.md`, seção 10a).

## As páginas novas de novembro de 2026

Cada uma diz como se encaixa no desenho (ou por que foge dele). Quem refizer ou ampliar uma delas deve manter isto.

### Jogos: `/[lang]/jogos`

`Capa` de largura larga, rótulo e título do dicionário `i18n/jogos`. Quatro `Secao` seguidas: **Treino de palavras** (`treino`), **Jogos do Instituto** (`proprios`, 16 cartões: os oito de `JOGOS_PROPRIOS` e os oito de `JOGOS_PROPRIOS_2`), **Para crianças** (`criancas`, tarja vermelha, sons e música) e **Jogos de formação** (`formacao`: Rumos, Greve!, Linha do tempo e Quem disse?). Cada cartão abre o jogo só no clique (`components/jogos/Proprios.tsx` e os `Catalogo.tsx` por `dynamic`), então a página não paga pelo peso dos jogos. Nos idiomas que não são o português, a página avisa que os jogos estão só em português e o trecho leva `lang="pt"`. `/laboratorios/jogos` redireciona (308) para cá. Texto de apoio: `docs/jogos/PAGINA.md` e `docs/JOGOS-PROPRIOS-2.md`.

### Vale o Escrito: `/[lang]/vale-o-escrito`

**É o único lugar do site fora da identidade do Instituto, de propósito:** fundo preto, nós neon (amarelo, azul, vermelho), mono em caixa alta, inspirado no desenho de observatórios de dados, sem copiar código. Todo o estilo mora em `styles/vale-o-escrito.css`, sob a classe `.ve` (nada em `:root`, `html` ou `body`; o tema do site não é tocado), e só é carregado pelos componentes de `components/vale-o-escrito/`. O `layout.tsx` da pasta responde 404 se o recurso `vale-o-escrito` estiver desligado (ele só liga pelo nome) e **não lê disco**; quem lê os dados é a página. O mapa (MapLibre) e a teia (d3-force) carregam sob demanda, e há visões leves em texto para quem não quer ou não pode carregar o gráfico. A **situação jurídica** (suspeito, denunciado, réu, condenado, absolvido…) nunca fica fora da ficha de uma pessoa. As páginas de dentro (`enviar`, `correcao`, `sobre`, `caso`, `pessoa`, `organizacao`) seguem a mesma moldura. Referência: `docs/vale-o-escrito/ESPEC.md`.

### Rede v2: `/[lang]/comunidade` (recurso `rede-v2`)

Quando ligada, a Rede troca o desenho do Caderno por uma **casca de rede social** (`components/rede/Casca.tsx`): no computador três colunas (`250px | 640px | 300px`: menu e botão Escrever, a leitura, busca e cartão de segurança); no celular uma coluna com **barra de baixo própria** (Início, Comunidades, Escrever, Avisos, Perfil) e o Escrever em tela cheia. A barra do site (`.abas-do-celular`) fica escondida enquanto a Rede está aberta, e a casca do aplicativo também não entra nela. Carrega sob demanda (`RedeSobDemanda`, `ssr: false`), com esqueletos. Metadados só com a marca e `noindex`, nunca um trecho de conteúdo. Tela nova entra pelo registro (`components/rede/registro.tsx`), sem editar o resto. Desligada, `/comunidade` continua sendo a Rede e o Fórum de hoje, com o desenho antigo. Referência: `docs/rede/V2.md`.

### Territórios: `/[lang]/territorios` e `/[lang]/territorios/[slug]`

A lista usa o desenho do Caderno, com a faixa de temas (`components/territorios/Letreiro.tsx`: lista escondida para o leitor de tela, cópias que giram em `aria-hidden`, botão de pausa e quieta com movimento reduzido ou modo leve). A página de um coletivo que tem o campo `visual` em `content/territorios.json` (NoizOcupa, Coletivo Kamikaze) usa `components/territorios/PaginaDoColetivo.tsx`, com **identidade própria de cada coletivo** (`lib/territorios-identidades.ts`: cores e letra), criada a partir do que é público, sem copiar arte. O Na Atividade segue com a página dele. Vídeo e post do Instagram só abrem no clique, com aviso de que abre conteúdo da Meta; nenhuma foto de criança; sem contagem de seguidores nem curtidas. Referência: `docs/TERRITORIOS.md`.

### Imprensa: `/[lang]/imprensa`

Página de formulário: `PageHeading` numa coluna `max-w-2xl`, formulário em português (`lang="pt-BR"`) e `<Untranslated>` nos outros idiomas. Pede nome, veículo, e-mail, assunto, mensagem e prazo; sem telefone, documento, rede social, IP nem rastreador. O pedido vai para a caixa de imprensa do painel (`docs/backend-2.md`). Fica no rodapé e no mapa do site (só em português).

### Laboratórios abertos de fora: `/[lang]/laboratorios/externos`

`PageHeading` numa coluna `max-w-5xl` e uma grade de cartões (`components/labs/LabsExternos.tsx`, dados em `content/labs-externos/catalogo.json`). Cada cartão traz **licença e crédito à vista**, a data da conferência e a forma de uso (cópia nossa, quadro sob demanda ou só link). Nada de fora carrega antes do clique em "Abrir"; os quadros usam `sandbox` e `referrerPolicy="no-referrer"`, e só os hosts liberados em `frame-src` no `next.config.ts` abrem. Referência: `docs/LABS-EXTERNOS.md`.

### O aplicativo (casca do celular)

Não é uma página: é a casca que vale no celular (tela abaixo de 768 px) e no site instalado em aparelho de toque (`components/app/`, `app/app-casca.css`, `docs/APP.md`). Troca a barra de baixo do site por cinco abas (Início, Estudar, Jogos e labs, Comunidade, Eu), dá o voltar por gesto da borda esquerda e as transições entre telas, **sem criar rota nova**: o Início do aplicativo é a própria página inicial no celular. Regras para quem desenha uma página que roda dentro dela:

- Reaproveite as classes `.abas-do-celular` e `.aba-do-celular`; não crie barra de baixo própria. As exceções (painel e Rede v2 ligada) já são tratadas por `ehTelaComCascaPropria`.
- Tela de ferramenta, mapa ou desenho com um dedo: marque `data-sem-gesto`. Tela de imersão total: `useTelaCheia(true)` e ofereça o próprio voltar. Nunca escreva em `<html data-casca*>`; só leia.
- Overlay (folha, gaveta, consulta): `useTelaDaVez` e `useTravaDeRolagem` de `components/app/telas.ts`, para nunca haver duas telas abertas nem a rolagem travada para sempre.
- Respeite `prefers-reduced-motion` (a transição vira corte seco) e alvos de toque de 44 px.
- Nada de rede, disco ou contador em `components/app/`.

### O painel

O painel **não usa o Caderno do Povo**: tem identidade própria, sóbria, com tokens `--pn-*` e quatro moldes de tela. O catálogo está em `docs/PAINEL-COMPONENTES.md` e o contrato em `docs/PAINEL-NOVO.md`.

## Antes de dar uma página por pronta

1. Abra no computador e num celular (ou na emulação de 375 px), nos dois temas e no alto contraste.
2. Passe só pelo teclado e confira o foco.
3. Confirme que nenhum recurso de fora carrega antes do clique (aba Rede do navegador).
4. `npm run conferir:i18n` e, se a página tem dicionário próprio, o teste dela (`testar:jogos-pagina`, `testar:territorios`, `testar:labs-externos`, `testar:vale-o-escrito-publico`…).
5. Depois do build, `npm run conferir:rastreio`.
