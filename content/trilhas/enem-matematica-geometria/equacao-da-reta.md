---
titulo: "Equação da reta, paralelismo e perpendicularidade"
resumo: "A reta no plano cartesiano como conta: inclinação, ponto de partida, reta por dois pontos, retas paralelas, perpendiculares e o ponto em que duas retas se cruzam."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Intermediate Algebra 2e, seção 3.2, Slope of a Line"
    autor: "Lynn Marecek, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/intermediate-algebra-2e/pages/3-2-slope-of-a-line"
  - titulo: "Intermediate Algebra 2e, seção 3.3, Find the Equation of a Line"
    autor: "Lynn Marecek, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/intermediate-algebra-2e/pages/3-3-find-the-equation-of-a-line"
  - titulo: "Algebra and Trigonometry 2e, seção 4.1, Linear Functions"
    autor: "Jay Abramson (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/4-1-linear-functions"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é o coeficiente angular (a inclinação) da reta que passa por (1, 3) e (3, 7)?"
    opcoes: ["2", "4", "1/2", "3"]
    resposta: 0
    explicacao: "Inclinação é quanto o y muda para cada 1 de x: (7 − 3) ÷ (3 − 1) = 4 ÷ 2 = 2. Quem marcou 1/2 dividiu ao contrário."
  - pergunta: "Em que ponto a reta y = 3x − 6 corta o eixo y?"
    opcoes: ["(0, 3)", "(2, 0)", "(0, −6)", "(−6, 0)"]
    resposta: 2
    explicacao: "No eixo y, x vale 0. Então y = 3 × 0 − 6 = −6. O ponto é (0, −6). O (2, 0) é onde ela corta o eixo x."
  - pergunta: "Qual destas retas é paralela a y = 2x + 1?"
    opcoes: ["y = −2x + 1", "y = 2x − 5", "y = x/2 + 1", "y = −x/2"]
    resposta: 1
    explicacao: "Retas paralelas têm a mesma inclinação. Só y = 2x − 5 tem o 2 na frente do x; ela corta o eixo y em outro ponto, então não é a mesma reta."
  - pergunta: "Uma reta perpendicular a y = 2x + 1 tem coeficiente angular igual a:"
    opcoes: ["2", "−2", "1/2", "−1/2"]
    resposta: 3
    explicacao: "Perpendiculares têm inclinações que, multiplicadas, dão −1. Inverta o 2 (fica 1/2) e troque o sinal: −1/2. Confira: 2 × (−1/2) = −1."
---

```provocacao
O táxi cobra um valor fixo quando você entra e mais um tanto por quilômetro. Se você desenhar num gráfico o preço da corrida contra a distância, que forma aparece? E o que, no desenho, mostra o valor fixo?
```

## O que você vai aprender

Ao fim desta aula você vai escrever a equação de uma reta a partir de dois pontos ou de uma situação do dia a dia, ler o que cada número dela quer dizer, reconhecer retas paralelas e perpendiculares e achar o ponto em que duas retas se cruzam.

## A reta como regra de conta

Volte ao táxi. Imagine uma bandeirada de R$ 6,00 e R$ 2,50 por quilômetro. Com 0 km, a corrida custa R$ 6,00. Com 1 km, R$ 8,50. Com 2 km, R$ 11,00. A cada quilômetro a mais, o preço sobe sempre o mesmo tanto: R$ 2,50.

Marque esses pares num plano cartesiano, com a distância no eixo x e o preço no eixo y. Os pontos (0; 6), (1; 8,5) e (2; 11) caem todos na mesma linha reta. Isso acontece sempre que uma grandeza cresce (ou diminui) a um passo constante.

A regra do táxi se escreve assim: y = 2,5x + 6. É a **equação reduzida da reta**.

```formula
y = m · x + n
m é o coeficiente angular: quanto o y muda quando o x aumenta 1 (a inclinação)
n é o coeficiente linear: o valor de y quando x é zero, o ponto em que a reta corta o eixo y
```

No táxi, m = 2,5 (o preço por quilômetro) e n = 6 (a bandeirada). No desenho, n é a altura em que a reta encosta no eixo y. E m diz se a reta sobe ou desce, e com que força:

- m positivo: a reta sobe da esquerda para a direita.
- m negativo: a reta desce. É o caso de uma caixa-d'água esvaziando.
- m = 0: a reta é deitada, horizontal. O y não muda.

## A inclinação a partir de dois pontos

Muitas vezes a prova dá dois pontos da reta, num gráfico ou num texto. A inclinação é a variação do y dividida pela variação do x.

```formula
m = (y₂ − y₁) ÷ (x₂ − x₁)
a inclinação é quanto o y andou dividido por quanto o x andou, entre os dois pontos
```

Faça as duas subtrações na mesma ordem: se começou pelo segundo ponto em cima, comece por ele embaixo também. Trocar a ordem só de um lado troca o sinal.

Depois de achar m, falta n. Ponha um dos pontos na equação e resolva. Exemplo: pontos (2, 1) e (4, 7). A inclinação é (7 − 1) ÷ (4 − 2) = 6 ÷ 2 = 3. A equação é y = 3x + n. Usando o ponto (2, 1): 1 = 3 × 2 + n, então n = 1 − 6 = −5. A reta é y = 3x − 5. Confira com o outro ponto: 3 × 4 − 5 = 7. Bateu.

```verificar
Uma reta passa por (0, 4) e (2, 10). Qual é a equação dela?
- y = 4x + 3
+ y = 3x + 4
- y = 6x + 4
> O ponto (0, 4) já dá n = 4, porque é o corte no eixo y. A inclinação é (10 − 4) ÷ (2 − 0) = 3.
```

## Paralelas e perpendiculares

Duas retas **paralelas** nunca se encontram. Para isso elas precisam ter a mesma inclinação: o mesmo m, com n diferente. As retas y = 2x + 1 e y = 2x − 5 são paralelas. Figura descrita em palavras: são dois trilhos inclinados, um 6 unidades abaixo do outro no eixo y.

Duas retas **perpendiculares** se cruzam formando um ângulo reto, como as linhas de um caderno quadriculado. A regra: as inclinações, multiplicadas, dão −1. Na prática, inverta a fração e troque o sinal. A perpendicular a uma reta de inclinação 2 tem inclinação −1/2. A perpendicular a uma de inclinação −3/4 tem inclinação 4/3.

```formula
paralelas: m₁ = m₂   ·   perpendiculares: m₁ · m₂ = −1
paralelas têm a mesma inclinação; perpendiculares têm inclinações inversas e de sinais contrários
```

Há uma exceção: as retas verticais, como x = 3, não têm inclinação definida (o x não anda, e não dá para dividir por zero). Uma reta vertical é perpendicular a qualquer reta horizontal.

## Onde duas retas se cruzam

O ponto de encontro de duas retas está nas duas ao mesmo tempo. Então o x e o y dele servem para as duas equações. Quando as duas estão na forma y = …, iguale os lados direitos.

Retas y = x + 1 e y = −x + 7. Igualando: x + 1 = −x + 7, então 2x = 6 e x = 3. Volte a qualquer uma: y = 3 + 1 = 4. O cruzamento é (3, 4).

Na vida real, o cruzamento costuma responder à pergunta "a partir de quando uma opção fica mais barata que a outra".

```navidareal
Contas de serviço costumam ter uma parte fixa e uma parte que cresce com o uso. Planos de telefone com franquia, fretes com taxa de saída e preço por quilômetro, aluguel de máquina com diária: em todos, o gráfico do custo é uma reta. Comparar dois planos é comparar duas retas. A mais baixa no gráfico é a mais barata naquele ponto, e o cruzamento mostra onde a escolha vira.
```

## Exemplo resolvido

**Duas locadoras alugam uma betoneira para uma obra de mutirão. A locadora A cobra R$ 10 de taxa e R$ 4 por hora. A locadora B cobra R$ 34 de taxa e R$ 2 por hora. Com quantas horas de uso as duas cobram o mesmo?**

1. Escreva as retas, com x em horas: A: y = 4x + 10. B: y = 2x + 34.
2. Iguale: 4x + 10 = 2x + 34.
3. Passe os x para um lado e os números para o outro: 4x − 2x = 34 − 10, ou seja, 2x = 24.
4. Divida: x = 24 ÷ 2 = 12 horas.
5. O preço nesse ponto: 4 × 12 + 10 = R$ 58. Na B: 2 × 12 + 34 = R$ 58. Bateu.

Leia o resultado: até 12 horas, a A é mais barata (começa mais baixo). Depois de 12 horas, a B é mais barata (sobe mais devagar).

## Como isso cai no ENEM

- **Formatos:** gráfico de uma reta com dois pontos marcados (custo, consumo, nível de reservatório), comparação de planos e tarifas, "a partir de quantos" algo compensa, retas no mapa de um bairro (ruas paralelas e perpendiculares), pontos alinhados.
- **Habilidades:** H19 (identificar a expressão algébrica que traduz a relação entre grandezas), H20 (interpretar gráficos cartesianos que relacionam grandezas) e H22 (usar álgebra e geometria para construir argumentos). Nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma questão foi classificada neste tópico específico; o objeto inteiro de conhecimentos algébricos e geométricos teve 4 das 81 questões de Matemática (4,9%). E a mesma ideia de reta aparece também nas questões de função afim. São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Dividir ao contrário: a inclinação é variação do y sobre variação do x.
  - Trocar a ordem das subtrações só em cima ou só embaixo, e errar o sinal.
  - Confundir o corte no eixo y (x = 0) com o corte no eixo x (y = 0).
  - Na perpendicular, só inverter ou só trocar o sinal. São as duas coisas.
  - Achar o x do cruzamento e esquecer de ler o que ele significa no problema.

## Questão comentada

**Texto-base.** Uma associação de agricultores vai contratar um frete para levar a produção à feira. A empresa A cobra R$ 20,00 de taxa de saída e R$ 3,00 por quilômetro rodado. A empresa B cobra R$ 50,00 de taxa de saída e R$ 1,50 por quilômetro rodado.

**Comando.** A empresa B passa a ser mais barata que a empresa A para viagens com mais de

A) 10 km.
B) 30 km.
C) nenhuma distância, porque B é sempre mais cara.
D) 20 km.
E) cerca de 6,7 km.

**Resolução.**

1. Custo na A: 3x + 20. Custo na B: 1,5x + 50, com x em quilômetros.
2. Os dois custos são iguais quando 3x + 20 = 1,5x + 50, ou seja, 1,5x = 30 e x = 20.
3. Depois disso, a A sobe R$ 3,00 por quilômetro e a B só R$ 1,50: a B fica mais barata.

**Gabarito: D.**

**Por que as outras não:**

- A) 10 km: a diferença das taxas de saída (30) foi dividida pelo preço por quilômetro da A (3). O que vence a diferença é quanto a A sobe a mais por quilômetro: 3 − 1,5 = 1,5.
- B) 30 km: 30 é a diferença das taxas de saída, em reais, não uma distância. Falta dividir por 1,5.
- C) Nenhuma distância: olhou só a taxa de saída. A reta da B começa mais alta, mas sobe mais devagar, e as duas se cruzam.
- E) Cerca de 6,7 km: os preços por quilômetro foram somados (3 + 1,5 = 4,5). Para comparar, subtraia: 3 − 1,5.

```realidade
Pegue uma conta da sua casa que tenha parte fixa e parte por uso (luz, água, telefone, gás, aluguel de algo). Escreva a regra como y = m · x + n. O que é o m e o que é o n na sua conta? Se existisse outro plano, com parte fixa menor e uso mais caro, a partir de quanto ele deixaria de compensar?
```

## Resumo

- Equação reduzida: y = m · x + n. O m é a inclinação (quanto y muda por 1 de x); o n é o corte no eixo y.
- Por dois pontos: m = (y₂ − y₁) ÷ (x₂ − x₁); depois ponha um ponto na equação para achar n.
- Paralelas: mesmo m. Perpendiculares: m₁ · m₂ = −1 (inverta e troque o sinal).
- Cruzamento: iguale as duas equações e resolva.
- No problema, o cruzamento diz onde uma opção passa a valer mais que a outra.

## Para aprofundar

- [Função afim](/trilhas/enem-matematica-funcoes-e-algebra/funcao-afim)
- [Função do 1º grau](/trilhas/matematica-medio/funcao-do-1-grau)
- [Equações do 1º grau](/trilhas/matematica-fundamental/equacoes-do-1-grau)
- [Plano cartesiano e distância entre pontos](/trilhas/enem-matematica-geometria/plano-cartesiano)
- [Matrizes e sistemas lineares](/trilhas/matematica-medio/matrizes-e-sistemas-lineares)
