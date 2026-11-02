---
titulo: "Juros compostos"
resumo: "Juros sobre juros: a fórmula do montante, por que a dívida cresce cada vez mais rápido, a diferença para os juros simples, a taxa equivalente e como achar o tempo com logaritmos dados na prova."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Contemporary Mathematics, seção 6.4, Compound Interest"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/6-4-compound-interest"
  - titulo: "Contemporary Mathematics, seção 6.3, Simple Interest"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/6-3-simple-interest"
  - titulo: "Algebra and Trigonometry 2e, seção 6.1, Exponential Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/6-1-exponential-functions"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "R$ 1.000,00 são aplicados a juros compostos de 10% ao mês. Qual é o montante depois de 3 meses?"
    opcoes: ["R$ 1.300,00", "R$ 1.030,00", "R$ 1.331,00", "R$ 1.310,00"]
    resposta: 2
    explicacao: "Mês a mês: 1.000 → 1.100 → 1.210 → 1.331. Pela fórmula, 1.000 × 1,1³ = 1.000 × 1,331. R$ 1.300,00 seria o resultado em juros simples."
  - pergunta: "Nos juros compostos, os juros de cada mês são calculados sobre"
    opcoes: ["o montante do mês anterior", "o capital inicial, sempre", "a taxa do mês anterior", "o tempo total da aplicação"]
    resposta: 0
    explicacao: "Os juros de um mês se juntam ao capital e, no mês seguinte, também rendem juros. É o juro sobre juro."
  - pergunta: "Em juros compostos, uma taxa de 2% ao mês equivale, em um ano, a cerca de quanto? Use 1,02¹² ≈ 1,268."
    opcoes: ["24%", "2%", "12,68%", "26,8%"]
    resposta: 3
    explicacao: "O fator de um ano é 1,02¹² ≈ 1,268. O aumento é o que passa de 1: 0,268, ou cerca de 26,8%. Os 24% valem só para juros simples."
  - pergunta: "Qual expressão dá o montante de um capital C aplicado a uma taxa i, em juros compostos, por t períodos?"
    opcoes: ["C · (1 + i · t)", "C · (1 + i)ᵗ", "C · i · t", "C + iᵗ"]
    resposta: 1
    explicacao: "A cada período o valor é multiplicado por (1 + i). Em t períodos, por (1 + i) elevado a t. C · (1 + i · t) é o montante dos juros simples."
---

```provocacao
Suponha uma dívida de R$ 1.000,00 num cartão que cobra juros compostos de 10% ao mês sobre o que ficou sem pagar. Se ninguém pagar nada por um ano, a dívida vai a R$ 2.200,00? Ou passa disso?
```

## O que você vai aprender

Ao fim desta aula você vai saber calcular juros compostos mês a mês e pela fórmula, explicar por que eles crescem mais rápido que os juros simples, achar a taxa equivalente em outro período e descobrir o tempo de uma aplicação ou dívida com os logaritmos que a prova costuma dar.

## Juros sobre juros

Nos juros simples, a taxa incide sempre sobre o capital inicial. Nos **juros compostos**, os juros de cada mês entram na conta e passam a render juros no mês seguinte. É o famoso juro sobre juro.

Veja R$ 1.000,00 a 10% ao mês:

- Mês 1: 10% de 1.000 = 100. O valor vai a 1.100.
- Mês 2: 10% de 1.100 = 110. O valor vai a 1.210.
- Mês 3: 10% de 1.210 = 121. O valor vai a 1.331.

Os juros crescem a cada mês: 100, 110, 121. Em juros simples seriam sempre 100.

Repare: cada mês é um aumento de 10%, ou seja, uma multiplicação pelo fator 1,1. É o mesmo raciocínio dos aumentos sucessivos. Três meses são três multiplicações: 1.000 × 1,1 × 1,1 × 1,1 = 1.000 × 1,1³.

```formula
M = C · (1 + i)ᵗ
o montante é o capital multiplicado pelo fator (1 + i), uma vez para cada período
a taxa i vai em decimal, e i e t têm de estar na mesma unidade de tempo
```

## Simples e compostos lado a lado

Com R$ 1.000,00 a 10% ao mês:

| Meses | Juros simples | Juros compostos |
| --- | --- | --- |
| 1 | 1.100 | 1.100 |
| 2 | 1.200 | 1.210 |
| 3 | 1.300 | 1.331 |
| 4 | 1.400 | 1.464,10 |

No primeiro período, os dois dão o mesmo. Depois, os compostos passam à frente, e a distância aumenta. Nos simples, o montante cresce em linha reta (uma progressão aritmética). Nos compostos, cresce como uma **exponencial** (uma progressão geométrica): a curva sobe cada vez mais rápido.

Volte à provocação. Em um ano, a dívida é 1.000 × 1,1¹². Esse fator vale cerca de 3,14. A dívida passa de R$ 3.100,00: mais que o triplo, e não R$ 2.200,00.

## Taxa equivalente

Em juros simples, 2% ao mês dão 24% ao ano. Em juros compostos, não. Um ano são doze multiplicações por 1,02: o fator é 1,02¹², cerca de 1,268. A taxa anual equivalente é de cerca de 26,8%.

Taxas **equivalentes** são as que levam o mesmo capital ao mesmo montante, no mesmo prazo. Nos compostos, para achar a taxa de um período maior, eleve o fator; nunca multiplique a taxa.

## O tempo, com logaritmos

Às vezes a prova pergunta em quanto tempo um valor dobra. A pergunta é: 1,05 elevado a quanto dá 2? A resposta é um logaritmo, e a prova dá os valores. Com log 2 ≈ 0,30 e log 1,05 ≈ 0,02, o tempo é t = log 2 ÷ log 1,05 ≈ 0,30 ÷ 0,02 = 15 períodos. Na prova, quase sempre a potência ou o logaritmo vêm prontos no enunciado: procure-os antes de fazer conta.

```verificar
R$ 200,00 a juros compostos de 10% ao mês, durante 2 meses, dão um montante de:
- R$ 240,00
+ R$ 242,00
- R$ 220,00
> Mês 1: 200 × 1,1 = 220. Mês 2: 220 × 1,1 = 242. R$ 240,00 seria o resultado em juros simples.
```

```navidareal
Os juros compostos explicam por que uma dívida de cartão ou de cheque especial pode crescer tão depressa. Cada mês sem pagar faz os juros do mês seguinte incidirem sobre uma dívida maior.

Os mesmos juros compostos trabalham a favor de quem guarda dinheiro: numa aplicação, o rendimento de cada mês também passa a render. Por isso, quanto antes se começa a guardar, mais o tempo ajuda.
```

## Exemplo resolvido

**Uma associação de moradores aplicou R$ 10.000,00 do fundo da festa a juros compostos de 1% ao mês. Quanto ela terá depois de 3 meses?**

1. Mês 1: 1% de 10.000 = 100. O valor vai a 10.100.
2. Mês 2: 1% de 10.100 = 101. O valor vai a 10.201.
3. Mês 3: 1% de 10.201 = 102,01. O valor vai a 10.303,01.

Pela fórmula: 10.000 × 1,01³ = 10.000 × 1,030301 = 10.303,01 reais. Em juros simples seriam 10.300. A diferença, de R$ 3,01, é pequena em pouco tempo e com taxa baixa, mas cresce com os meses.

## Como isso cai no ENEM

- **Formatos:** dívida de cartão ou empréstimo que cresce mês a mês; aplicação financeira; comparação entre juros simples e compostos, ou entre duas propostas; desvalorização de um bem (fator menor que 1); tempo para um valor dobrar, com logaritmos dados. A prova costuma dar as potências prontas, como 1,1³ = 1,331.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, juros compostos foi o tópico de 1 das 81 questões classificadas de Matemática (1,2%). A H3 foi a habilidade mais frequente da área, com 12 das 81 questões (14,8%). São só duas provas: é tendência, não promessa.
- **Habilidades:** H3 (resolver problemas com conhecimentos numéricos), H4 (julgar se um resultado numérico faz sentido ao discutir uma afirmação com números) e H5 (avaliar propostas de intervenção na realidade usando conhecimentos numéricos).
- **Armadilhas:**
  - Multiplicar a taxa pelo tempo, como nos juros simples.
  - Achar que a taxa anual equivalente é 12 vezes a mensal.
  - Ler o fator (1,21) como taxa: fator 1,21 é aumento de 21%.
  - Dar os juros quando a questão pede o montante, ou o contrário.

## Questão comentada

**Texto-base.** Uma pessoa precisa pagar uma dívida de R$ 2.000,00 daqui a 3 meses, de uma vez só. O credor oferece duas opções. Opção I: juros compostos de 10% ao mês. Opção II: juros simples de 11% ao mês. Considere 1,1³ = 1,331.

**Comando.** Comparando as duas opções, é correto afirmar que

A) a opção I custa R$ 62,00 a mais.
B) a opção I custa R$ 2,00 a mais.
C) a opção II custa R$ 60,00 a mais.
D) a opção I custa R$ 662,00 a mais.
E) a opção II custa R$ 20,00 a mais.

**Resolução.**

1. Opção I: 2.000 × 1,1³ = 2.000 × 1,331 = 2.662 reais.
2. Opção II: juros de 11% por mês, durante 3 meses, dão 33% do capital. 33% de 2.000 = 660. Total: 2.660 reais.
3. Diferença: 2.662 − 2.660 = 2 reais. A opção I custa 2 reais a mais.

Repare: a taxa simples de 11% parece bem maior que 10%, mas, em 3 meses, o juro sobre juro da opção I quase empata com ela e ainda passa um pouco.

**Gabarito: B.**

**Por que as outras não:**

- A) a opção I custa R$ 62,00 a mais: a opção II foi calculada com 10%, e não com 11% (2.662 − 2.600).
- C) a opção II custa R$ 60,00 a mais: a opção I foi calculada como juros simples de 10% (2.600). Na opção I os juros são compostos.
- D) a opção I custa R$ 662,00 a mais: R$ 662,00 são os juros da opção I, e não a diferença entre as opções.
- E) a opção II custa R$ 20,00 a mais: comparou só o primeiro mês (220 contra 200). Do segundo mês em diante, o juro sobre juro da opção I muda a conta.

```realidade
Pense numa dívida que você ou alguém próximo já teve (cartão, crediário, empréstimo). Qual era a taxa ao mês? Calcule, mês a mês, quanto uma dívida de R$ 100,00 viraria em 3 meses com essa taxa, se nada fosse pago. O que esse número diz sobre qual dívida pagar primeiro?
```

## Resumo

- Juros compostos: os juros de cada período passam a render juros no período seguinte.
- M = C · (1 + i)ᵗ: multiplique pelo fator uma vez por período.
- No primeiro período, simples e compostos dão o mesmo; depois, os compostos crescem mais.
- Taxa equivalente composta: eleve o fator ao número de períodos; não multiplique a taxa.
- Para achar o tempo, use os logaritmos dados: t = log (montante ÷ capital) ÷ log (1 + i).

## Para aprofundar

- [Juros simples](/trilhas/enem-matematica-proporcionalidade/juros-simples)
- [Aumentos e descontos sucessivos](/trilhas/enem-matematica-proporcionalidade/aumentos-e-descontos-sucessivos)
- [Juros simples e compostos](/trilhas/matematica-medio/juros-simples-e-compostos)
- [Função exponencial](/trilhas/enem-matematica-funcoes-e-algebra/funcao-exponencial)
- [Logaritmos e escalas logarítmicas](/trilhas/enem-matematica-funcoes-e-algebra/logaritmos)
