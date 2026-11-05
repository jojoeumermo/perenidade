# Painel: redesenho completo (contrato)

Pedido da coordenação, nas palavras dela: o painel ficou "extremamente bugado", a sidebar "continua a mesma coisa" e o redesenho completo do painel interno, "mais profissional e com menos cara genérica", não foi feito. Este documento é o contrato do redesenho: a direção visual, os tokens, a casca nova (sem o defeito do grid), o menu lateral, a paleta Ctrl K, o estado da casca (Zustand) com a ajuda para Optimistic UI, os painéis ajustáveis, o movimento (Framer Motion) e os componentes de `ui/`. No fim, a divisão da migração das seções em 8 faixas de arquivos disjuntos.

Vale sobre `docs/PAINEL-NOVO.md` e `docs/PAINEL-COMPONENTES.md` onde os dois discordarem (por exemplo: lá "Garamond só no h1" e "rótulo mono vira Inter"; aqui Garamond volta aos títulos de seção e o mono volta aos rótulos). O resto daqueles documentos (mapa seção, espaço e molde; `confirmar()`; regras de escrita) continua valendo.

Regras que não mudam: nenhuma função do painel sai (só muda a aparência, a organização e a interação); nada do painel entra no layout raiz nem pesa no site público; nada lê disco no cliente; comentários em português com o cabeçalho AGPL; nada de "universidade" nem "diploma".

---

## 1. O defeito em produção, e o conserto de vez

**O que se vê** (1207 px, coordenação): a raiz `.painel` é `lg:grid lg:grid-cols-[auto_minmax(0,1fr)]`; o primeiro filho é um `<section>` vazio de 1024 px por 100vh na coluna 1; o menu (`aside.pn-menu`) cai na coluna 2, à direita; o conteúdo desce para a linha de baixo e começa em y=1150. Há ainda um `aside` fixo `bottom-20 right-4` por cima.

**De onde vem o `<section>`:** é o `<Toaster>` da Sonner, montado por `<AvisosDoPainel />` (`components/painel/ui/Toast.tsx`). A Sonner desenha sempre um `<section aria-label="Notifications …" tabindex="-1">` (a lista de avisos, o `<ol>`, é que é fixa). Ele é o primeiro filho que existe de fato no DOM da raiz, porque os anteriores não desenham nada no lugar (`TraduzirPainel` devolve `null`, `TutorialDoPainel` devolve `null` fechado, `Paleta` e `DialogosDoPainel` vão por portal). O posicionamento automático do grid faz o resto:

| Filho da raiz | Célula | Efeito |
|---|---|---|
| `<section>` da Sonner | linha 1, coluna 1 (`auto`) | ocupa a coluna da esquerda |
| `aside` fixo do `ConviteEixos` (`EixosEquipe.tsx`) | nenhuma (fixo sai do fluxo) | cai por cima, no mesmo canto dos avisos (`offset` 5 rem, 1 rem) |
| barra do celular (`lg:hidden`) | nenhuma | |
| `aside.pn-menu` | linha 1, coluna 2 | o menu vai para a direita; a altura 100vh dele dá a altura da linha 1 |
| `div.min-w-0` (conteúdo) | linha 2, coluna 1 | o `max-w-5xl` (64 rem = 1024 px) do conteúdo define a largura da coluna `auto`: por isso o `<section>` tem 1024 px |

**Por que é estrutural:** qualquer peça "invisível" nova montada na raiz (um aviso, um convite, um provedor que desenhe um elemento) desmonta o grid de novo. O conserto não é tirar a Sonner: é a casca nunca depender da ordem dos filhos.

**Conserto (fundação):**

1. A raiz `.painel` deixa de ser grid. Ela é um bloco com dois filhos e só dois: a **casca** (`.pn-casca`, flex: menu e área) e as **camadas** (`.pn-camadas`, tudo o que é fixo ou vai por portal).
2. Dentro da `.pn-casca` só entram `<MenuDoPainel />` e `<div class="pn-area">`. Nada mais.
3. Em `.pn-camadas`, na ordem: `TraduzirPainel`, `TutorialDoPainel`, `Paleta`, `DialogosDoPainel`, `AvisosDoPainel` (Sonner), `QuadroDeAvisos`, `TermoDeVoluntario`, Glossário e Atalhos de teclado (agora como `Dialogo`). Mesmo que um deles desenhe algo no fluxo, fica depois da casca e não a desloca.
4. O `ConviteEixos` deixa de flutuar: vira um `Cartao` dispensável no alto da Mesa (a fundação monta na peça `agora` da Mesa; a faixa `equipe` troca a marcação de `EixosEquipe.tsx`). Os avisos da Sonner ficam sozinhos no canto de baixo à direita.
5. Somem as regras frágeis de `styles/painel-tema.css` que dependiam da ordem (`.painel > div:last-child`, `html[data-escrita-foco] .painel { grid-template-columns }`); o modo foco da escrita passa a esconder `.pn-menu` e `.pn-barra-superior` pelos nomes.
6. O teste `scripts/testar-painel-fundacao.mjs` passa a conferir: a raiz não tem `grid`; a casca tem exatamente o menu e a área; nenhuma seção usa `fixed` com `bottom-*`/`right-*` fora de `ui/` e dos avisos que bloqueiam a tela (termo, quadro de avisos, tutorial).

```
<MotionConfig reducedMotion="user" | "always" (modo leve)>
  <LazyMotion features={recursos} strict>
    <Dica.Provider>
      <div class="painel [painel-leve]" data-densidade="confortavel|compacta">
        <div class="pn-casca">                       ← flex, min-height 100dvh
          <aside class="pn-menu"> … </aside>         ← sticky, 100dvh, largura animada (248 px / 60 px)
          <div class="pn-area">                      ← flex: 1; min-width: 0
            <a class="pn-pular" href="#pn-principal">Pular para o conteúdo</a>
            <header class="pn-barra-superior"> trilha · busca Ctrl K · ações · ajuda </header>
            <main id="pn-principal" tabindex="-1">
              faixas (prévia, interdição, conta suspensa)
              <CabecalhoDeSecao nivel={1} … />        ← fora das seções "tela" (Conversas, Reuniões)
              <AnimatePresence> <m.div key={secao}> a seção </m.div> </AnimatePresence>
            </main>
          </div>
        </div>
        <nav class="pn-barra-baixo"> (celular) </nav>
        <div class="pn-camadas"> sobreposições e portais </div>
      </div>
    </Dica.Provider>
  </LazyMotion>
</MotionConfig>
```

---

## 2. Direção visual: "mesa de redação do Instituto"

Não é um painel genérico de tons cinzentos com um acento vermelho. É a mesa de trabalho de um instituto popular de formação: **tinta e papel**. A referência de densidade e de comportamento é a de ferramentas profissionais (Linear, Height): linhas de 32 a 36 px, tudo ao alcance do teclado, transições curtas e com mola. A cara é do Instituto: o papel quente do site, a tinta escura quente, o bordô de luta, a Garamond nos títulos, o mono em versalete espaçado nos rótulos, a faixa fina das lutas, a estrela e o livro da marca.

**As cinco decisões que dão a cara:**

1. **Menu lateral em tinta**, escuro nos dois temas (`#1c1712` no claro, `#100d0a` no escuro), com a **faixa das lutas** de 3 px no topo, a marca (estrela e livro, `/marca-96.png`) e "Instituto Lúcia" em Garamond. O item ativo ganha um fundo bordô sobre tinta, uma barra de 2 px em bordô vivo à esquerda e o ícone em bordô vivo. Os nomes dos grupos vão em mono, versalete espaçado, num tom de papel envelhecido.
2. **Área de trabalho em papel quente** (`#f2ecdf`), nunca branco. Os **cartões** são um tom mais claros (`#faf6ec`) com fio de 1 px (`#ddd2bc`) e uma sombra de 1 px quase imperceptível; o realce de linha e o cabeçalho de tabela são um tom mais escuros (`#efe7d6`). No escuro, papel vira tinta (`#16130f`, cartões `#1f1b16`).
3. **Títulos em EB Garamond** (`h1` de 30 px na página; `h2` de 20 px nos blocos da seção). O corpo é Inter de 14 px. **Rótulos em mono** (10,5 a 11 px, maiúsculas, espaçamento 0,14 em): trilha, nome do espaço acima do título, cabeçalho de tabela, rótulo de estatística, grupo do menu e da paleta.
4. **O bordô `#a51810` é a cor de luta**, usada com economia: o botão principal (um por tela), o item ativo, o foco, os contadores do que espera por alguém e o pequeno ícone do título da seção. Erro não é bordô: é `#b42318`, sempre com palavra ("Erro: …").
5. **Detalhes de marca:** acima de cada título de seção, um traço de 20 x 3 px com as cores das lutas e o nome do espaço em mono ("ESCREVER E PRODUZIR"); o estado vazio traz a estrela da marca em traço fino; o ouro do ipê (`#8a5f1c` / `#f0b323`) marca o que está fixado (estrela dos favoritos).

**Medidas:** grade de 4 px; cantos de 6 px em controles, 10 px em cartões e janelas, 999 px em selos; botões de 32 px (pequeno 28; toque 44); campos de 34 px; linhas de lista de 36 px (compacta: 30); barra superior de 52 px; menu de 248 px (recolhido 60 px). Números sempre com `font-variant-numeric: tabular-nums`.

**Proibido:** fundo branco puro na área de trabalho; sombra dura deslocada (a do "cartaz" do site); pontilhado; botão que pula ao passar o mouse; cor escrita à mão nos componentes (só tokens); gradiente decorativo fora da faixa das lutas.

---

## 3. Tokens (`styles/painel-tema.css`, reescrito pela fundação)

Todos em `:root`, redefinidos no escuro por `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` e por `:root[data-theme="dark"]`; alto contraste e tinta eletrônica (`[data-contrast]`, `[data-eink]`) continuam em preto e branco puro, como hoje. Os nomes antigos `--pn-*` ficam (o que já usa não quebra); os novos se somam.

### Área de trabalho

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--pn-fundo` | `#f2ecdf` | `#16130f` | papel da área de trabalho e da barra superior |
| `--pn-superficie` | `#faf6ec` | `#1f1b16` | cartões, campos, janelas, menus suspensos |
| `--pn-superficie-2` | `#efe7d6` | `#29241d` | cabeçalho de tabela, linha em realce, esqueleto |
| `--pn-ativo` | `#e8dfcb` | `#2f2921` | linha escolhida, item de paleta escolhido |
| `--pn-borda` | `#ddd2bc` | `#38312a` | fio de 1 px |
| `--pn-borda-forte` | `#c5b89c` | `#4d443a` | borda de campo e botão |
| `--pn-texto` | `#1f1a14` | `#ede5d3` | tinta |
| `--pn-texto-suave` | `#5a4e3c` | `#b3a891` | texto secundário |
| `--pn-texto-mudo` | `#6f624d` | `#968b75` | rótulos mono, metadados (5:1 sobre o fundo) |
| `--pn-destaque` | `#a51810` | `#b8261c` | botão principal, contador (texto branco por cima) |
| `--pn-destaque-hover` | `#8a130c` | `#9e1f17` | |
| `--pn-destaque-vivo` | `#a51810` | `#e0675c` | indicador, ícone do título, aba ativa, texto bordô |
| `--pn-destaque-suave` | `#f1dcd3` | `#3a1a15` | fundo do ícone do título, selo bordô |
| `--pn-sobre-destaque` | `#ffffff` | `#ffffff` | |
| `--pn-foco` | `#a51810` | `#e0675c` | anel de foco de 2 px, afastado 2 px |
| `--pn-ouro` | `#8a5f1c` | `#f0b323` | favoritos, destaques de marca |
| `--pn-ok` / `--pn-aviso` / `--pn-erro` | `#2f5d34` / `#85580a` / `#b42318` | `#8fc796` / `#e3b04b` / `#f08277` | estados (sempre com palavra) |
| `--pn-info` | `#23408e` | `#8ea6e6` | o azul das lutas, para informação |
| `--pn-veu` | `rgb(31 26 20 / .5)` | `rgb(0 0 0 / .62)` | fundo das janelas |
| `--pn-sombra-cartao` | `0 1px 0 rgb(31 26 20 / .05), 0 1px 2px rgb(31 26 20 / .04)` | `none` | cartões |
| `--pn-sombra-flutuante` | `0 12px 32px rgb(31 26 20 / .18)` | `0 12px 32px rgb(0 0 0 / .55)` | janelas, menus suspensos, paleta |

### Menu lateral (tinta)

| Token | Claro | Escuro |
|---|---|---|
| `--pn-menu-fundo` | `#1c1712` | `#100d0a` |
| `--pn-menu-superficie` (passar o mouse) | `#28211a` | `#1a1612` |
| `--pn-menu-ativo` (bordô sobre tinta) | `#3c1813` | `#3a1611` |
| `--pn-menu-borda` | `#332a21` | `#241e18` |
| `--pn-menu-texto` | `#efe6d2` | `#efe6d2` |
| `--pn-menu-texto-suave` | `#a99d84` | `#a99d84` |
| `--pn-menu-rotulo` | `#978a72` | `#8c806a` |
| `--pn-menu-destaque` | `#e0675c` | `#e0675c` |

### Forma, letra e medida

| Token | Valor |
|---|---|
| `--pn-raio` / `--pn-raio-cartao` / `--pn-raio-selo` | 6 px / 10 px / 999 px |
| `--pn-fonte` | `var(--font-ui), "Inter", system-ui, sans-serif` |
| `--pn-fonte-titulo` | `var(--font-serif-display), "EB Garamond", Georgia, serif` |
| `--pn-fonte-mono` | `var(--font-archive), ui-monospace, monospace` |
| `--pn-lutas` | o gradiente de hoje (as nove cores dos panos) |
| `--pn-menu-largura` / `--pn-trilho-largura` | 15,5 rem (248 px) / 3,75 rem (60 px) |
| `--pn-barra-altura` / `--pn-barra-baixo` | 3,25 rem (52 px) / 3,5 rem |
| `--pn-linha` | 2,25 rem (compacta: 1,875 rem), por `data-densidade` |
| `--pn-conteudo-largura` | 76 rem |

**Contraste conferido (AA):** bordô sobre papel 6,6:1; tinta suave sobre papel 7:1; texto mudo sobre papel 5:1; branco sobre bordô 7,7:1 (claro) e 6,3:1 (escuro); texto suave do menu sobre tinta 6,7:1; rótulo do menu sobre tinta 5,3:1 (claro) e 5:1 (escuro); bordô vivo sobre tinta 5,3:1.

**Ponte para as seções antigas** (dentro de `.painel`, fora de contraste e tinta eletrônica): `--parchment` → `--pn-fundo`; `--parchment-deep` → `--pn-superficie-2`; `--folha` → `--pn-superficie`; `--ink` → `--pn-texto`; `--ink-soft` → `--pn-texto-suave`; `--rule` → `--pn-borda`; `--borda-forte` → `--pn-borda-forte`; `--oxblood` e `--prelo-texto` → `--pn-destaque-vivo`; `--gold` → `--pn-ouro`; `--ok` → `--pn-ok`. A letra: `.font-serif` em `h1, h2, h3` fica Garamond; fora de título vira Inter; `.font-mono` com `uppercase` fica mono (rótulo). As constantes de `comum.tsx` passam a apontar para as classes novas (`botao` → `pn-botao pn-botao-principal`, `botaoClaro` → `pn-botao`, `campo` → `pn-campo`, `rotulo` → `pn-rotulo-mono`, `elo` → `pn-elo`): o que ainda não migrou já sai no desenho novo.

**Tailwind:** não se acrescenta nada ao `@theme` de `app/globals.css` (é do site inteiro). Nas seções, Tailwind só para disposição (`flex`, `grid`, `gap-*`, `p-*`, `w-*`); cor só por componente de `ui/`, classe `pn-*` ou as cores do site que a ponte converte (`text-ink-soft`, `border-rule`, `bg-folha`). Nada de `bg-[#…]`, `text-white` sobre fundo próprio, `#hex` ou `rgb()`.

---

## 4. Bibliotecas

Todas só no cliente do painel: importadas apenas em `components/painel/**`. O teste da fundação falha se alguma aparecer fora dali. `Dentro` (o painel aberto) passa a ser carregado por `next/dynamic(() => import("./casca/Dentro"), { ssr: false })` a partir de `Painel.tsx`: as portas (carregando, sem conta, segundo fator, senha nova) continuam no servidor, e as bibliotecas novas não entram em nenhuma função do servidor. Depois do build, `npm run conferir:rastreio` tem de continuar abaixo de 760 mil (hoje 724 mil).

| Pacote | Versão | Para quê | Decisão |
|---|---|---|---|
| `motion` (Framer Motion, `motion/react`) | 12.x exata | molas, `AnimatePresence`, `layoutId`, gestos | adotar, com `LazyMotion` + `m.*` (`strict`) e os recursos `domMax` carregados sob demanda |
| `zustand` | 5.x exata | estado da casca, comandos da seção, remendos otimistas | adotar |
| `lucide-react` | 0.5xx exata | ícones | adotar; importação nomeada (só os usados entram no pacote) |
| `react-resizable-panels` | 3.x exata (não a 4: a API mudou) | arrastar a largura das colunas | adotar, só via `ui/PaineisAjustaveis` |
| `@radix-ui/react-dropdown-menu` | 2.1.x exata | `MenuSuspenso` | adotar (mesma família dos diálogos e abas) |
| `@radix-ui/react-tooltip` | já instalado | `Dica` | usar |
| `cmdk`, `sonner`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@tanstack/react-table` | já instalados | paleta, avisos, diálogos, abas, tabela | continuar |
| shadcn/ui | não é pacote | | não se instala nada: os componentes de `ui/` seguem o jeito do shadcn (Radix por baixo, estilo por tokens, API pequena, `forwardRef`, `className` aberto), escritos à mão e em português |
| `clsx`, `tailwind-merge`, `class-variance-authority` | | | não: um `cx()` de quatro linhas em `ui/cx.ts` basta |
| TipTap / Lexical | | | **não adotar agora** (seção 11) |

Versões: a fundação fixa a versão exata (sem `^`) da linha indicada, conferida com `npm view <pacote> version` e com pelo menos duas semanas de publicada.

---

## 5. A casca nova

### 5.1 Barra superior (`.pn-barra-superior`, 52 px, presa no alto)

- Fundo `--pn-fundo` a 88 % com `backdrop-filter: blur(8px)` (sem desfoque no modo leve), fio de 1 px embaixo.
- **Esquerda:** no celular, o botão do menu (`data-tour="menu-celular"`, ícone `Menu`); a **trilha** em mono versalete: `PAINEL / EQUIPE / Conversas` (o espaço é um botão que abre, num `MenuSuspenso`, as seções daquele espaço; a seção atual é texto, `aria-current="page"`).
- **Centro:** o botão de busca com cara de campo, "Buscar ou ir para…" e `Ctrl K` em `Kbd` (`data-tour="ir-para"`, abre a paleta). No celular, só o ícone `Search`.
- **Direita:** "Ver como…" (prévia por função, só para quem lidera: `MenuSuspenso` com as funções e a disciplina); `＋ Escrever` como `Botao variante="principal" pequeno simbolo={Plus}` (`data-tour="escrever"`, só para quem produz, fora do Escrever); o botão de ajuda `CircleHelp` (`data-tour="tutorial"`), que abre um `MenuSuspenso` com Tutorial, Atalhos de teclado, Glossário e Guia da seção.

### 5.2 Cabeçalho da seção (`CabecalhoDeSecao nivel={1}`, montado pela casca)

Traço das lutas de 20 x 3 px e o nome do espaço em mono; o título em Garamond 30 px (26 no celular) com o ícone Lucide da seção num quadrado de 32 px (`--pn-destaque-suave`, ícone `--pn-destaque-vivo`); a linha "sobre" em `--pn-texto-suave` (máximo 42 rem); à direita, **Fixar** (estrela `Star`, cheia em ouro quando fixada, `aria-pressed`) e o `GuiaDaSecao`. As seções "tela" (`conversas`, `reunioes`) não têm esse cabeçalho: o nome fica na trilha e o conteúdo ocupa `calc(100dvh - 52px)`. As seções nunca desenham outro `h1`.

### 5.3 Área principal

`main#pn-principal`, com largura por seção: **normal** (máximo 76 rem, margens 24/32 px); **ampla** (`rede`, `estudio`, `escritorio`, `caderno`: sem máximo); **tela** (`conversas`, `reunioes`: sem margens, altura cheia). Acima do cabeçalho, as faixas (`Faixa`): prévia por função (bordô), interdição (aviso), conta suspensa (erro). A troca de seção anima (seção 9), devolve a rolagem ao topo e põe o foco no `h1` (`tabindex="-1"`) para o leitor de tela anunciar a seção nova.

### 5.4 Celular (abaixo de 64 rem)

O menu vira uma **folha** que entra pela esquerda (Radix Dialog por baixo: foco preso, Esc fecha, véu; `m.aside` com mola, `x: "-100%"` para `0`). A barra de baixo continua (Mesa, Escrever, Revisar, Atender, Mais), com a faixa das lutas em cima. A barra superior fica com menu, trilha encurtada e busca.

### 5.5 Teclado (o que já existe continua)

`Ctrl K` / `Cmd K` (paleta), `/` (paleta, fora de campo), `?` (atalhos), `g` + letra (ir à seção), `Esc` (fecha). Novo: `[` recolhe e abre o menu. A lista de atalhos e o glossário viram `Dialogo` de `ui/`.

---

## 6. O menu lateral novo (`components/painel/Menu.tsx`, fundação)

Mesma lista de entradas do `MAPA` de `estrutura.ts` (nenhuma seção sai). Mantém os `data-tour` `areas`, `departamento`, `recolher`, `conta` (o `ir-para` passa para a barra superior; o teste da fundação muda junto).

**Aberto (248 px):**

1. **Topo:** faixa das lutas (3 px); marca de 28 px, "Instituto Lúcia" em Garamond 17 px e o ambiente ("Coordenação", "Equipe"…) em mono versalete; à direita, o botão recolher (`PanelLeftClose`, `Dica` "Recolher o menu [").
2. **Filtro:** campo pequeno "Filtrar o menu" que filtra as entradas na hora (o que a busca do menu fazia); `Enter` abre a primeira. A busca completa é a paleta.
3. **Fixadas:** as seções fixadas pela pessoa (estrela em ouro), na ordem em que foram fixadas.
4. **Meu departamento:** como hoje, com o nome do departamento em nota.
5. **Os 8 espaços** como grupos recolhíveis: cabeçalho em mono versalete (`--pn-menu-rotulo`), a soma do que espera e a seta (`ChevronRight`, gira 90°). Cada entrada: 32 px, ícone Lucide de 16 px, nome, `Contador` bordô; ao passar o mouse ou com o foco na linha, aparece o botão "Fixar" (estrela; `aria-label="Fixar Fila de revisão"`), separado do link.
6. **Ativo:** fundo `--pn-menu-ativo` que **desliza** de um item a outro (`layoutId="pn-menu-ativo"`), barra de 2 px `--pn-menu-destaque`, ícone `--pn-menu-destaque`, `aria-current="page"`.
7. **Pé:** o cartão da pessoa (avatar, nome, função; `data-tour="conta"`) abre um `MenuSuspenso` para cima: Minha conta, Tema (claro, escuro, do sistema), Idioma, Voltar ao site, Sair. Ao lado, as ferramentas em ícone com `Dica`: modo foco (`Focus`), modo leve (`Feather`), tela cheia (`Maximize2`/`Minimize2`), recolher (`data-tour="recolher"`).

**Recolhido (60 px):** a largura anima com mola; os nomes somem com opacidade (e saem da árvore de acessibilidade); ficam os ícones das fixadas e dos espaços, cada um com `Dica` (nome e contagem) e `aria-label`. Clicar num espaço abre um `MenuSuspenso` ao lado (`side="right"`) com as seções daquele espaço, sem precisar abrir o menu. O contador vira um ponto bordô no canto do ícone (com o número no `aria-label`).

**Estado guardado** (no store, seção 8): recolhido, grupos abertos (com a mesma regra de hoje: aberto se a pessoa abriu, ou se a seção atual é dele), fixadas, recentes. As chaves antigas (`lucia:painel-compacto`, `lucia:painel-grupos`, `lucia:painel-atalhos`, `lucia:painel-foco`, `lucia:painel-leve`) são lidas uma vez na migração: ninguém perde o que já tinha escolhido.

**Ícones Lucide por seção** (em `icones.tsx`, que mantém a API `<Icone id className />`, então quem já chama não muda; os nomes seguem o da versão fixada, sem apelidos antigos):

| Seção | Ícone | Seção | Ícone | Seção | Ícone |
|---|---|---|---|---|---|
| mesa | `LayoutDashboard` | atividade | `Activity` | conversas | `MessagesSquare` |
| rede | `StickyNote` | escrever | `PenLine` | videoaulas | `Clapperboard` |
| aovivo | `Cast` | estudio | `Palette` | escritorio | `Briefcase` |
| caderno | `NotebookPen` | aulas-a-escrever | `FilePlus2` | tarefas | `ListChecks` |
| acervo-dentro | `Library` | exercicios | `PencilRuler` | pautas | `CalendarDays` |
| minhas | `Send` | juntas | `Users` | fila | `ClipboardCheck` |
| vale-curadoria | `Scale` | traducoes | `Languages` | triagem | `Filter` |
| curriculo | `Route` | fontes | `BookOpen` | materiais | `FolderOpen` |
| divulgacao | `Megaphone` | comunidade | `Flag` | rede-propostas | `MessageSquarePlus` |
| reforco | `LifeBuoy` | mural | `ClipboardList` | gaveta | `Archive` |
| boletim | `Mail` | assembleias | `Vote` | nucleos | `MapPin` |
| departamentos | `Building2` | pessoas | `UserPlus` | supervisao | `Eye` |
| reunioes | `CalendarClock` | horas | `Clock` | saude | `HeartPulse` |
| termos | `FileSignature` | estatisticas | `ChartColumn` | operacao | `Server` |
| imprensa | `Newspaper` | ensino | `TrendingUp` | previa | `Inbox` |
| eixos-equipe | `Compass` | controles-avancados | `SlidersHorizontal` | confirmacoes | `UserCheck` |
| avisos | `BellRing` | centro | `Gauge` | site | `Globe` |
| abertura | `PanelTop` | podcast | `Mic` | emissoras | `Radio` |
| apoiadores | `HandHeart` | erros | `Bug` | tecnico | `SquareTerminal` |
| seguranca | `ShieldCheck` | interdicao | `Ban` | registro | `ScrollText` |
| biblioteca | `BookMarked` | contribuicoes | `Award` | conta | `CircleUser` |

Espaços (`estrutura.ts` ganha `icone` no lugar de `desenho`, mantendo `desenho` até o teste mudar): Mesa `House`, Escrever e produzir `PenTool`, Revisar e publicar `CheckCheck`, Comunidade e atendimento `HeartHandshake`, Equipe `Users`, Site e operação `Settings2`, Segurança `Shield`, Minha conta `UserRound`.

---

## 7. Paleta Ctrl K (`ui/Paleta.tsx`, cmdk)

Janela de 40 rem no alto (12vh), entra com mola (escala 0,98 para 1). Campo grande; resultados em grupos com cabeçalho mono versalete; rodapé com as teclas (`↑↓` escolher, `↵` abrir, `Esc` fechar, `⌫` voltar). Busca sem acento e sem caixa, como hoje.

| Grupo | Conteúdo | Quando |
|---|---|---|
| **Nesta seção** | comandos que a seção aberta registrou (aprovar, devolver, recusar, reservar, marcar como lida, próximo…) | sempre que houver |
| **Recentes** | as últimas seções usadas (store) | busca vazia |
| **Ir para** | todas as seções que a pessoa vê, com espaço e contagem; fixadas primeiro | sempre |
| **Ações** | os comandos de hoje: escrever aula, matéria, gravar vídeo, marcar aula ao vivo, tutorial, atalhos, glossário, sair | sempre |
| **Pessoas** | quem é da equipe (`equipe_membros`, carregada só com a paleta aberta e a partir de 2 letras); escolher leva a Voluntários e convites (se a pessoa vê a seção) ou a Conversas, com `&q=<nome>` no endereço | busca com 2+ letras |
| **Tarefas** | as tarefas da pessoa (`tarefas_para_mim`, mesma regra); escolher leva a Tarefas com `&tarefa=<id>` | busca com 2+ letras |
| **Preferências** | tema claro, escuro ou do sistema; densidade confortável ou compacta; modo leve; modo foco; recolher o menu | sempre |

**Comandos da seção:** a seção registra enquanto está montada:

```ts
useComandosDaSecao([
  { id: "aprovar", nome: "Aprovar este envio", simbolo: Check, atalho: "a", fazer: () => decidir("aprovada") },
  { id: "devolver", nome: "Devolver com comentário", simbolo: Undo2, fazer: () => devolver() },
  { id: "atribuir", nome: "Chamar alguém para trabalhar junto", simbolo: UserPlus, pedePessoa: true, fazer: (pessoa) => chamar(pessoa!.id) },
], [itemAberto?.id]);
```

`pedePessoa` abre uma segunda página da paleta com a lista de pessoas (`⌫` volta). `perigo: true` passa pelo `confirmar()` antes de agir. Os comandos só chamam funções que a seção já tem: atribuir, mudar status, reservar e marcar sem mouse, sem lógica nova.

---

## 8. Estado da casca (Zustand) e Optimistic UI

### 8.1 `components/painel/estado.ts` (fundação)

```ts
export interface PreferenciasDaCasca {
  menuRecolhido: boolean;
  gruposAbertos: Record<string, boolean>;   // "espaco:<id>", "departamento", "fixadas"
  favoritos: string[];                      // ids de seção, até 12
  recentes: string[];                       // até 6, sem "mesa"
  larguras: Record<string, number[]>;       // id do grupo de painéis → porcentagens
  modoFoco: boolean;
  modoLeve: boolean;
  densidade: "confortavel" | "compacta";
}
export interface ComandoDaSecao { id: string; nome: string; sobre?: string; simbolo?: LucideIcon; atalho?: string; perigo?: boolean; pedePessoa?: boolean; fazer: (pessoa?: { id: string; nome: string }) => void | Promise<void> }
export interface Remendo { id: string; desde: number; aplicar: (dados: unknown) => unknown }

export const usePainel = create<EstadoDaCasca>()(persist(…, {
  name: "lucia:painel-casca",
  version: 1,
  storage: createJSONStorage(() => armazenamentoSeguro), // getItem/setItem/removeItem, cada um em try/catch (devolve null)
  partialize: (s) => preferências só,                     // menu do celular, paleta, comandos e remendos não se guardam
  migrate: lê as chaves antigas uma vez,
}));
// ações: alternarMenu, alternarGrupo, fixar, lembrar, guardarLarguras, alternarFoco, alternarLeve, definirDensidade,
//        abrirPaleta, registrarComandos(dono, lista), tirarComandos(dono), remendar(chave, remendo), soltarRemendos(chave, ate)
export function useComandosDaSecao(comandos: ComandoDaSecao[], deps: unknown[]): void;
```

Sem armazenamento (janela privada, bloqueio), tudo funciona e só não fica guardado. `Atalhos.tsx` vira um adaptador do store com a mesma API (`useAtalhos()` devolve `fixadas`, `recentes`, `fixar`, `lembrar`): `MesaOrganizada` e a Mesa não mudam. Seletores finos (`usePainel((s) => s.menuRecolhido)`) para não redesenhar a casca à toa.

### 8.2 Optimistic UI (`comum.tsx`, fundação)

`useLista` passa a aplicar os remendos pendentes da sua chave (`funcao` + argumentos) sobre os dados, e a soltar os remendos mais velhos que a última leitura bem-sucedida. Para agir:

```ts
const ok = await agirOtimista<Envio[]>({
  lista: { funcao: "fila_listar" },                  // a mesma chave do useLista da tela
  remendo: (dados) => dados.filter((e) => e.id !== id), // o que a tela mostra já
  funcao: "contribuicao_decidir", argumentos: { p_id: id, p_decisao: "aprovada" },
  sucesso: "Aprovado.",                              // vai para notificar.ok
});
// também como hook, para telas que mostram "ocupado": const { agir, ocupado } = useAcaoOtimista();
```

Na hora: a tela muda. Depois: chama o mesmo `rpc`, dispara `PAINEL_MUDOU` e `transmitir(funcao)` (como `useAcao`) e pede nova leitura da lista. Se falhar: tira o remendo (a tela volta) e mostra `notificar.erro(textoDoErro(erro))`. **Só para ação simples e reversível** (mudar status, reservar, marcar como lida, fixar, apoiar, mover na fila). Apagar, publicar, banir e tudo o que pede `confirmar()` continua esperando o banco.

---

## 9. Movimento (Framer Motion)

- **Raiz:** `<MotionConfig reducedMotion="user">` (no modo leve, `"always"`); `<LazyMotion features={() => import("./casca/recursos").then((r) => r.default)} strict>`: as seções usam `m.div` (de `motion/react-m`), nunca `motion.div`. As transições em CSS continuam atrás de `prefers-reduced-motion: no-preference` e somem no `.painel-leve`.
- **Molas** (`ui/movimento.ts`): `mola.menu = { type: "spring", stiffness: 380, damping: 36, mass: 0.9 }`; `mola.rapida = { stiffness: 520, damping: 40 }`; `mola.suave = { stiffness: 260, damping: 30 }`; `curva = [0.2, 0.7, 0.2, 1]`.
- **Troca de seção:** `AnimatePresence mode="popLayout" initial={false}`; entra com opacidade 0 para 1 e `y` de 6 para 0 em 180 ms; sai com opacidade em 100 ms. Sem `layout` no conteúdo inteiro (evita saltos e custo).
- **Menu:** largura com `mola.menu`; o fundo do ativo desliza com `layoutId`; grupos abrem com altura `auto` (`AnimatePresence initial={false}`); a seta gira.
- **Micro-interações:** contador que muda de número (escala 0,8 para 1); `Botao` com `:active { scale: .98 }` em CSS (sem pulo ao passar o mouse); estrela de fixar com um giro curto; linha removida de uma lista sai com altura e opacidade (`ui/movimento.tsx`: `ListaAnimada`, `Surgir`, `ContagemAnimada`); paleta, diálogo e menu suspenso entram com escala 0,98 e opacidade.
- **Proibido:** animar `width`/`height` de tabela ou de texto longo, animação em laço (exceto o pulso de "online" e o esqueleto, ambos desligáveis), qualquer movimento sem passar por `MotionConfig`.

---

## 10. Componentes de `ui/` (fundação; exportados por `ui/index.ts`)

Estilo shadcn: estrutura do Radix quando há interação, estilo só por classe `pn-*` e token, `forwardRef`, `className` aberto, nenhuma cor escrita à mão (o teste confere). Os que já existem mantêm a API e ganham props novas opcionais.

| Componente | API (o essencial) | Notas |
|---|---|---|
| `Botao` | `variante: "principal" \| "padrao" \| "discreto"`, `perigo`, `pequeno`, `icone` (só ícone: exige `aria-label`), **novos:** `simbolo?: LucideIcon`, `simboloFim?`, `carregando?` (`aria-busy`, `Loader2` girando), `atalho?` (mostra `Kbd`), `dica?` (envolve em `Dica`) | um principal por tela |
| `Campo`, `Area`, `Selecao`, `Marca` | como hoje; **novo:** `simbolo` no `Campo`; **novo** `Busca` (campo de busca com `Search`, `Esc` limpa) | |
| `Cartao` | `as?: "section" \| "div" \| "article"`, `titulo?`, `sobre?`, `acoes?`, `rodape?`, `variante?: "padrao" \| "destaque" \| "alerta" \| "plano"`, `interativo?` (todo clicável, com foco), `children` | substitui `painel-cartao`, `painel-quadro`, `border border-rule bg-parchment-deep p-4` |
| `Selo` | `tom: "neutro" \| "bordo" \| "ok" \| "aviso" \| "erro" \| "ouro" \| "info"`, `ponto?`, `children` (sempre palavra) | estado; nunca só cor |
| `Contador` | `n`, `rotulo?` ("esperando") | o número bordô do menu e das abas, animado; some com 0 |
| `MenuSuspenso` | `gatilho: ReactElement`, `itens: { rotulo, simbolo?, atalho?, perigo?, desligado?, fazer }[]` ou `children` com `MenuSuspenso.Item`, `.Separador`, `.Rotulo`; `lado?`, `alinhamento?` | Radix Dropdown Menu |
| `Dica` | `texto`, `atalho?`, `lado?`, `children` (um elemento focável) | Radix Tooltip; atraso 300 ms; nunca guarda informação que só existe ali |
| `Separador` | `orientacao?: "horizontal" \| "vertical"`, `rotulo?` (mono no meio) | `role="separator"` |
| `CabecalhoDeSecao` | `nivel: 1 \| 2`, `titulo`, `rotulo?` (eyebrow mono), `sobre?`, `simbolo?: LucideIcon`, `acoes?`, `abas?` | `nivel={1}` só a casca usa; nas seções, `nivel={2}` (h2 Garamond 20 px) no lugar de `jornal-secao` e de `h2.font-serif` |
| `Faixa` | `tom: "info" \| "aviso" \| "erro" \| "ok" \| "bordo"`, `titulo?`, `acao?`, `children` | o recado em faixa (`border-l-4 …`); `role="status"` ou `"alert"` (erro) |
| `Lista`, `ItemDeLista` | `Lista rotulo`; `ItemDeLista titulo, meta?, simbolo?, selo?, acoes?, aoClicar?, atual?` | as listas `divide-y`; linha de `--pn-linha` |
| `Estatistica` (e `Estatisticas`, a grade) | `rotulo` (mono), `valor` (Garamond), `detalhe?`, `tom?`, `aoClicar?` | quadros de número (Situação, Pessoas, Estatísticas) |
| `Kbd` | `children` | tecla |
| `Abas` | como hoje; o sublinhado bordô desliza (`layoutId`) e aceita `Contador` | Radix Tabs |
| `Tabela` | como hoje; **novos:** cabeçalho preso ao rolar, setas `ArrowUp`/`ArrowDown`, `densa?` | TanStack 8 |
| `Dialogo`, `confirmar()`, `perguntar()`, `confirmarFrase()`, `perguntarTexto()` | como hoje; entrada com mola | Radix Dialog |
| `notificar`, `AvisosDoPainel` | como hoje; montado só em `.pn-camadas` | Sonner |
| `Paleta` | como hoje + grupos da seção 7 | cmdk |
| `Vazio` | como hoje + `simbolo?: LucideIcon` (sem ele, a estrela da marca em traço) | |
| `Esqueleto` | como hoje + `forma?: "linhas" \| "cartoes" \| "tabela" \| "fila"` | brilho que para com menos movimento |
| `PaineisAjustaveis` | `id`, `paineis: { id, minimo, padrao?, maximo?, conteudo }[]`, `orientacao?` | seção 12 |
| `Composer` | seção 11 | |
| `movimento` | `mola`, `curva`, `Surgir`, `ListaAnimada`, `ContagemAnimada` | |

**Moldes** (fundação) passam a usar os primitivos: `MoldeFila` com `PaineisAjustaveis` (lista | detalhe) no computador, teclas `j`/`k` e setas, `Enter` abre, e a ajuda `comandos?: (item) => ComandoDaSecao[]` que registra os comandos do item aberto na paleta; `MoldeTabela`, `MoldeRegistro` e `MoldeConfiguracao` com `Cartao` e `CabecalhoDeSecao nivel={2}`.

---

## 11. TipTap: avaliado e não adotado agora

**Custo:** `@tiptap/react` + `starter-kit` + `suggestion` (para os comandos `/`) trazem o ProseMirror inteiro: cerca de 110 a 140 KB comprimidos no cliente, mais o cuidado com teclado de celular e composição de texto (IME).

**O ponto decisivo:** o painel guarda **texto simples com marcações leves** (as mensagens cifradas de ponta a ponta das Conversas, o índice de busca local, a proteção `data-original` contra tradução, o `Formatado.tsx` que desenha `**`, `||spoiler||` e menções, e o Escrever, que gera Markdown para os arquivos do site). Um editor de documento rico mudaria o formato guardado (HTML ou JSON), e isso é mudar lógica, o que este redesenho não faz. O ganho real pedido ("comandos /", estilo Notion) não depende de documento rico.

**O que se faz:** `ui/Composer.tsx`, leve, sem dependência nova:

```ts
<Composer
  rotulo="Mensagem" valor={texto} aoMudar={setTexto} aoEnviar={enviar}
  comandos={[{ id: "resposta", nome: "Resposta pronta", simbolo: MessageSquareText, inserir: (t) => t + modelo }, …]}
  pessoas={membros}          // "@" abre a lista de menção (opcional)
  enviarCom="enter" | "ctrl-enter"
  maxLength={4000}
/>
```

`textarea` que cresce com o texto; `/` no começo da linha abre uma lista (cmdk) filtrada pelo que vem depois da barra; setas e `Enter` escolhem, `Esc` fecha; `Ctrl B` e `Ctrl I` cercam a seleção com `**` e `_`; `@` abre menção quando `pessoas` vem. Saída: o mesmo texto de hoje. Acessível: `role="combobox"`, `aria-expanded`, `aria-controls` e item ativo anunciado. Usado em `RespostasProntas` (os comandos são as respostas prontas) e no campo de mensagem das Conversas (`/resposta`, `/lista`, `/código`, `/spoiler`, `/menção`). Se um dia o Escrever precisar de editor rico, ele entra só ali, por `next/dynamic`, e com decisão própria sobre o formato.

---

## 12. Colunas ajustáveis (`ui/PaineisAjustaveis.tsx`, react-resizable-panels 3)

```ts
<PaineisAjustaveis id="fila" paineis={[
  { id: "lista", minimo: 22, padrao: 34, maximo: 50, conteudo: lista },
  { id: "detalhe", minimo: 40, conteudo: detalhe },
]} />
```

- Só a partir de 64 rem; abaixo, as colunas empilham (sem a biblioteca).
- A divisória: fio de 1 px com área de pegar de 8 px; bordô ao passar o mouse e ao arrastar; foco visível; setas do teclado ajustam (a biblioteca já faz); `aria-label="Ajustar a largura entre lista e detalhe"`; duplo clique volta ao padrão.
- As larguras ficam em `larguras[id]` no store (gravadas 200 ms depois de soltar).
- **Onde:** `MoldeFila` (lista | detalhe; serve a Fila de revisão, Triagem, Gaveta, Comunidade, Mural, Reforço, Traduções, Imprensa, Erros, Propostas da Rede) e **Conversas** (canais | conversa | detalhes e membros: `id="conversas"`, três painéis, o terceiro recolhível).

---

## 13. Arquivos da fundação

Já eram da fundação: `Painel.tsx`, `Menu.tsx`, `estrutura.ts`, `icones.tsx`, `comum.tsx`, `Atalhos.tsx`, `ui/*`, `moldes/*`, `styles/painel-tema.css`. Novos da fundação: `components/painel/estado.ts`, `components/painel/casca/` (`Dentro.tsx`, `BarraSuperior.tsx`, `Camadas.tsx`, `Glossario.tsx`, `AtalhosDeTeclado.tsx`, `recursos.ts`), os componentes novos de `ui/` (`Cartao`, `Selo`, `Contador`, `MenuSuspenso`, `Dica`, `Separador`, `CabecalhoDeSecao`, `Faixa`, `Lista`, `Estatistica`, `Kbd`, `Busca`, `PaineisAjustaveis`, `Composer`, `movimento`, `cx`), `package.json` e `package-lock.json` (as dependências), `scripts/testar-painel-fundacao.mjs` (conferências novas) e as frases novas da casca nos cinco dicionários de `i18n/painel/`.

**Ordem:** a fundação entrega primeiro a API dos primitivos (mesmo que o estilo ainda esteja sendo ajustado); as 8 faixas trabalham em paralelo contra a API desta seção e da seção 10.

**Pronto quando:** a 1207 px o menu fica à esquerda e o conteúdo começa logo abaixo da barra superior (y = 52 + cabeçalho), em 375, 768, 1024, 1207 e 1440 px, claro e escuro, menu aberto e recolhido; nenhum fundo branco; `tsc`, `eslint`, `npm run testar:painel-fundacao`, `testar:painel-confirms`, `testar:mesa`, `testar:controles`, `conferir:painel` e, depois do build, `conferir:rastreio` passam.

---

## 14. Migração das seções: 8 faixas

Arquivos disjuntos: nenhum arquivo está em duas faixas, e nenhum é da fundação. Linhas contadas em 05/11/2026 (`.tsx`; os `.ts` de lógica vão junto na faixa do assunto só para ter dono: **não se migram**, mexe-se neles só se a troca de um `.tsx` exigir).

| Faixa | Linhas `.tsx` | Assunto |
|---|---|---|
| `conversas` | 5.082 | Conversas, reuniões, anexos, sigilo |
| `producao` | 4.676 | Escrever, filas de revisão, traduções, currículo, pautas, materiais |
| `midia` | 5.063 | Podcast, aulas em vídeo, aulas ao vivo, rádio no ar |
| `design` | 6.748 (+5.881 de `.ts` de lógica) | Estúdio de design (só a moldura: o editor e a tela de desenho seguem) |
| `equipe` | 5.299 | Mural da equipe, pessoas, departamentos, núcleos, assembleias, horas |
| `mesa-conta` | 4.991 | Mesa, tarefas, minha conta, segurança, tutorial, guias, campos |
| `site-operacao` | 4.575 | Controles do site, liderança, interdição, operação, centro de controle, apoio, divulgação |
| `atendimento` | 4.441 | Comunidade, mural, reforço, saúde, Vale o Escrito, boletim, imprensa, exercícios |

A faixa `design` é a maior em linhas e a mais leve em trabalho: `Estudio.tsx` e `paineis/` são um editor com kit próprio (`design/ui.tsx`); a tarefa é trocar as cores do kit pelos tokens e a moldura pelos primitivos, sem tocar na tela de desenho.

### Tarefa comum a todas as faixas

1. **Cabeçalhos internos:** `jornal-secao`/`jornal-editoria`, `h2.font-serif` e títulos soltos viram `CabecalhoDeSecao nivel={2}` (ações à direita). Nenhum `h1` dentro de seção.
2. **Contêineres:** `painel-cartao`, `painel-quadro`, `border border-rule bg-parchment-deep p-*`, `border-2 border-ink` viram `Cartao`; recados em faixa (`border-l-4 …`, `bg-parchment-deep` com texto bordô) viram `Faixa`.
3. **Botões:** `className={botao}` → `<Botao variante="principal">` (um por tela); `botaoClaro` → `<Botao>`; `elo` e botões sublinhados → `<Botao variante="discreto">`; botões só de ícone → `<Botao icone aria-label="…" simbolo={…} dica="…" />`.
4. **Campos:** `campo` com `label` → `Campo`, `Area`, `Selecao`, `Marca`, `Busca`. `CampoData` e `CampoArquivo` (de `Campos.tsx`) continuam.
5. **Abas:** a `Abas` de `comum.tsx` vira a de `ui/` (`opcoes`, `valor`, `aoMudar`, `rotulo`).
6. **Listas e tabelas:** `ul.divide-y` com linhas de item → `Lista`/`ItemDeLista`; tabelas HTML → `Tabela` ou `MoldeTabela` quando a forma servir; status em texto (`rotulo`, `situacoes[…]`) → `Selo`; números de "esperando" → `Contador`; quadros de número → `Estatistica`.
7. **Estados:** carregando (`dados === null && !erro`) → `Esqueleto` com a `forma` certa; lista vazia → `Vazio` com título, texto e, se houver, a ação; erro de leitura → `Faixa tom="erro"` com "Tentar de novo" chamando `recarregar`.
8. **Ícones:** todo `<svg>` desenhado à mão e todo símbolo usado como ícone (`✓`, `✗`, `＋`, `›`, `←`, `→`, `★`, `⋯`) viram Lucide (`aria-hidden`), mantendo a palavra que dá o sentido.
9. **Moldes:** se o `MAPA` diz `fila` e a tela é lista e item aberto, usar `MoldeFila` (ganha as colunas ajustáveis); `tabela` → `MoldeTabela`; `configuracao` → `MoldeConfiguracao`, quando a forma servir **sem mudar a lógica**. Se não servir, só os primitivos.
10. **Teclado e Optimistic UI:** ações de status que a tela já tem (aprovar, devolver, reservar, marcar como lida, fixar, mover) vão para a paleta com `useComandosDaSecao`; as simples e reversíveis passam a `agirOtimista`. Apagar, publicar, banir e o que pede `confirmar()` não.
11. **Movimento:** só pelos ajudantes de `ui/movimento` (`Surgir`, `ListaAnimada`, `ContagemAnimada`) ou `m.*`; nunca `motion.*`, nunca animação fora do `MotionConfig`.
12. **Cor:** nenhum `#hex`, `rgb()`, `bg-[#…]`, `text-white` sobre fundo próprio. **Exceções** (o que é documento ou arte com cor própria, não a interface): a assinatura de e-mail de `FaixaDeEmail.tsx` (HTML e canvas), a folha do certificado (`Certificado.tsx`), a tela e as paletas do Estúdio (`design/`), a arte do podcast (`podcast/Arte.tsx`), as cores do `Avatar` e o `EmojiDoInstituto`.
13. **Sem mudar lógica nem API:** mesmos `rpc`, mesmas exportações e props (outros arquivos importam: `Comunidade`, `MuralFila`, `SugerirEmissora` de `Cuidar.tsx`; `Recados`, `SegundoFator` de `Seguranca.tsx`; `Repasse` de `Sigilo.tsx`; `CampoData` e `CampoArquivo`; `Selo` local de `MinhaConta.tsx` vira o `Selo` de `ui/`). Ficam como estão: `data-original`, `translate="no"`, `data-tour`, `#painel-corpo`, `#recados`, as classes `no-print` e a impressão.
14. **Textos:** não mudar frase visível (os dicionários de `i18n/painel/` são da fundação). Se uma frase nova for inevitável, a faixa a lista no relatório e a fundação a traduz.
15. **Acessibilidade:** foco visível em tudo, `aria-*` corretos, ícone sozinho com `aria-label`, nada só por cor, contraste AA, `prefers-reduced-motion` respeitado.
16. **Conferir:** `tsc --noEmit`, `eslint` nos próprios arquivos, os testes do assunto (`testar:painel-confirms`, `testar:mesa`, `testar:controles`, `testar:sigilo`, `testar:mensagens`, `testar:tarefas`, `testar:podcast`, `testar:anexos`, `testar:interdicao`, `testar:departamentos-termos`, `testar:vale-o-escrito-curadoria`) e uma olhada no navegador, claro e escuro, 375 e 1207 px.

### Faixas

**`conversas`** (5.082): `Conversas.tsx`, `ConversasStoat.tsx`, `Reunioes.tsx`, `RespostasProntas.tsx`, `Anexos.tsx`, `EmojiDoInstituto.tsx`, `BuscaDePessoa.tsx`, `Sigilo.tsx`, `Formatado.tsx`.
Conversas no modo "tela": `PaineisAjustaveis id="conversas"` com três colunas (canais | conversa | detalhes e membros, a terceira recolhível); lista de canais com `Lista`, `Contador` e `Selo`; campo de mensagem com `Composer` (comandos `/resposta`, `/lista`, `/código`, `/spoiler`, `/menção`; mesmo texto de saída); `RespostasProntas` como comandos do `Composer`; comandos da paleta para "marcar como lida", "silenciar", "fixar mensagem" quando a ação já existe. Cifra, chaveiro, índice local e `Repasse` sem nenhuma mudança de lógica.

**`producao`** (4.676): `Escrever.tsx`, `FerramentasDoAutor.tsx`, `GuiaDaAula.tsx`, `Verificador.tsx`, `Esteira.tsx`, `Fila.tsx`, `GavetaFila.tsx`, `Sugestoes.tsx`, `FilaDeAulas.tsx`, `Traducoes.tsx`, `Curriculo.tsx`, `FontesAbertas.tsx`, `Ensino.tsx`, `RetornoDosAlunos.tsx`, `Caderno.tsx`, `Escritorio.tsx`, `Pautas.tsx`, `Materiais.tsx`.
`Fila.tsx` (fila, minhas, juntas, triagem) e `GavetaFila.tsx` no `MoldeFila`, com comandos "Aprovar", "Devolver com comentário", "Recusar", "Chamar alguém para trabalhar junto" e "Próximo" (decisão simples otimista; publicar continua esperando o banco); `Esteira` com `Selo` por etapa; Escrever com `Cartao`, `Faixa` e `Botao`, mantendo `#painel-corpo` e o modo foco da escrita; `Traducoes` e `FilaDeAulas` em `MoldeFila` ou `Lista`; `Curriculo` com `Cartao` e `Abas`; `Pautas` e `Materiais` com `Cartao`, `Lista` e `Vazio`.

**`midia`** (5.063 + `podcast/tipos.ts`): `podcast/Arte.tsx`, `podcast/Cortes.tsx`, `podcast/Episodio.tsx`, `podcast/Guia.tsx`, `podcast/Listas.tsx`, `podcast/Podcast.tsx`, `podcast/Publicar.tsx`, `podcast/Roteiro.tsx`, `podcast/tipos.ts`, `Videoaulas.tsx`, `AoVivo.tsx`, `RadioNoAr.tsx`.
Podcast: `Abas` de `ui/` para as etapas, episódios em `Lista` com `Selo` de situação, `Episodio` (66 marcações antigas) com `Cartao`, `Campo` e `CabecalhoDeSecao nivel={2}`; comandos "aprovar episódio", "pedir ajuste" quando já existem; a arte (`Arte.tsx`) mantém as cores da peça. Videoaulas e Ao vivo: gravação e agenda com `Cartao`, `Lista`, `Selo` de situação, `Vazio`; rádio no ar com `Faixa` de estado.

**`design`** (6.748 + 5.881 de lógica): `design/Estudio.tsx`, `design/EstudioDeDesign.tsx`, `design/Icone.tsx`, `design/Inicio.tsx`, `design/Miniatura.tsx`, `design/ui.tsx`, `design/paineis/Barras.tsx`, `design/paineis/Biblioteca.tsx`, `design/paineis/EditorDeFoto.tsx`, `design/paineis/Equipe.tsx`, `design/paineis/Exportar.tsx`, `design/paineis/Flutuantes.tsx`, `design/paineis/Gavetas.tsx`, `design/paineis/Janelas.tsx`, `design/paineis/Previa.tsx`, `design/paineis/Propriedades.tsx`, `design/paineis/Rodape.tsx`, `design/conferir.ts`, `design/desenhos.ts`, `design/elementos.ts`, `design/exportacao.ts`, `design/icones.ts`, `design/laboratorio.ts`, `design/modelos.ts`, `design/motor.ts`, `design/pdf.ts`, `design/projeto.ts`, `design/texto-rico.ts`, `design/vetor.ts`.
A entrada (`EstudioDeDesign`, `Inicio`: escolha entre estúdio rápido e editor avançado, galeria de modelos) com `Cartao interativo`, `CabecalhoDeSecao nivel={2}`, `Esqueleto forma="cartoes"` e `Vazio`; o kit do editor (`design/ui.tsx`) passa a ler os tokens `--pn-*` (superfícies escuras do editor podem usar os tokens do menu em tinta); ícones do editor (`design/Icone.tsx`, `design/icones.ts`) podem ficar (são do editor) ou ir para Lucide onde houver equivalente. Motor, vetor, exportação e modelos não se tocam.

**`equipe`** (5.299): `Equipe.tsx`, `Pessoas.tsx`, `PessoasExtras.tsx`, `ListaDePessoas.tsx`, `Convites.tsx`, `Departamentos.tsx`, `Nucleos.tsx`, `Assembleias.tsx`, `Horas.tsx`, `Certificado.tsx`, `Cuidado.tsx`, `Supervisao.tsx`, `EixosEquipe.tsx`, `Avatar.tsx`.
Mural da equipe (`Equipe.tsx`, largura ampla) com `Cartao` por publicação, `Composer` só se o campo já for de texto livre, `Selo` de função; Voluntários (`Pessoas`, `ListaDePessoas`) e Termos (`PessoasExtras`) em `MoldeTabela`; Horas com `Tabela` e `Estatistica`; Departamentos e Núcleos com `Cartao` e `Lista`; Assembleias com `Cartao` e `Selo`; Supervisão e Cuidado com `Faixa` e `Lista`; **`ConviteEixos` deixa de ser `fixed`**: vira `Cartao variante="destaque"` com botão de dispensar (mesmas props `{ ir }`; a fundação o monta na Mesa); Certificado mantém a folha impressa como está.

**`mesa-conta`** (4.991 + 784 de lógica): `MesaOrganizada.tsx`, `MesaAoLado.tsx`, `mesa-funcoes.ts`, `Tarefas.tsx`, `Avisos.tsx`, `MinhaConta.tsx`, `Seguranca.tsx`, `Termo.tsx`, `Tutorial.tsx`, `GuiaDaSecao.tsx`, `guias.ts`, `Ajuda.tsx`, `manual-texto.ts`, `Idioma.tsx`, `ocioso.ts`, `Previa.tsx`, `Campos.tsx`, `Comecar.tsx`, `Biblioteca.tsx`, `Aprendizado.tsx`.
Mesa: as cinco partes com `CabecalhoDeSecao nivel={2}` e `Contador`, pendências em `Lista`, quadros em `Estatistica`, saudação com a data em mono; Tarefas (114 marcações antigas, a maior) com `Abas`, `Lista`, `Selo` de tempo (5, 15, 30 min) e comandos "Pegar esta tarefa", "Entregar", "Liberar" (reservar e liberar otimistas); `MinhaConta` com `MoldeConfiguracao` onde couber e o `Selo` de `ui/` no lugar do local; `Seguranca` (`Recados`, `SegundoFator`: este também aparece na porta escura, então tem de funcionar nos dois fundos); `Avisos` (`QuadroDeAvisos` continua bloqueando a tela até "Entendi", com `Cartao` por dentro); `Termo` idem; `Tutorial` com tokens e Lucide, mesma lógica e mesmos alvos; `GuiaDaSecao` (aparece no cabeçalho da casca) como `Botao variante="discreto"` que abre um painel; `Idioma` (`IdiomaDoPainel`, usado no pé do menu e na porta) como `Selecao` compacta; `Campos` com tokens e Lucide (`CalendarDays`, `Upload`), mesma API.

**`site-operacao`** (4.575 + 147 de lógica): `Site.tsx`, `Lideranca.tsx`, `Interdicao.tsx`, `Operacao.tsx`, `Tecnico.tsx`, `Erros.tsx`, `BackendUm.tsx`, `Apoio.tsx`, `Estatisticas.tsx`, `Divulgacao.tsx`, `controles/BloquearArquivo.tsx`, `controles/CanaisDoCelular.tsx`, `controles/CentroDeControle.tsx`, `controles/ModeradoresDaRede.tsx`, `controles/NucleosFechados.tsx`, `controles/PublicarAgora.tsx`, `controles/RadioCanais.tsx`, `controles/SalaDaEquipe.tsx`, `controles/regras.ts`, `controles/usarControle.ts`.
`Site`, `Interdicao`, `Operacao`, `Tecnico` e `SegurancaSucessao`/`AvisoDeAbertura` (`Lideranca.tsx`) em `MoldeConfiguracao` com `Faixa` para o que está no ar; `RegistroDeAtividades` em `MoldeTabela`; `Erros` em `MoldeFila`; `BackendUm` (confirmações de segunda pessoa, controles avançados) com `Lista`, `Selo` e `Faixa`; `Estatisticas` com `Estatistica` e `Tabela` (gráficos ficam); `Apoio` com `Cartao` e `MoldeConfiguracao`; `Divulgacao` com calendário em `Cartao` e `Selo` de situação; `controles/` só alinha aos primitivos novos (já estão nos moldes).

**`atendimento`** (4.441): `Cuidar.tsx`, `Reforco.tsx`, `RedePropostas.tsx`, `Saude.tsx`, `SaudeRegras.tsx`, `ValeOEscrito.tsx`, `ValeOEscritoEditor.tsx`, `Boletim.tsx`, `Imprensa.tsx`, `Atividade.tsx`, `FaixaDeEmail.tsx`, `Exercicios.tsx`, `Pratica.tsx`.
`Comunidade` e `MuralFila` (`Cuidar.tsx`), `Reforco`, `RedePropostas` e `Imprensa` no `MoldeFila`, com comandos "Liberar", "Ocultar", "Aprovar anúncio", "Recusar com motivo", "Responder" quando já existem; `SugerirEmissora` com `Campo`; Saúde com `Cartao`, `Selo` de registro e `MoldeConfiguracao` para a chave geral; Vale o Escrito: fila de sugestões em `MoldeFila`, editor com `Campo`, `Area`, `Selecao` e `Faixa` de situação jurídica; Boletim com `MoldeTabela` (inscritos) e `Cartao` (edição); Atividade como `Lista` cronológica com `Selo` do tipo; Exercícios e Prática com `Cartao`, `Lista` e `Vazio`; `FaixaDeEmail` mantém as cores da assinatura (é documento) e troca só a moldura.

---

## 15. Riscos e como evitar

| Risco | Cuidado |
|---|---|
| Faixa começa antes da API da fundação existir | Programar contra as assinaturas das seções 8, 10, 11 e 12; a fundação não muda nome nem prop depois de publicar a API |
| Dois agentes no mesmo arquivo | As faixas são disjuntas; ninguém fora da fundação mexe em `ui/`, `moldes/`, `Painel.tsx`, `Menu.tsx`, `styles/painel-tema.css`, `package.json` ou `i18n/painel/` |
| Classe nova de CSS numa faixa | Não: se faltar algo, pedir à fundação um primitivo ou uma `pn-*` |
| Peso no site público | Bibliotecas só em `components/painel/**`; `Dentro` sem SSR; o teste confere |
| Animação demais | Só os ajudantes de `ui/movimento`; `MotionConfig` com `reducedMotion`; modo leve desliga tudo |
| Tradução quebrada | Nenhuma frase visível muda nas faixas; `npm run conferir:painel` no fim |
