---
titulo: "Progressões aritméticas e geométricas"
resumo: "Sequências que somam sempre o mesmo número (PA) ou multiplicam sempre pelo mesmo número (PG): termo geral, soma e o jeito de reconhecer cada uma na prova."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Matriz de Referência do Enem"
    autor: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (Inep)"
  - titulo: "Algebra and Trigonometry 2e, seção 13.2, Arithmetic Sequences"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/13-2-arithmetic-sequences"
  - titulo: "Algebra and Trigonometry 2e, seção 13.3, Geometric Sequences"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/13-3-geometric-sequences"
  - titulo: "Algebra and Trigonometry 2e, seção 13.4, Series and Their Notations"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/13-4-series-and-their-notations"
quiz:
  - pergunta: "Na sequência 7, 11, 15, 19, …, qual é o 10º termo?"
    opcoes: ["47", "40", "39", "43"]
    resposta: 3
    explicacao: "É uma PA de razão 4. Do 1º ao 10º termo há 9 saltos: 7 + 9 × 4 = 7 + 36 = 43. Quem marca 47 contou 10 saltos."
  - pergunta: "A sequência 3, 6, 12, 24, … é:"
    opcoes: ["uma PA de razão 3", "uma PG de razão 2", "uma PG de razão 3", "nem PA nem PG"]
    resposta: 1
    explicacao: "As diferenças são 3, 6 e 12: não são iguais, então não é PA. Os quocientes são 6 ÷ 3 = 2, 12 ÷ 6 = 2 e 24 ÷ 12 = 2: é uma PG de razão 2."
  - pergunta: "Qual é a soma dos 10 primeiros termos da sequência 2, 4, 6, 8, …?"
    opcoes: ["20", "100", "110", "220"]
    resposta: 2
    explicacao: "O 10º termo é 2 + 9 × 2 = 20. A soma é (2 + 20) × 10 ÷ 2 = 22 × 5 = 110. Quem marca 220 esqueceu de dividir por 2."
  - pergunta: "Uma bactéria se divide em duas a cada hora. Começando com uma bactéria, quantas haverá depois de 5 horas?"
    opcoes: ["32", "10", "16", "25"]
    resposta: 0
    explicacao: "A cada hora o número dobra: 1, 2, 4, 8, 16, 32. Depois de 5 horas, 2⁵ = 32. Quem marca 10 somou 2 por hora, como numa PA."
---

```provocacao
No mercado, as latas de óleo estão empilhadas em forma de triângulo: 1 lata no topo, 2 na fileira de baixo, 3 na seguinte, e assim por diante. A pilha tem 20 fileiras. Dá para saber quantas latas há sem contar uma por uma?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer uma progressão aritmética (PA) e uma progressão geométrica (PG), achar qualquer termo sem escrever a lista inteira, somar os termos e descobrir o padrão de sequências que não são nem uma coisa nem outra.

## Sequências com padrão

Uma **sequência** é uma lista de números em ordem: o 1º termo, o 2º, o 3º. Escreve-se a₁ para o primeiro, a₂ para o segundo e aₙ para o termo de ordem n (o "enésimo").

Muita coisa da vida vira sequência. As parcelas de um carnê. O número de peças feitas por dia numa oficina. A população de uma cidade ano a ano. O ENEM gosta de sequências porque elas cobram a habilidade de **enxergar um padrão** e usá-lo para prever.

Duas perguntas resolvem quase tudo:

1. A **diferença** entre um termo e o anterior é sempre a mesma? Então é uma PA.
2. O **quociente** (a divisão) entre um termo e o anterior é sempre o mesmo? Então é uma PG.

## Progressão aritmética: somar sempre o mesmo

Numa **PA**, cada termo é o anterior mais um número fixo, a **razão** (r). Em 7, 11, 15, 19, a razão é 4. Em 12, 9, 6, 3, a razão é −3: a sequência desce.

Para chegar ao 10º termo, você não precisa escrever os dez. Do 1º ao 10º termo há 9 saltos de tamanho r.

```formula
aₙ = a₁ + (n − 1) · r
o termo de ordem n é o primeiro termo mais n menos um razões
são n − 1 saltos porque o primeiro termo já está lá, sem salto nenhum
```

Exemplo: uma costureira fez 12 peças no 1º dia e passou a fazer 3 a mais a cada dia. No 8º dia ela fez 12 + 7 × 3 = 12 + 21 = 33 peças.

Uma PA é uma função afim olhada só nos números inteiros. Em tabela:

| dia (n) | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| peças (aₙ) | 12 | 15 | 18 | 21 | 24 |

No gráfico, esses pontos ficam todos numa mesma reta que sobe 3 a cada dia.

## A soma de uma PA

Para somar os termos de uma PA, há um truque. Some o primeiro com o último, o segundo com o penúltimo, e assim por diante: todos os pares dão o mesmo resultado. Em 1 + 2 + … + 10, os pares 1 + 10, 2 + 9, 3 + 8 dão todos 11. São 5 pares: a soma é 55.

```formula
Sₙ = (a₁ + aₙ) · n ÷ 2
a soma dos n primeiros termos é o primeiro mais o último, vezes a quantidade de termos, dividido por dois
divide-se por dois porque cada par junta dois termos
```

```verificar
Na PA 5, 9, 13, 17, …, qual é a razão?
- 5
+ 4
- 9
> A razão é a diferença entre um termo e o anterior: 9 − 5 = 4. Confira: 13 − 9 = 4.
```

## Progressão geométrica: multiplicar sempre pelo mesmo

Numa **PG**, cada termo é o anterior vezes um número fixo, a **razão** (q). Em 3, 6, 12, 24, a razão é 2. Em 80, 40, 20, 10, a razão é 1/2: a sequência cai pela metade.

```formula
aₙ = a₁ · qⁿ⁻¹
o termo de ordem n é o primeiro termo vezes a razão elevada a n menos um
de novo, são n − 1 multiplicações a partir do primeiro
```

Exemplo: uma mensagem é mandada por uma pessoa a 3 amigos; cada um repassa a 3 pessoas novas, e assim por diante. Na 1ª rodada recebem 3 pessoas; na 2ª, 9; na 3ª, 27. Na 6ª rodada, 3 · 3⁵ = 3⁶ = 729 pessoas.

Em tabela:

| rodada (n) | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| pessoas (aₙ) | 3 | 9 | 27 | 81 | 243 | 729 |

Em palavras: os primeiros termos parecem pequenos, mas cada um é o triplo do anterior. No gráfico, os pontos sobem devagar no começo e depois disparam. Esse é o desenho do crescimento exponencial, assunto da aula de função exponencial.

A soma dos n primeiros termos de uma PG, quando q ≠ 1, é Sₙ = a₁ · (qⁿ − 1) ÷ (q − 1). Na mensagem, até a 4ª rodada: 3 · (81 − 1) ÷ 2 = 3 × 40 = 120 pessoas. Confira somando: 3 + 9 + 27 + 81 = 120.

Os juros compostos são uma PG: a dívida ou a aplicação é multiplicada pelo mesmo fator a cada mês.

## Quando não é PA nem PG

Nem toda sequência da prova tem nome. Às vezes, são as **diferenças** que seguem um padrão. Em 3, 4, 7, 12, 19, as diferenças são 1, 3, 5 e 7: crescem de 2 em 2. A próxima diferença é 9, e o próximo termo é 19 + 9 = 28.

Outras vezes o padrão está numa figura: quadradinhos, palitos, bolinhas. Conte os primeiros casos, ponha numa tabela e só então procure a regra.

```navidareal
Pense num carnê de loja com parcelas fixas: é uma PA de razão zero, todas iguais. Agora pense numa dívida no cartão de crédito que não é paga: os juros incidem sobre a dívida já aumentada, e ela cresce como uma PG.

A diferença entre somar sempre o mesmo e multiplicar sempre pelo mesmo é a diferença entre uma dívida que cresce em linha reta e uma que dispara. Saber reconhecer qual é qual ajuda a decidir o que pagar primeiro.
```

## Exemplo resolvido

**Volte à pilha de latas da provocação: 1 lata no topo, 2 na fileira seguinte, e assim até a 20ª fileira. Quantas latas há?**

1. As fileiras formam uma PA: 1, 2, 3, …, com razão 1.
2. A 20ª fileira tem a₂₀ = 1 + 19 × 1 = 20 latas.
3. A soma é S₂₀ = (1 + 20) × 20 ÷ 2 = 21 × 10 = 210 latas.

Confira com um caso pequeno: com 4 fileiras, a fórmula dá (1 + 4) × 4 ÷ 2 = 10, e contando 1 + 2 + 3 + 4 também dá 10.

## Como isso cai no ENEM

- **Formatos:** figuras que crescem por etapas (palitos, quadradinhos), economias ou produções que aumentam o mesmo tanto a cada mês, pilhas e arquibancadas, contaminação ou divulgação que multiplica, valor de um bem que perde uma porcentagem por ano. A pergunta pede um termo distante, a soma de vários termos ou a etapa em que um valor é atingido.
- **Habilidades:** H2 (identificar padrões numéricos ou princípios de contagem) e H3 (resolver problemas com conhecimentos numéricos). Nas provas de 2022 e 2023, classificadas pelo instituto, as progressões foram o tópico de 3 das 81 questões de Matemática (3,7%). Na área inteira, a H2 apareceu em 6 dessas 81 questões, somando progressões e contagem, e a H3 em 12. São só duas provas: é tendência, não promessa.
- **Armadilhas:**
  - Contar n saltos em vez de n − 1 no termo geral.
  - Esquecer de dividir por 2 na soma da PA.
  - Responder o último termo quando a pergunta pede a soma, ou o contrário.
  - Tratar como PA uma sequência que multiplica (PG), ou o contrário. Teste a diferença e o quociente.
  - Achar uma regra olhando só os dois primeiros termos. Confira com o terceiro e o quarto.

## Questão comentada

**Texto-base.** Uma cozinha comunitária organizou uma campanha de doação de cestas básicas. Na primeira semana, arrecadou 30 cestas. Em cada semana seguinte, arrecadou 6 cestas a mais do que na semana anterior. A campanha durou 10 semanas.

**Comando.** O total de cestas arrecadadas nas 10 semanas foi

A) 84.
B) 600.
C) 570.
D) 1.140.
E) 840.

**Resolução.**

1. As arrecadações formam uma PA com a₁ = 30 e r = 6.
2. Na 10ª semana: a₁₀ = 30 + 9 × 6 = 30 + 54 = 84 cestas.
3. O total é a soma: S₁₀ = (30 + 84) × 10 ÷ 2 = 114 × 5 = 570 cestas.

**Gabarito: C.**

**Por que as outras não:**

- A) 84: é o que entrou só na 10ª semana. A pergunta pede o total das 10 semanas.
- B) 600: foram contados 10 saltos de 6 (a₁₀ = 30 + 60 = 90), e (30 + 90) × 10 ÷ 2 = 600. Do 1º ao 10º termo são 9 saltos.
- D) 1.140: faltou dividir por 2 na soma: 114 × 10 = 1.140. Cada par (primeiro mais último) junta duas semanas.
- E) 840: o último termo foi multiplicado pelo número de semanas (84 × 10), como se todas as semanas tivessem arrecadado 84.

```realidade
Pense numa quantia que você paga ou guarda todo mês. Se ela aumentasse R$ 10 por mês, quanto daria em um ano? E se aumentasse 10% por mês? Faça as duas contas para os quatro primeiros meses e compare.
```

## Resumo

- PA: soma-se sempre a razão r. Termo geral: aₙ = a₁ + (n − 1) · r.
- Soma da PA: Sₙ = (a₁ + aₙ) · n ÷ 2.
- PG: multiplica-se sempre pela razão q. Termo geral: aₙ = a₁ · qⁿ⁻¹.
- Soma da PG (q ≠ 1): Sₙ = a₁ · (qⁿ − 1) ÷ (q − 1).
- Diferença constante, PA; quociente constante, PG. Se nenhum dos dois, olhe as diferenças das diferenças.
- PA tem gráfico de reta, como a função afim; PG cresce como a exponencial.

## Para aprofundar

- [Progressões aritméticas e geométricas](/trilhas/matematica-medio/progressoes-aritmeticas-e-geometricas)
- [Juros simples e compostos](/trilhas/matematica-medio/juros-simples-e-compostos)
- [Potências e raízes](/trilhas/matematica-fundamental/potencias-e-raizes)
- [Função afim](/trilhas/enem-matematica-funcoes-e-algebra/funcao-afim)
- [Função exponencial](/trilhas/enem-matematica-funcoes-e-algebra/funcao-exponencial)
