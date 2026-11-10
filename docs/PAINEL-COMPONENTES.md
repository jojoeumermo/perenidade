# Componentes do painel

O painel é escrito em português (os outros idiomas vêm de `i18n/painel/<idioma>.json`, aplicados por `Idioma.tsx`). Desde a Etapa 8 (novembro de 2026) ele tem **identidade própria**, sóbria e profissional, separada do Caderno do Povo do site público: neutros quentes, bordô só no botão principal, no item ativo do menu e no foco, Inter no texto, Garamond só no título da página, cantos de 6 px, bordas de 1 px e nenhuma sombra deslocada. O desenho, os tokens e os quatro moldes de tela estão em `docs/PAINEL-NOVO.md`; este arquivo é o catálogo do que existe para usar. Antes de criar um elemento novo, procure aqui.

## As duas camadas

1. **Camada nova (use esta):** `components/painel/ui/` (tudo exportado por `ui/index.ts`), `components/painel/moldes/` (`moldes/index.ts`) e as classes `pn-*` de `styles/painel-tema.css`.
2. **Camada de antes (continua valendo nas telas antigas):** `components/painel/comum.tsx` e `components/painel/Campos.tsx`, com as classes `painel-*`. Dentro de `.painel` as variáveis do site (`bg-parchment-deep`, `border-rule`, `text-ink`…) apontam para os tokens do painel, então as seções antigas já saem no visual novo sem reescrita. **Quem tocar uma seção antiga troca o que mexer para `ui/`; nada se reescreve só por reescrever.**

Regra da camada nova: componente novo **não escreve cor**. Só classes `pn-*` e os tokens `--pn-*` (`--pn-fundo`, `--pn-superficie`, `--pn-texto`, `--pn-destaque`, `--pn-ok`, `--pn-aviso`, `--pn-erro`, `--pn-raio`…). O teste `npm run testar:painel-fundacao` falha se aparecer `#hex`, `rgb()` ou `[#hex]` em `ui/`, `moldes/`, `Menu.tsx` ou `estrutura.ts`. Quer uma classe nova? Acrescente uma `pn-*` em `styles/painel-tema.css` (edição pontual, sem mexer no resto do arquivo).

## Componentes de `ui/`

| Componente | Uso |
| --- | --- |
| `Botao` | `variante="principal"` (o **único** bordô da tela: um por tela), `"padrao"` ou `"discreto"`; `perigo` (texto de erro, o fundo nunca muda), `pequeno`, `icone` (exige `aria-label`). O botão não pula nem muda de cor ao passar o mouse. |
| `Campo`, `Area`, `Selecao`, `Marca` | Campo de uma linha, caixa de texto, lista de escolha e caixa de marcar. Todos com `rotulo` visível, `ajuda` e `erro` ligados por `aria-describedby` e `aria-invalid` (o erro sai em `role="alert"`). |
| `Tabela` | Tabela do TanStack Table 8: ordem por coluna (`aria-sort`), busca sem acento, páginas e estado vazio. `legenda` é obrigatória (leitor de tela). Não suba para a versão 9: a API é outra. |
| `Dialogo` | Janela com foco preso, Esc fecha e devolve o foco (Radix Dialog). |
| `confirmar()`, `perguntar()`, `confirmarFrase()`, `perguntarTexto()` + `<DialogosDoPainel />` | No lugar de `window.confirm` e `window.prompt`. Veja "Confirmar e perguntar" abaixo. |
| `notificar` + `<AvisosDoPainel />` | Aviso curto que some sozinho (Sonner): `notificar.ok`, `.erro`, `.info` e `.desfazer(texto, aoDesfazer)` (8 s para desfazer). |
| `Paleta` | Ctrl K: seções por espaço, nome e descrição, mais comandos (cmdk). `useFocoDeVolta(aberto)` guarda o elemento que tinha o foco e o devolve quando a janela fecha. |
| `Abas` (de `ui/`) | Abas com setas do teclado (Radix Tabs): `opcoes`, `valor`, `aoMudar`, `rotulo` e, se quiser, `painel`. |
| `Vazio`, `Esqueleto` | Estado vazio (título, texto e ação) e carregando (`rotulo` lido pelo leitor de tela). |

`<DialogosDoPainel />`, `<AvisosDoPainel />` e `<Paleta />` já estão montados em `Painel.tsx`: **não monte de novo**.

### Confirmar e perguntar

Ação perigosa (apagar, desligar, devolver, enviar para muitas pessoas) sempre pede confirmação que diz exatamente o que vai acontecer. O navegador não é usado: o `window.confirm`, o `window.prompt` e o `alert` não existem mais no painel (`npm run testar:painel-confirms` falha se sobrar um).

```ts
// frase única: a primeira frase vira o título, o resto o texto; o verbo do começo vira o nome do botão
if (!(await confirmarFrase("Apagar a aula? Isso não tem volta."))) return;
// sob medida
if (!(await confirmar({ titulo: "Apagar a aula?", texto: "Não dá para desfazer.", perigo: true }))) return;
// pergunta: devolve o texto ou null se a pessoa cancelou
const motivo = await perguntar({ titulo: "Motivo da recusa", rotulo: "Motivo", obrigatorio: true });
const nome = await perguntarTexto("Nome da paleta:", "");
```

Verbos que apagam, tiram do ar ou fecham (apagar, remover, retirar, tirar, sair, encerrar, cancelar, recusar, desligar, fechar, pausar) e frases com "não tem volta" ganham o tom de perigo: o foco começa em "Cancelar", e um Enter sem querer não destrói nada. A função que chama precisa ser `async`. Detalhes em `docs/PAINEL-CONFIRMS.md`. Ação que pede **segunda pessoa** (ligar recurso só pelo nome, zerar segundo fator) segue o fluxo de `docs/PAINEL-CONTROLES.md`.

## Moldes de tela (`moldes/`)

Toda seção nova escolhe um dos quatro e se registra em `components/painel/estrutura.ts` (`MAPA`: id da seção, espaço do menu e molde) e em `Painel.tsx`. Seção que ficar sem entrada no mapa cai no espaço do grupo antigo e no molde Registro: nada some do menu, mas o teste `testar:painel-fundacao` lê o registro de `Painel.tsx` e falha se faltar id (o mapa tem hoje 66 entradas, em 8 espaços).

| Molde | Para quê | Props principais |
| --- | --- | --- |
| `MoldeFila` | Lista de coisas esperando decisão e o item aberto ao lado (embaixo, no celular). Setas percorrem, "Próximo", e se o item sai da lista abre o seguinte. | `itens`, `chave`, `linha`, `detalhe`, `carregando`, `vazio`, `barra`, `rotulo` |
| `MoldeTabela` | Muitos registros iguais: barra de filtros e do botão de criar, busca, ordem, páginas. | `dados`, `colunas`, `legenda`, `barra`, `porPagina` (25) |
| `MoldeRegistro` | Um item ou área de trabalho: seções empilhadas e um lado de apoio opcional. | `secoes` (`id`, `titulo`, `conteudo`), `lado`, `acoes` |
| `MoldeConfiguracao` | Grupos de campos e rodapé fixo com "Salvar" (único principal, só vale com mudança) e "Descartar". Avisa quando há mudança não guardada. | `grupos`, `sujo`, `salvando`, `aoSalvar`, `aoDescartar` |

Os moldes não repetem o `h1`: o título e a descrição da seção ficam no cabeçalho de `Painel.tsx`. Hoje só as telas do Centro de controle (`components/painel/controles/`) usam os moldes; as demais seções seguem com a estrutura própria e migram quando alguém as tocar e puder conferi-las no navegador (`docs/PAINEL-NOVO.md`, "Pendências conhecidas").

## Menu e estrutura

`components/painel/Menu.tsx` desenha o menu lateral (recolhível no computador; folha inteira e barra de baixo no celular: Mesa, Escrever, Revisar, Atender, Mais). A fonte única de "qual seção mora em qual espaço" é `estrutura.ts` (`ESPACOS`, `MOLDES`, `MAPA`, `espacoDe`, `moldeDe`); o menu, a paleta e o teste leem o mesmo mapa. O que estava aberto fica guardado no aparelho (`lucia:painel-grupos`). Os atributos `data-tour` do tutorial precisam continuar no menu.

## Redesenho de novembro de 2026 (fundação)

O contrato completo está em `docs/PAINEL-REDESENHO.md` (vale sobre este arquivo onde os dois discordarem: Garamond volta aos títulos de seção e o mono volta aos rótulos). O painel aberto mora em `components/painel/casca/` (`Dentro.tsx`, `BarraSuperior.tsx`, `Camadas.tsx`, `Glossario.tsx`, `AtalhosDeTeclado.tsx`), carregado só no navegador; o estado da casca (menu recolhido, grupos, fixadas, recentes, larguras, modos, comandos da paleta, remendos otimistas) mora em `components/painel/estado.ts` (Zustand). Componentes novos de `ui/`, todos exportados por `ui/index.ts`:

- `Cartao` (`PropsDoCartao`, `VarianteDoCartao`: padrão, destaque, alerta, plano; `interativo`), `CabecalhoDeSecao` (nível 1 só da casca; nas seções, nível 2), `Faixa` (`TomDaFaixa`), `Separador`.
- `Selo` (`TomDoSelo`, sempre com palavra) e `Contador` (o número bordô do que espera, animado).
- `Lista` e `ItemDeLista`; `Estatistica` e `Estatisticas` (`TomDaEstatistica`); `Kbd`; `Busca` (campo com lupa, Esc limpa).
- `MenuSuspenso` (`ItemDoMenuSuspenso`, Radix Dropdown Menu) e `Dica` (Radix Tooltip).
- `PaineisAjustaveis` (`PainelAjustavel`, react-resizable-panels 3: colunas que se arrastam, larguras guardadas).
- `Composer` (`ComandoDoComposer`, `PropsDoComposer`): texto com comandos `/`, menção `@`, Ctrl B e Ctrl I; a saída é o mesmo texto simples.
- Movimento (Framer Motion, só por `m.*` dentro do `MotionConfig` da casca): `mola`, `curva`, `Surgir`, `ListaAnimada`, `ContagemAnimada`.
- `Esqueleto` ganhou `FormaDoEsqueleto` (linhas, cartões, tabela, fila); `Vazio` ganhou `simbolo`; `Botao` ganhou `simbolo`, `carregando`, `atalho` e `dica`; `cx` junta classes.
- Paleta (Ctrl K): a seção registra os comandos dela com `useComandosDaSecao` (`ComandoDaSecao`: `perigo` passa pelo `confirmar()`, `pedePessoa` abre a lista da equipe). Ação simples e reversível pode usar `agirOtimista` (ou `useAcaoOtimista`) de `comum.tsx`.

## Estilos e componentes da camada de antes

`comum.tsx` e `Campos.tsx` seguem em uso pelas telas que ainda não migraram:

| Nome | Para quê |
| --- | --- |
| `campo`, `botao`, `botaoClaro`, `elo`, `rotulo` (constantes de classe) | Campo, botão principal, botão secundário, ação discreta com cara de link e etiqueta pequena em monoespaçada. |
| `painel-cartao`, `painel-quadro`, `painel-aviso`, `painel-veu`, `painel-surge` (classes CSS) | Cartão com fio claro, quadro, aviso e janela por cima. As molduras grossas viram fio de 1 px e as sombras duras somem dentro do painel. |
| `Aviso` | Linha de retorno sob a ação (`role="status"`): "Salvo ✓", erro claro. Sempre presente, vazia quando não há nada. |
| `Abas` (de `comum.tsx`) | Abas de uma seção com contador opcional (`opcoes`, `atual`, `escolher`). Em tela nova prefira a de `ui/`. |
| `useLista` | Carrega uma função do banco e recarrega quando outro painel avisa que algo mudou (`PAINEL_MUDOU`). |
| `useAcao` | Executa uma ação, mostra "ocupado", a mensagem de sucesso ou o erro traduzido (`textoDoErro`). |
| `CampoData` | Data digitada como dd/mm/aaaa, com calendário no idioma da página; valor AAAA-MM-DD. Teclado: setas, Enter, Esc. |
| `CampoArquivo` | Arrastar e soltar (ou clicar), confere tipo e tamanho; nada de "Choose File". |
| `Selo` (agora em `ui/Selo.tsx`; a função local de `MinhaConta.tsx` saiu no redesenho) | Estado com palavra e cor (ok, aviso, erro), nunca só cor. Use o de `ui/`. |
| `Avatar` (`Avatar.tsx`) | Foto, desenho ou iniciais da pessoa. |

## Regras de escrita e acessibilidade

- Texto de leitura com 14 px ou mais; parágrafos curtos; listas e passos numerados em vez de blocos longos.
- Título, descrição curta, ação: nessa ordem. Um botão principal por tela.
- Todo campo com rótulo visível; erro em `role="alert"` perto do campo.
- Foco visível e tudo alcançável pelo teclado; diálogos fecham com Esc e devolvem o foco.
- Nada depende só de cor: "✓ aprovado", "✗ falhou", "! atenção".
- Testar no tema claro, no escuro, no alto contraste e na largura de celular (o painel tem barra de baixo própria).
- Ação de risco testada com uma conta sem privilégios e com a conta da coordenação.
- Frase nova no painel: rode `node scripts/textos-do-painel.mjs` e `npm run conferir:painel` e escreva a tradução nos cinco dicionários de `i18n/painel`. Plural com frase inteira para cada caso (nada de `aviso${n > 1 ? "s" : ""}`), e nada de juntar função e disciplina com " de ".
- Texto escrito pela equipe (mensagem, recado, pauta, texto de aula) vai dentro de um elemento com `data-original`, para o painel não traduzir; documento que precisa ficar em português (certificado, termo) leva `translate="no"`. Datas saem no idioma da página: `dia()`, `data()` e `dataHora()` de `comum.tsx`, ou `toLocaleDateString(localDoPainel())`; documento em português (certificado, comprovante) usa `diaBr()` e `pt-BR`.

## Conferir

```
npm run testar:painel-fundacao   # mapa, espaços, moldes, tema sem cor solta, bibliotecas
npm run testar:painel-confirms   # nenhum confirm/prompt/alert do navegador, imports e async
npm run testar:controles         # Centro de controle (moldes Configuração e Registro)
npm run conferir:painel          # frases do painel nos cinco dicionários
```

A conferência visual no navegador (computador e celular, claro e escuro, menu recolhido, janelas de confirmar) ainda é manual: nenhum teste automático a faz.
