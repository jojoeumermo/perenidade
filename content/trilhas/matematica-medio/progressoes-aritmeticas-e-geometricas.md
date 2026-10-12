---
titulo: "Progressões aritméticas e geométricas"
resumo: "Sequências que andam somando e sequências que andam multiplicando, e como somar muitos termos de uma vez."
autores: ["Instituto Lúcia"]
fontes:
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
  - titulo: "Ensaio sobre o princípio da população"
    autor: "Thomas Malthus"
    ano: "1798"
quiz:
  - pergunta: "Na progressão aritmética 4, 9, 14, 19..., qual é o 20º termo?"
    opcoes: ["99", "104", "100"]
    resposta: 0
    explicacao: "A razão é 5. O 20º termo é 4 + 19 × 5 = 99. São 19 passos, não 20."
  - pergunta: "Quanto é 1 + 2 + 3 + ... + 100?"
    opcoes: ["5.000", "5.050", "10.100"]
    resposta: 1
    explicacao: "São 50 pares que somam 101 cada: 50 × 101 = 5.050."
  - pergunta: "Na progressão geométrica 3, 6, 12, 24..., qual é a razão?"
    opcoes: ["3", "2", "6"]
    resposta: 1
    explicacao: "Cada termo é o anterior multiplicado por 2."
---

## Sequências com regra

Uma **sequência** é uma lista ordenada de números. As mais úteis são as que seguem uma regra fixa de um termo para o seguinte. Costuma-se chamar o primeiro termo de a₁, o segundo de a₂, e um termo qualquer, na posição n, de aₙ.

Duas regras dão conta de boa parte dos problemas práticos: **somar** sempre o mesmo número ou **multiplicar** sempre pelo mesmo número.

## Progressão aritmética (PA)

Cada termo é o anterior **mais** um número fixo, a **razão** (r).

- 4, 9, 14, 19, 24... (razão 5)
- 100, 90, 80, 70... (razão −10)

Para chegar ao termo de posição n, parte-se do primeiro e dão-se n − 1 passos:

**aₙ = a₁ + (n − 1) × r**

Na primeira sequência, o 20º termo é 4 + 19 × 5 = 99. O erro comum é multiplicar por 20: do 1º ao 20º termo há 19 passos.

### A soma dos termos

Conta-se que o matemático alemão Gauss, ainda menino, recebeu do professor a tarefa de somar os números de 1 a 100 e respondeu quase na hora. A ideia: juntar o primeiro com o último, o segundo com o penúltimo, e assim por diante.

```conta
1 + 100 = 101
2 + 99 = 101
3 + 98 = 101 ...
= são 50 pares de 101: 50 × 101 = 5.050
```

Isso vale para qualquer PA:

**Sₙ = (a₁ + aₙ) × n ÷ 2**

**Exemplo:** você decide guardar R$ 50 no primeiro mês e aumentar R$ 10 a cada mês. No 12º mês guardará 50 + 11 × 10 = R$ 160. No ano todo:

```conta
S = (50 + 160) × 12 ÷ 2
= S = R$ 1.260
```

## Progressão geométrica (PG)

Cada termo é o anterior **vezes** um número fixo, também chamado de **razão** (q).

- 3, 6, 12, 24, 48... (razão 2)
- 1.000, 500, 250, 125... (razão 1/2)

**aₙ = a₁ × q^(n − 1)**

(O sinal ^ quer dizer "elevado a".) Na primeira sequência, o 8º termo é 3 × 2⁷ = 3 × 128 = 384.

A soma dos n primeiros termos de uma PG, quando a razão é diferente de 1, é:

**Sₙ = a₁ × (q^n − 1) ÷ (q − 1)**

Os oito primeiros termos de 3, 6, 12... somam 3 × (2⁸ − 1) ÷ (2 − 1) = 3 × 255 = 765.

A PA é a versão "em passos" da [função do 1º grau](/trilhas/matematica-medio/funcao-do-1-grau); a PG, a da [função exponencial](/trilhas/matematica-medio/exponencial-e-logaritmo). Juros simples formam uma PA; juros compostos, uma PG.

```verificar
Uma bola cai de 8 metros e, a cada batida no chão, sobe metade da altura anterior. A que altura ela chega depois da quarta batida?
- 2 m
+ 0,5 m
- 1 m
> As alturas depois de cada batida formam uma PG de razão 1/2: 4, 2, 1...
```

## Somar infinitos termos

Parece impossível, mas quando a razão de uma PG está entre −1 e 1 os termos encolhem tão depressa que a soma de **todos** eles, infinitos, não passa de um certo valor:

**S = a₁ ÷ (1 − q)**

O exemplo clássico: 1/2 + 1/4 + 1/8 + 1/16 + ... Pela fórmula, (1/2) ÷ (1 − 1/2) = 1. Faz sentido: ande metade de um caminho, depois metade do que falta, depois metade do que ainda falta. Você chega cada vez mais perto do fim, e a soma dos trechos é o caminho inteiro.

## PA, PG e uma briga política

Em 1798, o inglês Thomas Malthus publicou um ensaio em que afirmava que a população tende a crescer em progressão geométrica, enquanto a produção de alimentos cresceria apenas em progressão aritmética. A conclusão dele era que a miséria seria inevitável e que ajudar os pobres só pioraria as coisas.

O argumento foi usado por muito tempo para culpar os pobres pela pobreza, e Marx e Engels o combateram duramente. A história também não foi gentil com a previsão: a produção de alimentos cresceu muito mais do que Malthus supunha, e a fome que existe hoje convive com colheitas recordes. Ela se explica, sobretudo, pela distribuição e pela renda, e não pela falta de comida.

A lição matemática: uma PA e uma PG são **modelos**. Antes de aceitar a conclusão de quem os usa, pergunte de onde saiu a razão e se ela vai mesmo ficar constante.

## Para praticar

1. Na PA 7, 11, 15..., ache o 15º termo.
2. Some os 20 primeiros termos da PA 4, 9, 14...
3. Quanto é 1 + 2 + 3 + ... + 50?
4. Na PG 2, 6, 18..., ache o 6º termo.
5. Calcule a soma infinita 1 + 1/3 + 1/9 + 1/27 + ...
6. Um salário de R$ 1.500 recebe aumento de R$ 100 por ano. Outro, de R$ 1.500, recebe aumento de 5% por ano. Quanto vale cada um no quarto ano (depois de três aumentos)?

**Respostas:** 1) 63. 2) 1.030. 3) 1.275. 4) 486. 5) 1,5. 6) R$ 1.800 e cerca de R$ 1.736. Nos primeiros anos a PA vai à frente; a PG só passa adiante bem mais tarde.
