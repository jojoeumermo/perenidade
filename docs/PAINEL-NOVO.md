# Painel novo: fundação (Etapa 8, pacote painel-fundacao)

Este documento é o contrato dos pacotes seguintes do painel. A fundação entrega o tema, os componentes únicos, os quatro moldes de tela, o menu lateral novo e o mapa das seções. Nada saiu do painel: as 55 entradas do registro de seções (as "53 seções" do plano, mais `reunioes` e `aulas-a-escrever`, que também são entradas) estão no mapa.

## Visual

Sóbrio e profissional: neutros quentes; bordô `#a51810` só no botão principal (um por tela), no item ativo do menu e no foco; Garamond só no título da página (`h1`), o resto Inter; cantos de 6 px, bordas de 1 px, nenhuma sombra deslocada (só a sombra macia das janelas que abrem por cima), nenhum botão que pule ou fique vermelho ao passar o mouse, nenhum pontilhado; uma linha de 2 px com as cores das lutas no topo do menu e acima da barra de baixo.

## Tokens

Um arquivo só: `styles/painel-tema.css` (carregado por `components/painel/Painel.tsx`, então o site público não paga por ele). Substitui as cinco camadas que viviam em `app/globals.css` (a mesa de trabalho, a folha de escrever/Caderno do Povo, o menu em papel, o movimento e o "ambiente de trabalho"). Nele ficaram também as peças que dependiam do painel: folha de escrever, modo foco da escrita, modo leve e o tutorial.

Tokens (`:root`, com escuro por `prefers-color-scheme` e `data-theme`, e alto contraste/tinta eletrônica em preto e branco):

| Token | Uso |
|---|---|
| `--pn-fundo`, `--pn-superficie`, `--pn-superficie-2`, `--pn-ativo` | fundo da página, cartões e campos, cabeçalhos de tabela e hover, item ativo |
| `--pn-borda`, `--pn-borda-forte` | fio de 1 px; borda de campos e botões |
| `--pn-texto`, `--pn-texto-suave` | texto e texto secundário |
| `--pn-destaque`, `--pn-destaque-hover`, `--pn-sobre-destaque` | botão principal (bordô) e texto sobre ele |
| `--pn-destaque-vivo`, `--pn-foco` | bordô como indicador e foco (mais claro no escuro, para contraste) |
| `--pn-ok`, `--pn-aviso`, `--pn-erro` | estados |
| `--pn-veu`, `--pn-sombra-flutuante` | fundo das janelas e a única sombra permitida |
| `--pn-raio` (6 px), `--pn-borda-largura` (1 px) | forma |
| `--pn-fonte`, `--pn-fonte-titulo`, `--pn-fonte-mono` | Inter, Garamond (só `h1` e `.pn-titulo`), mono |
| `--pn-lutas` | a linha de 2 px com as cores das lutas |

Regra: componente novo não escreve cor. Só classes `pn-*` e tokens. O teste confere (nenhum `#hex`, `rgb()` ou `[#hex]` em `ui/`, `moldes/`, `Menu.tsx`, `estrutura.ts`).

### Seções antigas

Elas continuam com as classes do site (`bg-parchment-deep`, `border-rule`, `text-ink`…). Dentro de `.painel` essas variáveis apontam para os tokens, então o painel inteiro muda de visual sem reescrever cada seção. As classes antigas do painel (`painel-cartao`, `painel-campo`, `painel-botao`, `painel-quadro`, `painel-aviso`, `painel-veu`, `painel-surge`…) seguem valendo, no desenho novo. As molduras grossas viram fio de 1 px, `border-dashed` e `divide-dashed` viram sólidos, sombras duras somem. Os pacotes seguintes devem trocar o que tocarem para os componentes de `ui/`.

## Componentes (`components/painel/ui/`, tudo exportado por `ui/index.ts`)

| Componente | O que é | Base |
|---|---|---|
| `Botao` | `variante` principal, padrao ou discreto; `perigo`, `pequeno`, `icone` | HTML |
| `Campo`, `Area`, `Selecao`, `Marca` | campos com rótulo, ajuda e erro ligados (`aria-describedby`, `aria-invalid`) | HTML |
| `Tabela` | ordem por coluna, busca sem acento, páginas, estado vazio | `@tanstack/react-table` 8 |
| `Dialogo` | janela com foco preso e Esc | `@radix-ui/react-dialog` |
| `confirmar()` e `perguntar()` com `<DialogosDoPainel />` | no lugar do `confirm` e do `prompt` do navegador; devolvem `Promise<boolean>` e `Promise<string ou null>` | Dialogo |
| `notificar` com `<AvisosDoPainel />` | avisos curtos: `ok`, `erro`, `info`, `desfazer` | `sonner` |
| `Paleta` | Ctrl K: seções por espaço, nome e descrição, mais comandos | `cmdk` |
| `Abas` | abas com setas do teclado | `@radix-ui/react-tabs` |
| `Vazio`, `Esqueleto` | estado vazio e carregando | HTML |

`<DialogosDoPainel />`, `<AvisosDoPainel />` e `<Paleta />` já estão montados em `Painel.tsx` (a `IrPara` antiga foi removida). Como trocar um `window.confirm` ou `window.prompt`:

```ts
// antes
if (!window.confirm("Apagar?")) return;
// depois
if (!(await confirmar({ titulo: "Apagar?", texto: "Não dá para desfazer.", perigo: true }))) return;
// prompt: devolve null se a pessoa cancelou
const motivo = await perguntar({ titulo: "Motivo da recusa", rotulo: "Motivo", obrigatorio: true });
```

## Moldes de tela (`components/painel/moldes/`)

- **Fila** (`MoldeFila`): lista de itens esperando decisão e o item aberto ao lado (embaixo, no celular); setas percorrem; "Próximo"; se o item sai da lista, abre o seguinte.
- **Tabela** (`MoldeTabela`): barra de filtros e do botão de criar, busca, ordem, páginas.
- **Registro** (`MoldeRegistro`): seções empilhadas e lado de apoio opcional.
- **Configuração** (`MoldeConfiguracao`): grupos de campos e rodapé fixo com "Salvar" (único principal) e "Descartar"; avisa quando há mudança não guardada.

Os moldes não repetem o `h1` da página: o título e a descrição da seção continuam no cabeçalho de `Painel.tsx`.

## Menu lateral

`components/painel/Menu.tsx` (mesma API de antes, mais `alternarMenu`). Inspirado no efeito do "animated-sidebar" de @starc007 (21st.dev) de abrir e recolher, sem copiar código: a largura desliza (17 rem para 4,25 rem), os nomes esmaecem e cada espaço abre como gaveta (`grid-template-rows` de 0fr para 1fr). Recolhido, no computador, ficam os ícones dos espaços; um clique abre o menu com aquele espaço aberto. No celular: folha inteira e barra de baixo (Mesa, Escrever, Revisar, Atender, Mais). O que estava aberto fica guardado no aparelho (`lucia:painel-grupos`, chaves `espaco:<id>`). Mantidos: busca "Ir para…", Meu departamento, Fixadas, contagens e todos os `data-tour` do tutorial.

## Estrutura e mapa seção, espaço, molde

Fonte única: `components/painel/estrutura.ts` (`ESPACOS`, `MOLDES`, `MAPA`, `espacoDe`, `moldeDe`). Seção nova sem entrada cai no espaço do grupo antigo (vazio: Mesa; `Produção`; `Atendimento`: Comunidade; `Pessoas`: Equipe; `Site`; `Segurança`; `Você`: Minha conta) e no molde Registro: nada fica fora do menu. O teste lê o registro de `Painel.tsx` e falha se faltar id.

## Mapa seção, espaço, molde


### Mesa

| Seção (id) | Molde |
|---|---|
| `mesa` | fila |
| `atividade` | fila |
| `tarefas` | fila |

### Escrever e produzir

| Seção (id) | Molde |
|---|---|
| `escrever` | registro |
| `aulas-a-escrever` | fila |
| `minhas` | fila |
| `juntas` | fila |
| `videoaulas` | registro |
| `aovivo` | registro |
| `estudio` | registro |
| `escritorio` | registro |
| `caderno` | registro |
| `exercicios` | registro |
| `podcast` | registro |
| `pautas` | registro |
| `materiais` | registro |
| `divulgacao` | registro |
| `fontes` | registro |
| `curriculo` | registro |

### Revisar e publicar

| Seção (id) | Molde |
|---|---|
| `fila` | fila |
| `triagem` | fila |
| `vale-curadoria` | fila |
| `traducoes` | fila |
| `acervo-dentro` | tabela |

### Comunidade e atendimento

| Seção (id) | Molde |
|---|---|
| `comunidade` | fila |
| `rede-propostas` | fila |
| `reforco` | fila |
| `mural` | fila |
| `gaveta` | fila |
| `boletim` | tabela |
| `saude` | registro |

### Equipe

| Seção (id) | Molde |
|---|---|
| `conversas` | registro |
| `reunioes` | registro |
| `rede` | registro |
| `assembleias` | registro |
| `nucleos` | registro |
| `departamentos` | registro |
| `pessoas` | tabela |
| `supervisao` | fila |
| `horas` | tabela |
| `termos` | tabela |
| `estatisticas` | tabela |
| `avisos` | configuracao |
| `biblioteca` | registro |

### Site e operação

| Seção (id) | Molde |
|---|---|
| `site` | configuracao |
| `abertura` | configuracao |
| `emissoras` | configuracao |
| `apoiadores` | configuracao |
| `erros` | fila |
| `tecnico` | configuracao |

### Segurança

| Seção (id) | Molde |
|---|---|
| `seguranca` | configuracao |
| `interdicao` | configuracao |
| `registro` | tabela |

### Minha conta

| Seção (id) | Molde |
|---|---|
| `contribuicoes` | registro |
| `conta` | configuracao |

## Divisão para os pacotes seguintes

Todos dependem desta fundação e devem: usar só `ui/`, `moldes/` e tokens; não editar `styles/painel-tema.css` além de classes `pn-*` novas (edição pontual); registrar seção nova em `estrutura.ts` e em `Painel.tsx`.

| Pacote | O que faz com a fundação |
|---|---|
| `confirms` | Troca os 55 `window.confirm` e os 13 `window.prompt` por `confirmar()` e `perguntar()`; avisos de sucesso e erro por `notificar` |
| `mesa` | Refaz a Mesa (B39) em ordem: pendências, recados, avisos de segurança, saúde da casa, atalhos; Mesa por função. Molde Fila |
| `departamentos-termos` | B10 (fundir Design e Desenvolvimento em "UI/UX e Desenvolvimento", arte para Comunicação/Marketing, sem perder acessos), B14 (departamentos com pouca gente clicáveis), B15 (termo na abertura para quem não tem texto guardado) |
| `eixos-equipe` | B6: pesquisa dos 12 eixos para a equipe, opcional e anônima, só agregado, com consulta à LGPD (opinião política é dado sensível: Lei 13.709/2018, art. 5º, II, e art. 11) |
| `controles` | Os 7 "só falta tela", Centro de controle, "Publicar agora" em mais lugares. Moldes Configuração e Registro |
| `backend-1`, `backend-2` | Os 18 itens de back-end novo, em funções `public.*` com SQL em `supabase/migracoes/2026-11-<pacote>.sql`; telas nos moldes |
| `manual` | Manual curto da coordenação em `docs/` e dentro do painel |

## Pendências conhecidas

- Nenhuma seção foi migrada para os moldes ainda: o mapa diz qual molde cada uma deve usar, e as migrações são trabalho dos pacotes acima.
- Conferência visual no navegador (computador e celular, claro e escuro) não foi feita aqui; foram conferidos `tsc`, `eslint` e `npm run testar:painel-fundacao`.
- O botão "Menu" da barra do alto do celular continua ao lado da barra de baixo ("Mais" faz o mesmo); o pacote `mesa` pode removê-lo.
- Os avisos da Sonner no celular ficam acima da barra de baixo (`offset`).
- `@tanstack/react-table` ficou na versão 8 (a 9 tem API diferente).
