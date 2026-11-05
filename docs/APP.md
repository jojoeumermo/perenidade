<!-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE). -->
# O aplicativo (celular e site instalado)

Etapa 11 (B20) do plano de novembro de 2026. Este documento é a arquitetura da **casca do aplicativo** (pacote
`app-casca`) e a divisão do que falta entre os pacotes `app-telas`, `app-offline` e `app-loja`.

## Quando a casca vale

Uma só consulta, escrita em dois lugares que precisam ficar iguais (o teste `npm run testar:app-casca` confere):

```
(max-width: 767.98px), (display-mode: standalone) and (pointer: coarse)
```

- `components/app/modo.ts`, constante `CONSULTA_CASCA` (JavaScript);
- `app/app-casca.css` (CSS).

Ou seja: tela de celular (abaixo de 768 px) **ou** o site instalado num aparelho de toque (tablet). O computador, no
navegador ou instalado como janela, não muda em nada. (Desvio do pedido original: "standalone" sozinho pegaria o PWA
instalado no computador; o `pointer: coarse` o deixa de fora.) Fora do leitor de tinta: o `<html data-leitor>` continua
com o desenho de livro, porque as classes reaproveitadas já tratam `data-leitor`, `data-contrast` e `data-eink`.

O `<html data-app>` (ligado por `lib/prefs.ts`, só no instalado e no WebView do Android) é outra coisa: ele diz "estou
instalado" (sem faixa preta, bordas seguras, `viewport-fit=cover`). A casca vale em ambos os casos.

## Peças (`components/app/`)

| Arquivo | O que faz |
| --- | --- |
| `modo.ts` | Puro. `CONSULTA_CASCA`, as 5 abas (`ABAS`, `RAIZ_DA_ABA`), `abaDoEndereco`, `ehRaizDaAba`, tela cheia por endereço, quem tem casca própria (painel, Rede v2). |
| `CascaDoApp.tsx` | Cliente, montada uma vez no layout raiz dentro do `OutsidePanel`. Desenha a barra de baixo, liga o gesto e as transições, grava as marcas em `<html>`. |
| `gesto.ts` | Regras puras do voltar por gesto (+ `podeComecar`, que olha o elemento tocado). |
| `navegacao.ts` | "Voltar" do aplicativo: voltar de verdade se andou no site; senão sobe para a página de cima. Contador único (`registrarPagina`), usado também pela `BarraDoCelular`. |
| `transicoes.ts` | `comTransicao(direcao, atualizar)`: View Transitions API com reserva. |
| `telas.ts` | Contrato para o `app-telas`: `useTelaCheia` e `useTelaDaVez`/`pedirTela` (uma tela por vez). |
| `AulaDoDia.tsx` + `aula-do-dia.ts` | A "aula do dia" da tela Início (escolha no aparelho, sem servidor). |
| `textos.ts` | Os textos da casca nos 6 idiomas. Ficam fora dos JSON de i18n para a casca não pesar o núcleo de ninguém. |
| `app/app-casca.css` | Visibilidade, tela cheia, indicador do gesto e transições. |

### O que foi reaproveitado (nada duplicado)

- **Barra de cima:** `components/celular/BarraDoCelular.tsx` (voltar, título que aparece ao rolar, compartilhar, buscar,
  barra da aula). Mudou pouco: ganhou as raízes novas (`jogos`, `laboratorios`, `meu-estudo`: nelas aparece a marca, e
  não a seta) e passou a perguntar a `navegacao.ts` se a pessoa andou no site.
- **Barra de baixo:** a nova usa as classes `abas-do-celular`/`aba-do-celular`/`aba-aberta`, então todo o desenho de
  `app/celular.css` (cápsula vermelha, recuo do iPhone, alto contraste, leitor de tinta) vale sem copiar regra. Por ser a
  mesma classe, as regras que já escondem a barra (barra de ações da aula, foco na aula, **Rede v2**) a escondem também.
  A `BottomNav` do site continua existindo; a casca a esconde com `body:has(.app-casca-abas) nav.abas-do-celular:not(.app-casca-abas)`.
- **Início:** `components/celular/InicioDoCelular.tsx` já tinha data e cumprimento, busca, continuar de onde parou,
  atalhos, lambe-lambe, aula da semana e estantes. Ganhou o espaço `doDia` (a "aula do dia", logo abaixo do "continuar")
  em vez de uma segunda tela Início.

### Onde a casca não entra

- **Painel da equipe**, **área infantil** e **páginas embutidas** (laboratório na caixa da aula): o `OutsidePanel` já
  não monta a casca.
- **Rede Lúcia v2** (`ligado("rede-v2")`, caminho `/comunidade`): `ehTelaComCascaPropria` desliga a barra, o gesto e as
  transições; a Rede tem a sua barra e já esconde `.abas-do-celular`. Em produção a v2 está desligada, e `/comunidade` é a
  comunidade antiga, que usa a casca.
- **Escola ligada** (`ligado("escola")`): a barra de baixo continua a da Escola (`BottomNav`); a casca só dá gesto e
  transições. Em produção a Escola está desligada.

## Abas

| Aba | Raiz | Também conta como esta aba |
| --- | --- | --- |
| Início | `/` | |
| Estudar | `/trilhas` | `estantes`, `acervo`, `enem`, `escola`, `nivelamento`, `questoes`, `glossario`, `busca`... |
| Jogos e labs | `/jogos` | `laboratorios`, `ferramentas`, `estudio-de-pratica`, `criancas` |
| Comunidade | `/comunidade` | `mural`, `nucleos`, `debates`, `eventos`, `plantao` |
| Eu | `/meu-estudo` | `caderno`, `meus-dados`, `entrar`, `historico`, `por-onde-andei`, `modo-seguro`, `privacidade` |

Tocar na aba aberta: numa tela de dentro, volta para a raiz da aba; na raiz, sobe até o começo da página.
O Início do aplicativo não é uma rota nova: é a própria inicial no celular (`InicioDoCelular`), na ordem de aplicativo
(cumprimento, busca, **continuar estudando**, **aula do dia**, avisos da Escola, atalhos, lambe-lambe, aula da semana,
estantes). Para mudar o que uma aba cobre, edite `TRECHOS_DA_ABA` em `modo.ts`; o teste não deixa um trecho cair em duas abas.

## Voltar por gesto

Deslizar da **borda esquerda** (faixa de 28 px) para a direita, 72 px ou mais, em até 0,9 s, quase reto. Regras que
protegem a rolagem de lado:

1. o gesto só **começa** na faixa da borda, então carrossel e tabela rolando de lado ficam com o dedo;
2. se o toque começou sobre uma faixa que rola de lado e já foi rolada (`scrollLeft > 0`), não é gesto;
3. nunca dentro de campo de texto, `select`, `canvas`, `iframe`, `video`, controle deslizante, janela aberta
   (`role="dialog"`, `aria-modal`, `<dialog open>`) ou `[data-sem-gesto]` (use esta marca em mapas e quadros de desenho);
4. só decide no `touchend`; se o sistema tomar o gesto (Android com navegação por gestos), chega `touchcancel` e nada
   acontece: nunca voltam duas telas;
5. iPhone e iPad já têm o deslizar do sistema (também instalado): a casca não liga o dela.

O voltar é o de `navegacao.ts`. Na tela Início o gesto não faz nada (não existe "para trás").

## Transições

`comTransicao("aba" | "avancar" | "voltar", atualizar)` usa `document.startViewTransition` e marca `<html data-transicao>`
para o CSS escolher a animação (aba: sobe com fade; avançar/voltar: desliza 14%). A barra de baixo tem
`view-transition-name: app-abas` e fica parada. Sem a API, a tela só troca e `data-chega` dá um fade de 0,2 s. Tudo
dentro de `prefers-reduced-motion: no-preference`, e some com o "Parar movimentos" do site (`data-parado`). Hoje a
transição roda ao tocar numa aba e no voltar por gesto; links comuns usam a reserva (fade). Para animar mais fluxos,
chame `comTransicao` em volta do `router.push`.

## Marcas em `<html>` (para os outros pacotes)

| Marca | Quem grava | Significa |
| --- | --- | --- |
| `data-casca` | `CascaDoApp` | a casca está valendo agora |
| `data-casca-aba="estudar"` | `CascaDoApp` | a aba atual |
| `data-tela-cheia` | `useTelaCheia(true)` | a tela some com **as duas** barras (ela traz o próprio voltar) |
| `data-tela-cheia-rota` | `CascaDoApp` | laboratório aberto (`/laboratorios/<lab>`): sai só a barra de baixo; a de cima fica com o voltar |
| `data-transicao`, `data-chega` | `transicoes.ts` / `CascaDoApp` | animação em curso (só CSS lê) |

## Divisão dos pacotes seguintes

### app-telas (laboratórios e aula em telas próprias) — feito (Etapa 11)

**Causa do bug "abrir um laboratório e a aula ao mesmo tempo quebra tudo".** Achada por leitura do código (sem aparelho):
a folha da aula (`AcoesDaAula`), a gaveta "Mais" (`MaisGaveta`) e o editor em tela cheia (`Editor`) travavam a rolagem
escrevendo `overflow: hidden` no `<html>` e destravando por `removeProperty`, cada um por conta própria, e as telas da
aula (consulta de palavra, cartão do trecho, folha) podiam ficar abertas juntas, cada uma com o seu Esc e o seu foco.
Com duas abertas, fechar uma soltava a trava da outra (a página rolava por baixo) ou, na ordem inversa, a página ficava
travada; e a folha da aula continuava aberta por cima da página do laboratório, porque a barra de cima não desmonta ao
trocar de rota.

**O que mudou** (tudo em `components/app/telas.ts`, sem rede e sem disco):

- `travarRolagem()` / `useTravaDeRolagem(ativa)`: trava com contagem; só solta quando a última tela solta, e devolve o
  valor de `overflow` que a página já tinha. `AcoesDaAula`, `MaisGaveta` e `Editor` passaram a usá-la.
- `useTelaDaVez(id, aberta, fechar)` agora também mantém a pilha de telas abertas. Ids em uso: `folha-da-aula`,
  `gaveta-mais`, `consulta-de-palavra`, `cartao-do-trecho`. Abrir uma fecha a outra: nunca dois overlays.
- `fecharTelaDaVez()`: o "voltar" da barra de cima (`BarraDoCelular`) e o gesto da borda (`CascaDoApp`) fecham antes a
  tela aberta, e a página fica onde está. `fecharTelas()`: a casca chama a cada mudança de endereço, então nada fica aberto
  nem travado na tela seguinte.
- Cada laboratório já é uma rota própria (`/laboratorios/<lab>`), com a barra de baixo escondida pela casca
  (`data-tela-cheia-rota`) e a barra de cima com o voltar. Os `<iframe>` dos laboratórios já são ignorados pelo gesto.

Para uma tela de ferramenta nova: `useTelaDaVez("<id>", aberta, fechar)` + `useTravaDeRolagem(aberta)`; imersão total:
`useTelaCheia(true)` e oferecer o próprio voltar; mapa, desenho ou arrastar com um dedo: `data-sem-gesto`; não escreva em
`<html data-casca*>`, só leia. O editor do painel (`painel/design/Estudio.tsx`) ainda guarda o `body.style.overflow`
sozinho (fora da casca; não mexi).

Teste: `npm run testar:app-telas` (12 conferências, lógica pura) e `e2e/app-telas.spec.ts` (Playwright no Pixel 7:
`npx playwright test e2e/app-telas --project=celular`, precisa do `npm run dev:local`; escrito, ainda não rodado).

### app-offline (`public/sw.js` e o que fica offline)

A casca não guarda nada e não tem rede. Pedidos ao `app-offline`: (1) pré-guardar as **5 raízes das abas** nos 6
idiomas (`/<lang>`, `/trilhas`, `/jogos`, `/comunidade`, `/meu-estudo`), para a barra de baixo nunca cair na página "sem
conexão"; (2) a "aula do dia" aponta para aulas do "Comece aqui": guardar essas aulas; (3) avisar na tela quando a aba
está sem conexão (usar `data-casca` para o estilo); (4) lembrar que mudar o `sw.js` exige subir `VERSAO` aqui e em
`components/Offline.tsx`. O CSS e o JS da casca já vão no pacote comum do layout (nada de arquivo novo em `public/`).

### app-loja (Capacitor e testes em aparelho)

O WebView do Android se anuncia com `; wv)` e já liga `data-app`; a casca vale dentro dele pela largura (< 768 px).
Para o `app-loja`: (1) conferir a barra de baixo com navegação por gestos **e** por três botões (o gesto da borda
convive com o do sistema pelo `touchcancel`); (2) o botão "voltar" do Android no Capacitor deve chamar `history.back()`
e, na raiz, sair (`App.exitApp`), nunca voltar duas telas; (3) testar no Galaxy S24 emulado (viewport 360 x 780,
`pointer: coarse`) e num celular de entrada (tela de 320 px, pouca memória: a casca só usa `touch*`, CSS e uma
`matchMedia`); (4) o `viewport-fit=cover` e `--recuo-baixo` já cuidam das bordas. A taxa única da loja é decisão do
Jonathan (plano, Etapa 11).

## Privacidade

A casca não usa rede, não grava nada e não mede nada: `components/app/` não tem `fetch`, `sendBeacon` nem contador (o
teste confere). O "continuar estudando" e a "aula do dia" leem o que o próprio aparelho já guardava (`lib/progress.ts`,
`lib/storage.ts`). Nada sai do aparelho.

## Rastreio do deploy

Nada em `components/app/` lê disco (o teste proíbe `fs`/`path`/`readFileSync`/import dinâmico por caminho). O único
dado novo no servidor é `content/comecar.json`, importado estaticamente em `app/[lang]/page.tsx` (já era importado em
`app/[lang]/layout.tsx`); a página já tinha `getTracks`. Rodar `npm run conferir:rastreio` antes do deploy.

## Conferir

```
npm run testar:app-casca
```

25 conferências: abas e endereços, gesto, voltar, aula do dia, uma tela por vez, 6 idiomas, rastreio, privacidade, CSS e layout.

## Pendências desta etapa

- Teste em aparelho/emulador: o `app-loja` rodou o possível com Playwright (S24, WebView, celular de entrada) contra um build **anterior** à casca; refazer com `npm run build` novo. Ver `docs/APP-LOJA.md` e `docs/TESTE-EM-APARELHO-REAL.md`.
- Transição de página ligada só nas abas e no gesto; `viewTransition` do Next (experimental) não foi ligado para não
  mexer em `next.config`.
- A aba "Jogos e labs" abre `/jogos`, e a página de jogos não leva aos laboratórios (`/laboratorios`, que contam como a
  mesma aba). Falta um hub único (ou um atalho para os laboratórios em `/jogos`): decisão de desenho para o `app-telas`.
