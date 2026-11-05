# Teste dos 12 eixos (Etapa 6, B6/B32)

Página: `/[lang]/nivelamento/eixos`. Dados: `content/eixos.json`. Conta: `lib/eixos/pontuacao.ts`. Tela: `components/estudo/DozeEixos.tsx`. Teste: `npm run testar:eixos`.

## O que é

Refeito inspirado no formato do 12axes (https://12axes.vercel.app/br, página que só abre com JavaScript, então o formato foi tomado da estrutura geral: doze eixos, concordo/discordo em cinco passos, três tamanhos, resultado com eixos e proximidades). Nenhum texto nem código foi copiado: eixos, perguntas e descrições são do instituto.

- Três tamanhos, cada um contido no seguinte: **curto 36** (3 por eixo), **médio 96** (8 por eixo, perto das 100 pedidas) e **longo 240** (20 por eixo).
- Equilíbrio: em cada eixo, médio e longo têm metade das frases para cada lado; o curto tem 18 frases para cada lado no total (eixos alternam 2+1 e 1+2). Frases escritas na forma neutra "concordo/discordo", sem apelar a rótulos.
- Resultado: os 12 eixos em barras, as 3 ideologias, os 3 países e as 3 figuras históricas mais próximos (distância euclidiana nos 12 números).
- Respostas ficam só no aparelho (`localStorage`, chave `lucia:eixos`), para continuar depois; nada é enviado.

## Pontuação (`lib/eixos/pontuacao.ts`)

Módulo puro (sem import, sem disco, sem rede), usado pela tela, pelo teste e pela Etapa 8.

- `pontuarEixos(eixos, perguntas, respostas)`: 0 a 100 por eixo, a parte que puxa para o lado `a`. Concordo totalmente = 1, concordo = 0,5, neutro = 0, discordo = -0,5, discordo totalmente = -1; frase do lado `b` inverte o sinal.
- `ordemDoNivel`, `maisProximos`, `proximidade`: ordem das perguntas e proximidade.
- **Para a Etapa 8 (pesquisa anônima da equipe):** `agregarPontos(eixos, resultados, minimo = 5)` devolve só `{ n, media, distribuicao }` por eixo (cinco faixas de 20) e `null` se houver menos de `minimo` pessoas. A função recebe o vetor de 12 números calculado no aparelho; quem chama não precisa e não deve guardar respostas individuais. Importar com `import { agregarPontos, pontuarEixos } from "@/lib/eixos/pontuacao"` (ou caminho relativo em teste).

## Leis conferidas no planalto.gov.br

- **LGPD, Lei 13.709/2018, art. 5º, II:** opinião política é dado pessoal sensível. **Art. 11:** só se trata com uma das hipóteses ali listadas (na pesquisa da equipe: consentimento específico e destacado, art. 11, I). **Art. 5º, XII:** consentimento é manifestação livre, informada e inequívoca. **Art. 12:** dado anonimizado deixa de ser pessoal, exceto se a anonimização puder ser revertida com esforço razoável; por isso o agregado recusa grupos pequenos.
- O teste público não coleta nada: sem nome, sem e-mail, sem contagem, sem rastreamento. A tela avisa isso (texto em `ui.privacidade`).
- **Direitos autorais, Lei 9.610/1998:** art. 41 (direitos patrimoniais por 70 anos a partir de 1º de janeiro do ano seguinte à morte) e art. 24, II (indicar o nome do autor). Só entram figuras falecidas há mais de 70 anos (a última, Getúlio Vargas, em 1954) e todo retrato leva autor, licença e link para a página no Commons.

## Figuras e imagens

17 figuras históricas, todas já falecidas (nenhuma pessoa viva, para não atribuir opinião política a quem pode contestar). Cada retrato foi conferido no Wikimedia Commons pela API (campo de licença: "Public domain" em todos). O arquivo é referenciado só pelo nome (`Special:FilePath`), **não baixado para o repositório**, e **só é carregado depois do clique em "Mostrar os retratos"** (abrir a imagem mostra o endereço de rede ao Wikimedia; sem clique, nada de terceiros). Se um dia uma licença mudar no Commons, remover o item de `figuras`.

Arquivos: Kropotkin Portrait.jpg, Malatesta.png, Pierre-Joseph Proudhon.jpg, Karl Marx 001.jpg (Mayall), Vladimir Lenin in July 1920 by Pavel Zhukov.jpg, Leon Trotsky 1.jpg, Rosa Luxemburg.jpg, Getulio Vargas (1930).jpg, Luiz Gama.jpg, Portrait of Simón Bolívar by Arturo Michelena.jpg, Mary Wollstonecraft by John Opie (c. 1797).jpg, Adam Smith The Muir portrait.jpg, John Locke by Sir Godfrey Kneller, Bt.jpg, Thomas Jefferson by Rembrandt Peale, 1800.jpg, Portrait of Edmund Burke 128.jpg (Barry), Alexis de tocqueville.jpg (Chassériau), Mahatma-Gandhi, studio, 1931.jpg (Elliott & Fry).

## Limites honestas

- As posições de ideologias, países e figuras nos 12 eixos são **leituras editoriais aproximadas** do instituto (os textos de cada um citam fatos e obras conhecidos; os números não vêm de pesquisa). A tela e o método dizem isso. Revisão por quem entende de cada tema é bem-vinda; os números ficam em `content/eixos.json`.
- Idiomas: perguntas, ideologias, países e figuras só em português (a página mostra o aviso de rascunho nos outros idiomas). Só o texto da versão completa (`levels.3.desc`) foi atualizado nos seis idiomas ("vinte perguntas por eixo"); os textos novos ficam em `ui` dentro de `content/eixos.json`, em português.
- A palavra "universidade" foi trocada por "ensino superior" na pergunta di3.
