# O desenho das páginas: Caderno do Povo

Todas as páginas do site seguem o mesmo desenho, o **Caderno do Povo**: papel de caderno, sombra dura preta ou vermelha, letra de livro nos títulos, letra de máquina nos rótulos, carimbos e faixas de jornal operário. Este guia diz como montar uma página nova (ou refazer uma antiga) para ela ter a mesma cara do resto.

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

### Miolo: `<Corpo largura="estreita | media | larga">`

- `estreita` (48rem): texto corrido, termos, privacidade, guias.
- `media` (64rem): listas, formulários com explicação ao lado.
- `larga` (78rem): grades de cartões, estantes, painéis de dados.

### Seções: `<Secao titulo="Lutas" tarja="vermelha" id="lutas" acao={<Link …>Ver todas →</Link>}>`

A etiqueta com a estrela e o fio até o fim da linha. Alterne `preta` e `vermelha` quando houver muitas seções seguidas.

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
- **Texto sempre do dicionário** (`i18n/*.json`), nos seis idiomas, conferido com `npm run conferir:i18n`.
- **Celular primeiro**: tudo precisa funcionar em 375 px, sem rolagem lateral, com alvos de toque de 44 px ou mais.
- **Dois temas e alto contraste**: confira a página no claro, no escuro e com o alto contraste ligado (menu de acessibilidade).
- **Nada apertado**: respiro generoso entre as seções (`gap-10` a `gap-14`), títulos grandes, leitura em 18 a 21 px.
- **Sem gamificação**: nada de pontos, rankings, sequências ou prêmios.
- **Sem "cara de app genérico"**: nada de degradê, cartão com borda colorida à esquerda, sombra borrada ou cantos arredondados. A sombra é dura e o canto é reto.
