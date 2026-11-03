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
| Calor, travamento, teclado cobrindo campo, toque difícil | não | sim |
