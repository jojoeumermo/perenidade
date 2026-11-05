# Teste no celular de entrada (aparelho real)

O teste automático `npm run testar:entrada` imita um celular simples (tela de 360 × 640, processador 4 vezes mais lento,
rede 3G lenta de 400 kbps com 400 ms de espera). Imitar não é o mesmo que usar. Esta lista é para o **celular de entrada
fixo do Núcleo**, que fica com a coordenação: a cada publicação grande (e pelo menos uma vez por mês), alguém da equipe
pega o aparelho e passa por ela, do começo ao fim, sem pular passos.

Anote no fim o modelo do aparelho, a versão do Android, o navegador e a data. Faça o teste **no dado móvel** (chip do
Núcleo), não no Wi-Fi, a não ser onde a lista diz o contrário.

## Antes de começar

1. No Android: Configurações › Rede › Uso de dados. Anote quanto o navegador (ou o aplicativo do Instituto) já gastou
   neste mês. É a régua do item 9.
2. Feche os outros aplicativos. Bateria acima de 30%.
3. Se o aplicativo já estiver instalado de uma rodada anterior, desinstale-o e limpe os dados do site no navegador
   (Configurações do navegador › Configurações do site › institutolucia.org › Limpar). O teste é de quem chega pela
   primeira vez.

## A lista

Marque cada item com **ok**, **demorou** (funcionou, mas a espera incomodou: anote os segundos) ou **falhou**.

1. **Abrir o site.** No navegador, `institutolucia.org`. Cronometre até o texto da página aparecer (não precisa esperar
   as imagens). Anote os segundos.
2. **Instalar o aplicativo.** Menu do navegador › "Adicionar à tela inicial" (ou "Instalar aplicativo"). O ícone
   aparece na tela inicial e abre o site sem a barra do navegador.
3. **Abrir uma aula e ler.** Pelo aplicativo, entre em Trilhas › Ler e escrever › a primeira aula. Role até o fim.
   A tela trava? O texto pula de lugar enquanto carrega?
4. **Ouvir uma aula.** Na mesma aula, aperte "Ouvir a aula" com a voz do aparelho. A leitura começa? Dá para pausar?
   Não escolha a voz natural no dado móvel: ela baixa um modelo grande (o site avisa o tamanho antes).
5. **Abrir sem rede.** Ponha o celular em modo avião. Feche e abra o aplicativo. A aula do item 3 abre? A página
   inicial abre? Uma página que você **não** visitou deve mostrar o aviso de que está sem internet, sem tela branca.
   Tire o modo avião.
6. **Modo leve.** Botão Acessibilidade › "Economia de dados (modo leve)". Volte à página inicial: as imagens somem e a
   página fica parada, sem animação. Deixe ligado até o item 9.
7. **Letra grande.** Acessibilidade › Tamanho do texto › "Enorme". Abra uma aula, a página de busca e a caixa de
   ferramentas de uma aula. Nada pode ficar cortado nem obrigar a rolar para o lado.
8. **Tema escuro.** Use o botão de alternar o tema. Leia uma aula inteira. Algum texto ficou difícil de ler? Algum
   quadro ficou branco no meio do escuro?
9. **Gasto de dados.** Volte em Configurações › Uso de dados. Quanto o teste inteiro gastou (itens 1 a 8)?
   **Meta: menos de X MB.**

   > **X ainda não foi medido.** Ele sai da primeira medição do `npm run testar:entrada` contra uma montagem de produção
   > (a coluna `totalKb` da saída, somada nas três páginas, mais 10%), conforme explicado no cabeçalho de
   > `e2e/aparelho-de-entrada.spec.ts`. Até lá, só anote o número: ele mesmo vira a primeira referência.

10. **Selo de privacidade.** Numa aula, abra a caixa de ferramentas › Calculadora. Logo abaixo do topo da ferramenta
    aparece "Fica no seu aparelho". No Dicionário aparece "Passa pelo servidor do Instituto". O link leva à página de
    privacidade?

## O aplicativo da loja e a casca de app (Etapa 11)

A casca de aplicativo (barra de baixo de 5 abas, voltar por gesto, transições: `docs/APP.md`) e o pacote da loja
(`docs/APP-LOJA.md`) pedem estes itens a mais, no **celular de entrada** e, se houver, num aparelho de tela grande (tipo
Galaxy S24). Faça com a barra de navegação do Android **por gestos** e depois **por três botões** (Configurações ›
Sistema › Navegação do sistema). Marque ok, demorou ou falhou, como acima.

11. **Barra de baixo.** Início, Estudar, Jogos e labs, Comunidade, Eu: cada aba abre, a aba atual fica marcada e a barra não
    cobre o fim da página nem o botão de gestos do sistema. Tocar na aba que já está aberta volta ao começo dela.
12. **Voltar.** Entre numa aula e aperte o botão Voltar do Android (ou o gesto do sistema): volta **uma** tela, nunca duas.
    Na raiz de uma aba, o mesmo gesto sai do aplicativo. A seta do alto também volta uma tela.
13. **Gesto da borda.** Arraste do canto esquerdo para o centro, devagar, numa aula: aparece o indicador e volta uma tela.
    Rolar a página para baixo, rolar uma tabela para o lado e escrever num campo **não** podem voltar a página sem querer.
14. **Laboratório.** Abra um laboratório: a barra de baixo some (tela cheia) e volta ao sair. Abra uma aula com a caixa de
    ferramentas e depois um laboratório, e o contrário: nada trava nem aparece duas vezes (defeito conhecido, ainda do
    pacote `app-telas`: anote o que viu).
15. **Aula do dia.** Na tela Início aparece a aula do dia, abaixo do "continuar estudando". Fazer a aula troca a sugestão.
16. **Movimento reduzido.** Acessibilidade › Movimento › parado: as transições de tela viram corte seco.
17. **Dentro do aplicativo da loja** (só depois de gerar o pacote, `docs/APP-LOJA.md`): ícone e nome certos, sem barra de
    endereço, links de fora do Instituto abrem no navegador, e só a permissão de internet foi pedida.

## O que dá para imitar no computador (e o que ainda não foi medido)

Imitar não é o mesmo que usar, mas pega boa parte dos defeitos de largura, de barra e de lentidão antes do aparelho.

| Aparelho imitado | Como | Comando |
|---|---|---|
| **Galaxy S24** (Playwright, `devices["Galaxy S24"]`: 360 × 780, densidade 3) | Navegador do celular | `BASE_URL=http://localhost:3951 npm run testar:app-aparelho` |
| **Galaxy S24, tamanho padrão de fábrica** (1080 × 2340 com densidade 2,8125 = **384 × 832**) | Mesmo teste, bloco "384x832" | o mesmo comando |
| **Galaxy S24 dentro do aplicativo** (WebView: `; wv)` e `InstitutoLuciaApp/2`) | Mesmo teste, agente de usuário do Capacitor | o mesmo comando |
| **Celular de entrada** (360 × 640, densidade 2, CPU 4 vezes mais lenta, 3G de 400 kbps e 400 ms) | Limites do Chrome (CDP) | `BASE_URL=... npm run testar:entrada` (LCP e JavaScript) e o bloco do mesmo arquivo (tempo e rolagem lateral) |

Use **uma montagem de produção**: `npm run build` e depois `npx next start -p 3951` (o `dev:local` manda JavaScript sem
compactar e não serve de régua). O teste `testar:app-aparelho` roda só no projeto `computador` (ele troca de aparelho
sozinho) e **anota "sem casca neste build"** em vez de falhar se o `next start` for de um build anterior ao pacote
`app-casca`. Confira a anotação: se aparecer, refaça o `npm run build` antes de confiar no resultado.

### Resultados registrados

| Data | Build | O que rodou | Resultado |
|---|---|---|---|
| 05/11/2026 | `next start` do build das 01h26, **anterior** à casca (não refeito para não sobrescrever o `.next` que outros pacotes usam) | `npm run testar:app-aparelho` (S24 360 × 780, S24 384 × 832, S24 no WebView, celular de entrada) e `npm run testar:entrada` | S24 nos três tamanhos: **sem rolagem lateral** em `/pt`, `/pt/trilhas`, `/pt/jogos`, `/pt/laboratorios`, `/pt/comunidade` e `/pt/meu-estudo` (0 px de sobra). Os itens da casca (5 abas, voltar, tela cheia no laboratório) foram **anotados como "sem casca neste build" e não conferidos**. Celular de entrada: texto de `/pt` em 4,8 s, de `/pt/jogos` em 14,3 s (a mais lenta, a olhar) e de `/pt/meu-estudo` em 1,8 s; sem rolagem lateral. `testar:entrada`: início com LCP 4616 ms, JavaScript 261 KB, total 563 KB; aula de Ler e escrever com LCP 4896 ms, JavaScript 357 KB, total 652 KB (a escola, desligada, foi pulada). Os limites do teste ainda são `null` (só mede). |

O gesto do dedo (borda esquerda), o botão Voltar do Android, a navegação por três botões, o calor e a memória **não** se
imitam: ficam para os itens 11 a 17 acima, no aparelho.

## Como relatar

- **Tudo ok:** uma linha no grupo da equipe: "Teste no celular de entrada, DD/MM, ok, gastou N MB".
- **Algo falhou ou demorou:** abra um relato em [Relatar um erro](/relatar-erro) (ou uma *issue* no GitHub) com:
  o número do item, o que você esperava, o que aconteceu, os segundos (se demorou), o modelo do aparelho, o Android, o
  navegador e, se puder, uma captura de tela. **Não** mande foto de pessoa nem dado pessoal: o print é só da tela do site.
- Se o mesmo item demorar em duas rodadas seguidas, ele vira prioridade da equipe de desenvolvimento.

## O que o teste automático cobre e o que só o aparelho mostra

| | `npm run testar:entrada` | Celular do Núcleo |
|---|---|---|
| Tempo até a maior pintura (LCP) e JavaScript baixado em `/pt`, numa aula de Ler e escrever e em `/pt/escola` | sim, com limites | não mede, só a impressão |
| Rolagem lateral em 360 px | sim | sim |
| Instalar, abrir sem rede, ouvir, gasto real de dados | não | sim |
| Barra de baixo, tela cheia no laboratório, ausência de rolagem lateral no S24 (360 × 780 e 384 × 832) e no WebView | `testar:app-aparelho` | sim |
| Gesto de voltar da borda, botão Voltar do Android, gestos x três botões | não | sim |
| Calor, travamento, teclado cobrindo campo, toque difícil | não | sim |
