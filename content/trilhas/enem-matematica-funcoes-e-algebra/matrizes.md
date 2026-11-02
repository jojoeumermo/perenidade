---
titulo: "Matrizes e tabelas"
resumo: "A matriz como uma tabela com endereço: ler o elemento da linha i e da coluna j, somar, multiplicar por um número e multiplicar linha por coluna para achar totais, como faturamento, pontos ou tempo de produção."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 11.5, Matrices and Matrix Operations"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/11-5-matrices-and-matrix-operations"
  - titulo: "Matriz de Referência do Enem"
    autor: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (Inep)"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma matriz com 3 linhas e 4 colunas é do tipo"
    opcoes: ["4 × 3", "7", "3 × 4", "12 × 1"]
    resposta: 2
    explicacao: "O tipo se escreve linhas × colunas: 3 × 4. Ela tem 3 × 4 = 12 elementos, mas o tipo é 3 × 4."
  - pergunta: "Na matriz A cuja linha 1 é (1, 2) e cuja linha 2 é (3, 4), quanto vale o elemento a₂₁?"
    opcoes: ["2", "3", "4", "1"]
    resposta: 1
    explicacao: "a₂₁ é o elemento da linha 2 e da coluna 1. A linha 2 é (3, 4), e o primeiro número dela é 3."
  - pergunta: "Para que o produto A · B exista, sendo A do tipo 2 × 3, a matriz B precisa ter"
    opcoes: ["2 linhas", "3 colunas", "2 colunas", "3 linhas"]
    resposta: 3
    explicacao: "Na multiplicação, cada linha de A (com 3 números) é combinada com cada coluna de B. Para isso, cada coluna de B tem de ter 3 números: B tem 3 linhas."
  - pergunta: "Numa matriz em que aᵢⱼ = i + j, quanto vale a₂₃?"
    opcoes: ["5", "6", "1", "23"]
    resposta: 0
    explicacao: "Em a₂₃, i = 2 e j = 3. Pela lei, a₂₃ = 2 + 3 = 5. O 23 não é um número: são dois índices, linha e coluna."
---

```provocacao
Uma cooperativa vende alface, tomate e feijão em duas feiras do bairro. Numa tabela, a tesoureira anota quanto vendeu de cada produto em cada feira. Noutra, os preços. Existe um jeito organizado de achar, de uma vez, quanto cada feira faturou?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é uma matriz, ler qualquer elemento pela linha e pela coluna, montar uma matriz a partir de uma lei, somar matrizes, multiplicar uma matriz por um número e multiplicar duas matrizes, linha por coluna, entendendo o que o resultado quer dizer.

## Uma tabela com endereço

Uma **matriz** é uma tabela de números, arrumada em linhas (deitadas) e colunas (em pé). Uma matriz com m linhas e n colunas é do **tipo m × n**, e se lê "m por n". A ordem é sempre linhas antes de colunas.

Cada número tem um endereço. O elemento **aᵢⱼ** é o que fica na linha i e na coluna j. Assim, a₂₃ é o da linha 2, coluna 3. Os dois números pequenos são índices, e não um número só: a₂₃ não é "a vinte e três".

Veja a tabela de vendas da cooperativa, em quilos:

| Feira | Alface | Tomate | Feijão |
| --- | --- | --- | --- |
| Feira 1 | 10 | 20 | 5 |
| Feira 2 | 15 | 10 | 8 |

Ela é uma matriz 2 × 3. O elemento a₂₁ = 15 diz que a feira 2 vendeu 15 kg de alface. Ler bem o endereço é metade das questões de matriz no ENEM.

## Matriz definida por uma lei

Às vezes a questão não mostra os números: dá uma lei. Por exemplo, aᵢⱼ = 2i − j, para uma matriz 2 × 2. Para cada lugar, troque i pelo número da linha e j pelo da coluna:

- a₁₁ = 2 · 1 − 1 = 1 e a₁₂ = 2 · 1 − 2 = 0.
- a₂₁ = 2 · 2 − 1 = 3 e a₂₂ = 2 · 2 − 2 = 2.

A matriz tem a linha 1 igual a (1, 0) e a linha 2 igual a (3, 2).

## Somar e multiplicar por um número

Para **somar** duas matrizes do mesmo tipo, some os elementos que estão no mesmo lugar. Se a tabela de março e a de abril têm as mesmas linhas e colunas, a soma dá o total dos dois meses, lugar por lugar.

Para **multiplicar por um número**, multiplique todos os elementos por ele. Se todos os preços de uma tabela sobem 10%, a nova tabela é a antiga multiplicada por 1,1.

## Multiplicar linha por coluna

Volte à provocação. Os preços são: alface R$ 2,00, tomate R$ 5,00 e feijão R$ 8,00 o quilo. Escreva-os numa coluna. O faturamento da feira 1 é a linha dela "vezes" a coluna dos preços: 10 · 2 + 20 · 5 + 5 · 8 = 20 + 100 + 40 = 160 reais. O da feira 2: 15 · 2 + 10 · 5 + 8 · 8 = 30 + 50 + 64 = 144 reais.

Isso é o **produto de matrizes**. Cada elemento do resultado é uma linha da primeira combinada com uma coluna da segunda: multiplique os pares, na ordem, e some.

```formula
(A · B)ᵢⱼ = linha i de A combinada com a coluna j de B
multiplique o 1º da linha pelo 1º da coluna, o 2º pelo 2º, e assim por diante, e some tudo
só existe se o número de colunas de A for igual ao número de linhas de B; A (m × n) · B (n × p) dá m × p
```

Na conta das feiras, A é 2 × 3 e a coluna de preços é 3 × 1. O resultado é 2 × 1: um faturamento para cada feira.

Cuidado: na multiplicação de matrizes, a ordem importa. A · B e B · A podem dar resultados diferentes, ou um deles pode nem existir.

```verificar
A matriz A tem linha 1 igual a (2, 0) e linha 2 igual a (1, 3). A matriz B tem linha 1 igual a (1, 1) e linha 2 igual a (0, 2). Quanto vale o elemento da linha 1, coluna 1, de A + B?
- 2
+ 3
- 1
> Na soma, junte os elementos do mesmo lugar: 2 + 1 = 3.
```

```navidareal
Tabelas de dupla entrada estão em toda parte: a classificação de um campeonato, o horário dos ônibus por linha e por dia, a planilha de vendas de um pequeno negócio, a tabela nutricional por porção.

Planilhas eletrônicas fazem, por dentro, as mesmas contas desta aula: somam colunas, multiplicam uma tabela por um reajuste e cruzam quantidades com preços.
```

## Exemplo resolvido

**Numa cozinha comunitária, cada marmita do tipo 1 leva 200 g de arroz e 100 g de feijão; cada marmita do tipo 2 leva 150 g de arroz e 150 g de feijão. Para um evento, foram pedidas 20 marmitas do tipo 1 e 30 do tipo 2. Quanto de arroz e de feijão é preciso?**

1. Monte a matriz dos ingredientes: as linhas são arroz e feijão; as colunas, os tipos 1 e 2. Linha do arroz: (200, 150). Linha do feijão: (100, 150).
2. Monte a coluna do pedido: 20 do tipo 1 e 30 do tipo 2.
3. Arroz: 200 · 20 + 150 · 30 = 4.000 + 4.500 = 8.500 g, ou 8,5 kg.
4. Feijão: 100 · 20 + 150 · 30 = 2.000 + 4.500 = 6.500 g, ou 6,5 kg.

Confira o tipo: matriz 2 × 2 vezes coluna 2 × 1 dá uma coluna 2 × 1, com um total para cada ingrediente.

## Como isso cai no ENEM

- **Formatos:** tabela de dupla entrada para ler um elemento pelo endereço (linha e coluna); matriz definida por uma lei aᵢⱼ; tabela de distâncias entre cidades; quantidades vezes preços, ingredientes vezes pedidos, resultados vezes pontos de um campeonato. Muitas vezes a palavra "matriz" nem aparece, e a questão é só a leitura atenta de uma tabela.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma das 81 questões classificadas de Matemática foi marcada neste tópico. Leitura de tabelas, porém, teve 2 questões (2,5%), e o objeto conhecimentos algébricos, que inclui as matrizes, teve 11 (13,6%). São só duas provas: é tendência, não promessa.
- **Habilidades:** H21 (resolver problemas cuja modelagem pede álgebra), H19 (identificar a expressão algébrica que traduz a relação entre grandezas) e H22 (usar álgebra e geometria para construir argumentos).
- **Armadilhas:**
  - Trocar linha por coluna ao ler aᵢⱼ.
  - Multiplicar elemento por elemento quando a conta é linha por coluna.
  - Multiplicar matrizes cujos tipos não combinam.
  - Achar que A · B é sempre igual a B · A.

## Questão comentada

**Texto-base.** Num campeonato de futebol de várzea, cada vitória vale 3 pontos, cada empate vale 1 ponto e cada derrota vale 0 ponto. A matriz abaixo mostra, para três times, o número de vitórias, empates e derrotas, nessa ordem.

| Time | Vitórias | Empates | Derrotas |
| --- | --- | --- | --- |
| A | 4 | 2 | 1 |
| B | 3 | 4 | 0 |
| C | 5 | 0 | 2 |

**Comando.** O time com mais pontos e a pontuação dele são

A) o time B, com 17 pontos.
B) o time C, com 5 pontos.
C) o time A, com 7 pontos.
D) o time C, com 15 pontos.
E) o time C, com 17 pontos.

**Resolução.**

1. Escreva os pontos numa coluna: 3, 1 e 0.
2. Multiplique cada linha pela coluna. Time A: 4 · 3 + 2 · 1 + 1 · 0 = 12 + 2 + 0 = 14.
3. Time B: 3 · 3 + 4 · 1 + 0 · 0 = 9 + 4 = 13.
4. Time C: 5 · 3 + 0 · 1 + 2 · 0 = 15.
5. O time C lidera, com 15 pontos.

**Gabarito: D.**

**Por que as outras não:**

- A) o time B, com 17 pontos: o empate foi contado como 2 pontos (9 + 8). Pela regra, o empate vale 1.
- B) o time C, com 5 pontos: contou só as vitórias, sem multiplicar pelos 3 pontos de cada uma.
- C) o time A, com 7 pontos: somou a linha (4 + 2 + 1). Isso é o número de jogos, e os três times jogaram 7 vezes.
- E) o time C, com 17 pontos: a derrota foi contada como 1 ponto (15 + 2). Pela regra, a derrota vale 0.

```realidade
Pense numa tabela que você usa ou vê com frequência: as horas trabalhadas por dia da semana, os gastos da casa por mês, a classificação do time do bairro. Quais são as linhas e as colunas? Escolha um elemento e diga o que ele quer dizer, pelo endereço dele.
```

## Resumo

- Matriz é uma tabela de números; o tipo m × n diz as linhas e as colunas, nessa ordem.
- aᵢⱼ é o elemento da linha i e da coluna j.
- Somar: junte os elementos do mesmo lugar. Multiplicar por número: multiplique todos.
- Produto: linha da primeira com coluna da segunda; multiplique os pares e some.
- O produto só existe se as colunas da primeira forem tantas quanto as linhas da segunda, e a ordem importa.

## Para aprofundar

- [Matrizes e sistemas lineares](/trilhas/matematica-medio/matrizes-e-sistemas-lineares)
- [Álgebra linear: vetores e matrizes](/trilhas/matematica-superior/algebra-linear-vetores-e-matrizes)
- [Leitura de gráficos e tabelas](/trilhas/matematica-fundamental/leitura-de-graficos-e-tabelas)
- [Função e leitura de gráficos](/trilhas/enem-matematica-funcoes-e-algebra/funcoes-e-graficos)
