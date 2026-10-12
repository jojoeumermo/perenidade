---
titulo: "Potências e raízes"
resumo: "Multiplicar um número por ele mesmo várias vezes, o caminho de volta pela raiz e os números muito grandes e muito pequenos."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 10.2, Use Multiplication Properties of Exponents"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/10-2-use-multiplication-properties-of-exponents"
  - titulo: "Prealgebra 2e, seção 5.7, Simplify and Use Square Roots"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/5-7-simplify-and-use-square-roots"
  - titulo: "Prealgebra 2e, seção 10.5, Integer Exponents and Scientific Notation"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/10-5-integer-exponents-and-scientific-notation"
quiz:
  - pergunta: "Quanto é 2³?"
    opcoes: ["6", "8", "9"]
    resposta: 1
    explicacao: "2³ = 2 × 2 × 2 = 8. O erro comum é fazer 2 × 3."
  - pergunta: "Qual é a raiz quadrada de 81?"
    opcoes: ["9", "40,5", "18"]
    resposta: 0
    explicacao: "9 × 9 = 81. A raiz quadrada desfaz o quadrado."
  - pergunta: "Como se escreve 300.000.000 em notação científica?"
    opcoes: ["3 × 10⁸", "3 × 10⁹", "30 × 10⁶"]
    resposta: 0
    explicacao: "O 3 é seguido de oito zeros: 3 × 10⁸."
---

## Uma multiplicação repetida

Assim como a multiplicação abrevia uma soma repetida, a **potência** abrevia uma multiplicação repetida:

2 × 2 × 2 × 2 × 2 = 2⁵ = 32

O número de baixo é a **base** (o que se multiplica). O número pequeno, em cima, é o **expoente** (quantas vezes ele aparece). Lê-se "dois elevado a cinco" ou "dois à quinta".

O erro mais comum é multiplicar a base pelo expoente. **2³ não é 6.** É 2 × 2 × 2 = 8.

## Quadrado e cubo

Os expoentes 2 e 3 têm nome próprio, e ele vem da geometria:

- 5² lê-se "cinco ao **quadrado**": é a área de um quadrado de lado 5. Vale 25.
- 5³ lê-se "cinco ao **cubo**": é o volume de um cubo de aresta 5. Vale 125.

É por isso que a área se mede em m² e o volume em m³.

Quadrados que vale a pena reconhecer: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144.

## Crescimento que engana

Uma lenda antiga conta que o inventor do xadrez pediu ao rei, como prêmio, um grão de trigo pela primeira casa do tabuleiro, dois pela segunda, quatro pela terceira, sempre dobrando. O rei achou pouco. Só a última casa, a de número 64, teria 2⁶³ grãos; o tabuleiro inteiro, mais de 18 quintilhões, um número de vinte algarismos.

Dobrar parece lento no começo e explode depois. Uma mensagem que cada pessoa repassa a duas outras chega a 2¹⁰ = 1.024 pessoas no décimo repasse e a mais de um milhão no vigésimo. É assim que crescem os boatos, as epidemias e as dívidas com [juros sobre juros](/ferramentas/juros-compostos).

## Regras que poupam trabalho

Com a **mesma base**:

- **Multiplicando, somam-se os expoentes:** 2³ × 2² = (2 × 2 × 2) × (2 × 2) = 2⁵.
- **Dividindo, subtraem-se os expoentes:** 2⁵ ÷ 2² = 2³.
- **Potência de potência, multiplicam-se:** (2³)² = 2³ × 2³ = 2⁶.

Dois casos especiais:

- todo número elevado a **1** é ele mesmo: 7¹ = 7;
- todo número diferente de zero elevado a **0** vale 1: 7⁰ = 1. Isso sai da regra da divisão: 7² ÷ 7² é 1, e pela regra é 7⁰.

Um cuidado com sinais: (−3)² = (−3) × (−3) = 9, mas −3² = −9, porque sem parênteses o quadrado atinge só o 3. Veja a aula de [números negativos](/trilhas/matematica-fundamental/numeros-negativos).

```verificar
Quanto é 10⁴ × 10²?
- 10⁸
+ 10⁶
- 100⁶
> Mesma base, multiplicação: somam-se os expoentes.
```

## Potências de 10

São as mais fáceis: o expoente diz quantos zeros vêm depois do 1.

| Potência | Valor | Nome |
| --- | --- | --- |
| 10² | 100 | cem |
| 10³ | 1.000 | mil |
| 10⁶ | 1.000.000 | milhão |
| 10⁹ | 1.000.000.000 | bilhão |

Para números muito grandes, a ciência usa a **notação científica**: um número entre 1 e 10 multiplicado por uma potência de 10. A velocidade da luz é de cerca de 300.000.000 metros por segundo, ou 3 × 10⁸ m/s.

Para números muito pequenos, o expoente é negativo: 10⁻¹ = 0,1; 10⁻² = 0,01; 10⁻³ = 0,001. Um milímetro é 10⁻³ metro.

## O caminho de volta: a raiz

A **raiz quadrada** pergunta: que número, multiplicado por ele mesmo, dá este resultado?

√49 = 7, porque 7 × 7 = 49.

Na prática: um terreno quadrado tem 144 m². Quanto mede cada lado? √144 = 12 metros.

A maioria dos números não tem raiz exata. Para estimar √50, cerque com os quadrados conhecidos: 7² = 49 e 8² = 64. A raiz está entre 7 e 8, bem perto de 7. Na calculadora, dá cerca de 7,07.

A **raiz cúbica** faz o mesmo para o cubo: ∛27 = 3, porque 3 × 3 × 3 = 27.

## Para praticar

1. Calcule 3⁴, 10⁵ e 1²⁰.
2. Escreva como uma potência só: 5³ × 5⁴.
3. Calcule √121 e ∛8.
4. Entre que números inteiros está √30?
5. Escreva 45.000.000 em notação científica.
6. Uma dívida dobra a cada ano. Começando em R$ 500, quanto ela vale depois de 6 anos?

**Respostas:** 1) 81; 100.000; 1. 2) 5⁷. 3) 11 e 2. 4) Entre 5 e 6. 5) 4,5 × 10⁷. 6) 500 × 2⁶ = R$ 32.000.
