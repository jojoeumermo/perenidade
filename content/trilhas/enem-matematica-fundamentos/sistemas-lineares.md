---
titulo: "Sistemas lineares"
resumo: "Duas incógnitas, duas informações: montar o sistema a partir do texto, resolver por substituição ou por adição e entender o que a solução quer dizer no gráfico."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Elementary Algebra 2e, seção 5.1, Solve Systems of Equations by Graphing"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/elementary-algebra-2e/pages/5-1-solve-systems-of-equations-by-graphing"
  - titulo: "Elementary Algebra 2e, seção 5.2, Solving Systems of Equations by Substitution"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/elementary-algebra-2e/pages/5-2-solving-systems-of-equations-by-substitution"
  - titulo: "Elementary Algebra 2e, seção 5.3, Solve Systems of Equations by Elimination"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/elementary-algebra-2e/pages/5-3-solve-systems-of-equations-by-elimination"
  - titulo: "Elementary Algebra 2e, seção 5.4, Solve Applications with Systems of Equations"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/elementary-algebra-2e/pages/5-4-solve-applications-with-systems-of-equations"
  - titulo: "Algebra and Trigonometry 2e, seção 11.1, Systems of Linear Equations: Two Variables"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/11-1-systems-of-linear-equations-two-variables"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é a solução do sistema x + y = 10 e x − y = 4?"
    opcoes: ["x = 3 e y = 7", "x = 7 e y = 3", "x = 5 e y = 5", "x = 14 e y = −4"]
    resposta: 1
    explicacao: "Some as duas equações: o y some e fica 2x = 14, então x = 7. Na primeira: 7 + y = 10, y = 3. Confira na segunda: 7 − 3 = 4."
  - pergunta: "Somando as equações 2x + y = 11 e 3x − y = 9, que equação aparece?"
    opcoes: ["5x + 2y = 20", "x = 2", "5x = 20", "6x = 99"]
    resposta: 2
    explicacao: "Some termo a termo: 2x + 3x = 5x; y + (−y) = 0; 11 + 9 = 20. Fica 5x = 20. O y some porque aparece com sinais opostos."
  - pergunta: "No sistema y = 2x e x + y = 15, quanto vale y?"
    opcoes: ["10", "5", "15", "30"]
    resposta: 0
    explicacao: "Troque o y por 2x na segunda equação: x + 2x = 15, 3x = 15, x = 5. Então y = 2 × 5 = 10. O 5 é o valor de x."
  - pergunta: "No plano cartesiano, a solução de um sistema de duas equações do 1º grau com duas incógnitas é"
    opcoes: ["a soma das inclinações das duas retas.", "o ponto onde uma das retas corta o eixo x.", "a origem do plano, o ponto (0, 0).", "o ponto em que as duas retas se cruzam."]
    resposta: 3
    explicacao: "Cada equação é uma reta. Um ponto que satisfaz as duas equações está nas duas retas ao mesmo tempo: é o cruzamento."
---

```provocacao
Num show beneficente, o ingresso inteiro custava R$ 20,00 e a meia-entrada, R$ 10,00. A organização sabe que vendeu 350 ingressos e arrecadou R$ 5.600,00, mas perdeu a lista de quantos eram meia. Dá para descobrir só com esses dois números?
```

## O que você vai aprender

Ao fim desta aula você vai montar um sistema de duas equações a partir do texto de uma questão, resolver pelo método da substituição e pelo método da adição, conferir a solução e entender o que ela significa no gráfico: o ponto em que duas retas se cruzam.

## Duas incógnitas, duas informações

Com uma incógnita, uma equação basta. Com duas, uma equação só não resolve. Se x + y = 350, x pode ser 100 e y 250, ou x 200 e y 150, e assim por diante. Há muitas respostas.

Para chegar a uma resposta só, é preciso uma segunda informação, que forme uma segunda equação. As duas juntas formam um **sistema**. Resolver o sistema é achar os valores de x e de y que satisfazem as duas equações ao mesmo tempo.

Na provocação, x são os ingressos inteiros e y as meias. A quantidade dá uma equação: x + y = 350. O dinheiro dá outra: 20x + 10y = 5.600. Juntas, elas têm uma solução só.

## Montar o sistema

O roteiro é o mesmo das equações, com um passo a mais:

1. **Nomeie as duas incógnitas.** Escreva o que cada letra quer dizer, com a unidade: "x = número de carros", "y = número de motos".
2. **Ache duas informações independentes.** Quase sempre uma é de **quantidade** (o total de coisas) e a outra é de **valor** (o total de dinheiro, de rodas, de pontos, de quilos).
3. **Escreva cada informação como uma equação.**
4. **Resolva e responda o que foi pedido.** Muitas vezes a questão pergunta só uma das duas incógnitas, ou uma conta feita com elas.

## Método da substituição

Isole uma das letras numa equação e troque-a na outra. É o melhor caminho quando uma letra já está sozinha ou quase.

No sistema y = 2x e x + y = 15, o y já está isolado. Troque y por 2x na segunda: x + 2x = 15. Isso dá 3x = 15, e x = 5. Volte para achar o y: y = 2 × 5 = 10.

Na provocação, isole o x na primeira: x = 350 − y. Troque na segunda: 20(350 − y) + 10y = 5.600. Distribua: 7.000 − 20y + 10y = 5.600. Junte: 7.000 − 10y = 5.600, então 10y = 1.400 e y = 140. Foram 140 meias.

## Método da adição

Some (ou subtraia) as duas equações, termo a termo, para fazer uma letra sumir. Funciona de primeira quando uma letra aparece com números opostos, como +y e −y.

```formula
{ x + y = 10
{ x − y = 4      →   somando: 2x = 14
some as equações termo a termo: as letras com sinais opostos se anulam
se nenhuma letra se anula, multiplique uma equação inteira por um número antes de somar
```

Quando nenhuma letra se anula de primeira, prepare as equações. Em 2x + y = 11 e x + 3y = 13, multiplique a primeira inteira por −3: −6x − 3y = −33. Agora some com a segunda: −5x = −20, x = 4. Volte: 2 × 4 + y = 11, y = 3. A regra é multiplicar **todos** os termos da equação, inclusive o do lado direito.

Qualquer que seja o método, **confira nas duas equações**. Uma solução que só serve numa delas está errada.

## O que a solução quer dizer no gráfico

Cada equação do 1º grau com duas incógnitas é uma reta no plano cartesiano. Os pontos da reta são os pares (x, y) que satisfazem aquela equação. A solução do sistema, que satisfaz as duas, é o ponto que está nas duas retas: **o cruzamento**.

Isso explica os três casos possíveis:

- **As retas se cruzam num ponto:** uma solução só. É o caso das questões do dia a dia.
- **As retas são paralelas:** nunca se cruzam, e o sistema não tem solução. Acontece quando as informações se contradizem, como x + y = 6 e 2x + 2y = 20 (o dobro de 6 é 12, e não 20).
- **As retas são a mesma:** infinitas soluções. Acontece quando a segunda informação é só a primeira repetida, como x + y = 6 e 2x + 2y = 12.

```navidareal
Sistemas aparecem toda vez que duas coisas se misturam num total. Imagine uma banca de feira que vende dúzias de ovos e quilos de tomate e, no fim do dia, só anotou "vendi 40 itens e recebi R$ 380,00". Com os preços de cada item, um sistema diz quanto saiu de cada um, sem precisar de nota por nota.

Esse tipo de conta ajuda a saber o que dá mais retorno e o que vale a pena trazer na semana seguinte. É matemática de quem vive do próprio trabalho.
```

```verificar
Um sistema em que as duas retas são paralelas, sem nenhum ponto em comum, tem:
+ nenhuma solução.
- uma solução.
- infinitas soluções.
> A solução é o ponto que está nas duas retas. Se elas nunca se encontram, não há ponto comum.
```

## Exemplo resolvido

**Numa lanchonete, 2 salgados e 1 suco custam R$ 13,00. Um salgado e 2 sucos custam R$ 11,00. Quanto custa cada coisa?**

1. Nomeie: s = preço do salgado; j = preço do suco.
2. Sistema: 2s + j = 13 e s + 2j = 11.
3. Isole j na primeira: j = 13 − 2s.
4. Troque na segunda: s + 2(13 − 2s) = 11. Distribua: s + 26 − 4s = 11. Junte: −3s = −15, então s = 5.
5. Volte: j = 13 − 2 × 5 = 3.
6. O salgado custa R$ 5,00 e o suco, R$ 3,00.

Confira nas duas: 2 × 5 + 3 = 13 e 5 + 2 × 3 = 11. Um atalho para conferir: somando as duas equações, 3s + 3j = 24, então s + j = 8. E 5 + 3 = 8.

## Como isso cai no ENEM

- **Formatos:** ingressos inteiros e meias, carros e motos num estacionamento (veículos e rodas), misturas de dois produtos com preços diferentes, pontos de questões certas e erradas, compras de dois itens em quantidades diferentes. Às vezes a questão traz o gráfico de duas retas e pede o ponto de encontro.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, sistemas lineares tiveram 2 das 81 questões classificadas de Matemática (2,5%). O objeto de que fazem parte, conhecimentos algébricos/geométricos, teve 4 (4,9%). São só duas edições: é tendência, não promessa.
- **Habilidades:** H21 (resolver problemas cuja modelagem pede álgebra), com 7 das 81 questões nessa base, e H19 (identificar a expressão algébrica que traduz a relação entre grandezas), com 2, quando a questão pede o sistema que representa a situação.
- **Armadilhas:**
  - Responder a incógnita errada (os carros, quando a questão pergunta as motos).
  - Multiplicar só um lado da equação antes de somar.
  - Errar o sinal ao distribuir na substituição: 20(350 − y) = 7.000 − 20y.
  - Conferir só numa equação.
  - Tentar resolver com uma equação só, chutando valores.

## Questão comentada

**Texto-base.** Num show beneficente para a reforma de uma biblioteca comunitária, o ingresso inteiro custava R$ 20,00 e a meia-entrada, R$ 10,00. Foram vendidos 350 ingressos, e a arrecadação foi de R$ 5.600,00.

**Comando.** O número de meias-entradas vendidas foi

A) 210.
B) 175.
C) 280.
D) 140.
E) 560.

**Resolução.**

1. Nomeie: x = inteiras; y = meias.
2. Sistema: x + y = 350 e 20x + 10y = 5.600.
3. Divida a segunda por 10 para simplificar: 2x + y = 560.
4. Subtraia a primeira dessa: (2x + y) − (x + y) = 560 − 350, então x = 210.
5. Volte: 210 + y = 350, y = 140.
6. Confira: 210 × 20 = 4.200 e 140 × 10 = 1.400; 4.200 + 1.400 = 5.600.

**Gabarito: D.**

**Por que as outras não:**

- A) 210: é o número de ingressos inteiros, o x. A pergunta é sobre as meias, o y.
- B) 175: os ingressos foram divididos meio a meio. A arrecadação mostra que não foi assim: 175 × 20 + 175 × 10 = 5.250, e não 5.600.
- C) 280: a arrecadação foi dividida pelo preço da inteira (5.600 ÷ 20), como se todos fossem inteiros. É preciso usar as duas informações juntas.
- E) 560: a arrecadação foi dividida pelo preço da meia (5.600 ÷ 10). Isso dá mais ingressos do que os 350 vendidos.

```realidade
Pense numa compra recente em que você levou dois tipos de produto e lembra só o total pago e a quantidade de itens. Se souber o preço de um deles, monte o sistema e descubra quantos levou de cada. Se não lembrar, invente com alguém da casa um desafio assim e troquem as respostas.
```

## Resumo

- Duas incógnitas pedem duas equações: uma de quantidade e uma de valor, quase sempre.
- Substituição: isole uma letra numa equação e troque na outra.
- Adição: some as equações para anular uma letra; se precisar, multiplique uma equação inteira antes.
- Confira a solução nas duas equações.
- No gráfico, a solução é o cruzamento das retas. Paralelas: sem solução. A mesma reta: infinitas.
- Responda a incógnita que a questão pediu.

## Para aprofundar

- [Matrizes e sistemas lineares](/trilhas/matematica-medio/matrizes-e-sistemas-lineares)
- [Equações do 1º grau](/trilhas/enem-matematica-fundamentos/equacoes-do-1-grau)
- [Função afim](/trilhas/enem-matematica-funcoes-e-algebra/funcao-afim)
- [Função e leitura de gráficos](/trilhas/enem-matematica-funcoes-e-algebra/funcoes-e-graficos)
