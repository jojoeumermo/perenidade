---
titulo: "Função quadrática: vértice, máximo e mínimo"
resumo: "A parábola do jeito que o ENEM cobra: raízes, vértice e o problema de achar o maior lucro, a maior área ou a maior altura."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Matriz de Referência do Enem"
    autor: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (Inep)"
  - titulo: "Algebra and Trigonometry 2e, seção 5.1, Quadratic Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/5-1-quadratic-functions"
  - titulo: "Algebra and Trigonometry 2e, seção 2.5, Quadratic Equations"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/2-5-quadratic-equations"
quiz:
  - pergunta: "O gráfico de f(x) = −3x² + 12x − 5 é uma parábola que:"
    opcoes: ["abre para cima e tem um ponto de mínimo", "é uma reta, porque o maior expoente é 2", "abre para baixo e tem um ponto de máximo", "abre para cima, porque o 12 é positivo"]
    resposta: 2
    explicacao: "Quem decide a abertura é o número que acompanha o x², o a. Aqui a = −3, negativo: a parábola abre para baixo, como um morro, e o ponto mais alto é o máximo."
  - pergunta: "Qual é o x do vértice de f(x) = x² − 8x + 7?"
    opcoes: ["4", "−4", "8", "7"]
    resposta: 0
    explicacao: "x do vértice = −b ÷ (2a) = −(−8) ÷ (2 × 1) = 8 ÷ 2 = 4. Quem marca 8 esqueceu de dividir por 2a."
  - pergunta: "Quais são as raízes de x² − 7x + 10 = 0?"
    opcoes: ["−2 e −5", "1 e 10", "7 e 10", "2 e 5"]
    resposta: 3
    explicacao: "Δ = 49 − 40 = 9 e √9 = 3. x = (7 ± 3) ÷ 2, isto é, 5 ou 2. Confira pela soma e pelo produto: 2 + 5 = 7 e 2 × 5 = 10."
  - pergunta: "Uma bola é lançada para cima e sua altura, em metros, é h(t) = −5t² + 20t, com t em segundos. Qual é a altura máxima?"
    opcoes: ["2 m", "20 m", "40 m", "4 m"]
    resposta: 1
    explicacao: "O tempo do vértice é t = −20 ÷ (2 × (−5)) = 2 s. A altura nesse instante é −5 × 4 + 20 × 2 = −20 + 40 = 20 m. Quem marca 2 m deu o tempo, não a altura."
---

```provocacao
Uma vendedora de marmitas cobra R$ 10 e vende 60 por dia. Ela percebeu que, a cada real a mais no preço, vende 4 marmitas a menos. Se subir o preço, ganha mais por marmita, mas vende menos. Existe um preço que deixa mais dinheiro no caixa no fim do dia?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer uma função quadrática pela lei e pelo gráfico, achar as raízes e o vértice, e resolver os problemas de máximo e mínimo que o ENEM mais cobra: o maior lucro, a maior área, a maior altura.

## Quando a mudança muda

Na função afim, a cada passo em x o valor muda sempre o mesmo tanto. Em muita coisa da vida não é assim. Uma bola chutada para cima sobe rápido, sobe cada vez mais devagar, para no alto e desce. A receita da vendedora sobe quando o preço aumenta um pouco, mas cai quando o preço exagera.

Para descrever esse sobe e desce existe a **função quadrática**, também chamada de função do 2º grau:

```formula
f(x) = ax² + bx + c,  com a ≠ 0
o valor da função é a vezes x ao quadrado, mais b vezes x, mais c
a, b e c são números fixos; o a não pode ser zero, senão o x² some e a função vira afim
```

O gráfico é uma curva chamada **parábola**. Três leituras rápidas valem ouro na prova:

- **a positivo:** a parábola abre para cima, como uma tigela. Ela tem um ponto mais baixo, o **mínimo**.
- **a negativo:** abre para baixo, como um morro. Tem um ponto mais alto, o **máximo**.
- **c:** é onde a curva corta o eixo vertical, porque f(0) = c.

## Uma parábola em tabela

Veja f(x) = x² − 6x + 8, calculada ponto a ponto:

| x | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| f(x) | 8 | 3 | 0 | −1 | 0 | 3 | 8 |

Em palavras: a curva começa em 8 quando x = 0, desce, toca o eixo horizontal em x = 2, chega ao ponto mais baixo em x = 3 (valor −1), sobe de novo, toca o eixo em x = 4 e volta a 8 em x = 6. Repare na **simetria**: os valores se repetem como num espelho em volta de x = 3. Isso vale para toda parábola, e é a chave do vértice.

## As raízes

As **raízes** (ou zeros) são os valores de x que fazem a função dar zero. No gráfico, são os pontos em que a parábola corta o eixo horizontal. Para achá-las, resolve-se ax² + bx + c = 0.

Primeiro calcula-se o **discriminante**, que se escreve com a letra grega delta (Δ):

```formula
Δ = b² − 4ac        x = (−b ± √Δ) ÷ (2a)
delta é b ao quadrado menos quatro vezes a vezes c
as raízes são menos b, mais ou menos a raiz de delta, divididos por duas vezes a
Δ positivo: duas raízes; Δ igual a zero: uma raiz; Δ negativo: nenhuma raiz real (a curva não toca o eixo)
```

No exemplo da tabela, a = 1, b = −6 e c = 8. Então Δ = 36 − 32 = 4 e √4 = 2. As raízes são (6 + 2) ÷ 2 = 4 e (6 − 2) ÷ 2 = 2. Batem com a tabela.

Um atalho para conferir: quando a = 1, a soma das raízes é −b e o produto é c. Aqui, 2 + 4 = 6 e 2 × 4 = 8.

## Montar a lei pelas raízes

Às vezes a questão mostra o gráfico e pede a lei. Se você sabe onde a parábola corta o eixo horizontal, use a forma fatorada: f(x) = a(x − x₁)(x − x₂), em que x₁ e x₂ são as raízes. Falta só o a. Para achá-lo, use mais um ponto do gráfico, de preferência o corte no eixo vertical.

Exemplo: raízes 2 e 4, e a curva passa por (0, 8). Então f(0) = a(0 − 2)(0 − 4) = 8a = 8, e a = 1. A lei é f(x) = (x − 2)(x − 4), que, multiplicada, dá x² − 6x + 8: a mesma da tabela.

## O vértice: o ponto que a prova quer

O **vértice** é o ponto de virada da parábola: o mínimo, se ela abre para cima; o máximo, se abre para baixo. Pela simetria, ele fica bem no meio das raízes. No exemplo, o meio de 2 e 4 é 3.

```formula
xᵥ = −b ÷ (2a)        yᵥ = f(xᵥ)
o x do vértice é menos b dividido por duas vezes a
o y do vértice é o valor da função nesse x; também dá para usar yᵥ = −Δ ÷ (4a)
```

No exemplo: xᵥ = 6 ÷ 2 = 3 e yᵥ = 9 − 18 + 8 = −1. Pela outra fórmula, −4 ÷ 4 = −1. As duas batem.

Atenção ao que a pergunta pede. "Quantas unidades dão o maior lucro" pede o **x** do vértice. "Qual é o maior lucro" pede o **y**. A prova costuma pôr os dois entre as alternativas.

```verificar
A parábola de f(x) = x² − 4x + 3 corta o eixo vertical em qual valor?
- 1
+ 3
- −4
> No eixo vertical, x vale zero. f(0) = 0 − 0 + 3 = 3: é sempre o c.
```

```navidareal
Um coletivo tem 40 metros de tela para cercar uma horta encostada no muro da escola. O muro faz um dos lados, então a tela cobre só três: dois lados de x metros e um de 40 − 2x metros.

A área é A(x) = x · (40 − 2x) = −2x² + 40x. O a é negativo: há um máximo. O vértice fica em x = −40 ÷ (2 × (−2)) = 10. A horta de maior área tem 10 m por 20 m, com 200 m². Um lado de 8 m daria 8 × 24 = 192 m²; um de 12 m, 12 × 16 = 192 m². A conta mostra que o melhor fica no meio.
```

## Exemplo resolvido

**Volte à vendedora da provocação. Que preço dá a maior receita por dia?**

1. Chame de x o número de reais de aumento. O preço passa a 10 + x e a venda cai para 60 − 4x marmitas.
2. Receita é preço vezes quantidade: R(x) = (10 + x)(60 − 4x).
3. Multiplique: 600 − 40x + 60x − 4x² = −4x² + 20x + 600. Aqui a = −4, b = 20 e c = 600.
4. O a é negativo: há um máximo. O vértice está em x = −20 ÷ (2 × (−4)) = −20 ÷ (−8) = 2,5.
5. O preço é 10 + 2,5 = R$ 12,50. A venda é 60 − 4 × 2,5 = 50 marmitas. A receita é 12,50 × 50 = R$ 625,00.

Confira com uma tabela:

| aumento (R$) | preço (R$) | marmitas | receita (R$) |
| --- | --- | --- | --- |
| 0 | 10,00 | 60 | 600,00 |
| 2 | 12,00 | 52 | 624,00 |
| 2,5 | 12,50 | 50 | 625,00 |
| 3 | 13,00 | 48 | 624,00 |
| 5 | 15,00 | 40 | 600,00 |

Os valores sobem até R$ 12,50 e depois descem, simétricos. É o máximo. Lembre que receita não é lucro: para o lucro, tire o custo das marmitas.

## Como isso cai no ENEM

- **Formatos:** o lucro ou a receita que depende do preço, a altura de um objeto lançado, a maior área com uma quantidade fixa de cerca, um arco de ponte ou de portão desenhado no plano cartesiano. Às vezes a lei vem pronta; às vezes é preciso montá-la a partir do texto, de uma tabela ou do gráfico.
- **Habilidades:** H21 (resolver problemas cuja modelagem pede álgebra), H20 (interpretar gráficos cartesianos que relacionam grandezas), H19 (identificar a expressão algébrica que traduz a relação entre grandezas) e H23 (avaliar propostas de intervenção usando álgebra). Nas provas de 2022 e 2023, classificadas pelo instituto, a função quadrática foi o tópico de 3 das 81 questões de Matemática (3,7%). Na área inteira, a H21 apareceu em 7 dessas 81 questões, a H20 em 5 e a H19 em 2. São só duas provas: é tendência, não promessa.
- **Armadilhas:**
  - Responder o x do vértice quando a pergunta pede o valor máximo (o y), ou o contrário.
  - Errar o sinal: em −b ÷ (2a), se b já é negativo, −b fica positivo.
  - Esquecer o 2 do denominador e fazer −b ÷ a.
  - Confundir receita com lucro.
  - Achar o máximo de uma parábola que abre para cima. Olhe o sinal do a antes de tudo.

## Questão comentada

**Texto-base.** Uma cooperativa de costureiras produz bolsas de tecido. Ela estimou que o lucro mensal L, em reais, ao produzir e vender x bolsas por mês, é dado por L(x) = −2x² + 160x − 1.400.

**Comando.** O lucro mensal máximo que a cooperativa pode obter, segundo essa estimativa, é

A) R$ 40,00.
B) R$ 3.200,00.
C) prejuízo de R$ 1.400,00.
D) R$ 1.800,00.
E) R$ 8.200,00.

**Resolução.**

1. O a vale −2, negativo: a parábola abre para baixo e tem máximo.
2. O vértice está em x = −160 ÷ (2 × (−2)) = −160 ÷ (−4) = 40 bolsas.
3. O lucro com 40 bolsas: L(40) = −2 × 1.600 + 160 × 40 − 1.400 = −3.200 + 6.400 − 1.400 = 1.800.
4. Conferência pela outra fórmula: Δ = 160² − 4 × (−2) × (−1.400) = 25.600 − 11.200 = 14.400. Então −Δ ÷ (4a) = −14.400 ÷ (−8) = 1.800.

**Gabarito: D.**

**Por que as outras não:**

- A) R$ 40,00: 40 é o número de bolsas do vértice, o x. A pergunta pede o lucro, o y. Substitua o 40 na lei.
- B) R$ 3.200,00: o custo fixo de R$ 1.400 ficou de fora (−3.200 + 6.400 = 3.200). Todos os termos da lei entram na conta.
- C) prejuízo de R$ 1.400,00: o vértice foi calculado como −b ÷ a = 80, sem o 2 do denominador. L(80) = −12.800 + 12.800 − 1.400 = −1.400.
- E) R$ 8.200,00: o sinal do −2 se perdeu (+3.200 + 6.400 − 1.400). O quadrado é de x, não do −2: −2 × 40² = −2 × 1.600 = −3.200.

```realidade
Pense num produto que você ou alguém da sua casa vende, ou num serviço que cobra. Se o preço subir um pouco, quantos clientes você acha que perderia? Monte uma tabela com três preços e a receita de cada um. A receita sobe sempre, ou começa a cair em algum ponto?
```

## Resumo

- Função quadrática: f(x) = ax² + bx + c, com a ≠ 0. O gráfico é uma parábola.
- a positivo, abre para cima e tem mínimo; a negativo, abre para baixo e tem máximo. O c é onde a curva corta o eixo vertical.
- Raízes: Δ = b² − 4ac e x = (−b ± √Δ) ÷ (2a). Confira pela soma e pelo produto.
- Vértice: xᵥ = −b ÷ (2a) e yᵥ = f(xᵥ). Ele fica no meio das raízes.
- "Quanto produzir" pede o x do vértice; "qual o maior valor" pede o y.

## Para aprofundar

- [Função do 2º grau](/trilhas/matematica-medio/funcao-do-2-grau)
- [Funções: a ideia](/trilhas/matematica-medio/funcoes-a-ideia)
- [Função e leitura de gráficos](/trilhas/enem-matematica-funcoes-e-algebra/funcoes-e-graficos)
- [Função afim](/trilhas/enem-matematica-funcoes-e-algebra/funcao-afim)
- [Equações do 1º grau](/trilhas/matematica-fundamental/equacoes-do-1-grau)
