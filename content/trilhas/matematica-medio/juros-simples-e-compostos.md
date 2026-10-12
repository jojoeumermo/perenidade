---
titulo: "Juros simples e compostos"
resumo: "O preço do dinheiro no tempo: como se calculam os juros, por que a dívida do cartão explode e como comparar ofertas de crédito."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 6.4, Solve Simple Interest Applications"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/6-4-solve-simple-interest-applications"
  - titulo: "Algebra and Trigonometry 2e, seção 6.1, Exponential Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/6-1-exponential-functions"
  - titulo: "Calculadora do cidadão"
    autor: "Banco Central do Brasil"
    url: "https://www.bcb.gov.br/meubc/calculadoradocidadao"
  - titulo: "Lei nº 14.690, de 3 de outubro de 2023, artigo 28 (limite para juros e encargos do cartão de crédito)"
    autor: "Brasil"
    ano: "2023"
    url: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/L14690.htm"
  - titulo: "Lei nº 14.181, de 1º de julho de 2021 (prevenção e tratamento do superendividamento)"
    autor: "Brasil"
    ano: "2021"
    url: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm"
quiz:
  - pergunta: "Quanto rendem R$ 800 a juros simples de 3% ao mês, em 5 meses?"
    opcoes: ["R$ 24", "R$ 120", "R$ 127,42"]
    resposta: 1
    explicacao: "3% de 800 são R$ 24 por mês. Em 5 meses: 5 × 24 = R$ 120."
  - pergunta: "Uma taxa de 10% ao mês, a juros compostos, equivale a quanto ao ano?"
    opcoes: ["120%", "Cerca de 214%", "100%"]
    resposta: 1
    explicacao: "1,10 multiplicado por ele mesmo 12 vezes dá cerca de 3,14. A dívida mais que triplica: sobe cerca de 214%."
  - pergunta: "Qual é o número mais completo para comparar duas ofertas de empréstimo?"
    opcoes: ["O valor da parcela", "A taxa de juros anunciada", "O custo efetivo total (CET)"]
    resposta: 2
    explicacao: "O CET soma aos juros as tarifas, os seguros e os impostos. A parcela pequena pode esconder um prazo longo e um custo alto."
---

## O aluguel do dinheiro

**Juro** é o preço pago pelo uso do dinheiro de outra pessoa durante um tempo. Quem empresta recebe juros; quem toma emprestado paga. Três elementos entram em toda conta:

- o **capital** (C): o valor emprestado ou aplicado;
- a **taxa** (i): a porcentagem cobrada por período (ao mês, ao ano);
- o **tempo** (t): o número de períodos.

O total devido no fim, capital mais juros, chama-se **montante** (M).

Cuidado com as unidades: taxa ao mês pede tempo em meses; taxa ao ano, tempo em anos. E, na conta, a taxa entra na forma decimal: 3% = 0,03.

## Juros simples

Os juros incidem **sempre sobre o capital inicial**. A cada período soma-se o mesmo valor.

**J = C × i × t**

R$ 800 a 3% ao mês, por 5 meses:

```conta
J = 800 × 0,03 × 5 = 120
= montante: 800 + 120 = R$ 920
```

Os juros simples aparecem em contas de curto prazo, como os juros por dia de atraso de um boleto.

## Juros compostos

Os juros de cada período incidem sobre o **total acumulado**, incluindo os juros anteriores. É o "juro sobre juro", e é assim que funcionam os empréstimos, os financiamentos, o cartão e também a poupança.

A cada período, o saldo é multiplicado por (1 + i). Depois de t períodos:

**M = C × (1 + i)^t**

(O sinal ^ quer dizer "elevado a".)

## A diferença na prática

R$ 1.000 a 10% ao mês:

| Mês | Juros simples | Juros compostos |
| --- | --- | --- |
| 1 | 1.100,00 | 1.100,00 |
| 2 | 1.200,00 | 1.210,00 |
| 3 | 1.300,00 | 1.331,00 |
| 6 | 1.600,00 | 1.771,56 |
| 12 | 2.200,00 | 3.138,43 |

No começo, os dois andam juntos. Com o tempo, os juros compostos disparam: são uma [função exponencial](/trilhas/matematica-medio/exponencial-e-logaritmo). Em um ano, a dívida a juros compostos mais que triplicou.

Experimente outros valores na [calculadora de juros compostos](/ferramentas/juros-compostos) do Instituto ou na Calculadora do cidadão, do Banco Central.

```verificar
Uma dívida de R$ 2.000 cresce 5% ao mês, a juros compostos. Quanto se deve depois de 3 meses?
- R$ 2.300,00
+ R$ 2.315,25
- R$ 2.150,00
> Multiplique por 1,05 três vezes: 2.000 → 2.100 → 2.205 → ...
```

## Taxa ao mês não é taxa ao ano dividida por 12

Um anúncio diz "apenas 10% ao mês". Quanto é isso ao ano? Não é 120%. Em juros compostos, multiplica-se:

```conta
1,10^12 ≈ 3,138
= a dívida é multiplicada por 3,138: sobe cerca de 214% ao ano
```

Uma taxa de 2% ao mês equivale a cerca de 26,8% ao ano, e não a 24%. Desconfie de toda taxa anunciada só ao mês: peça sempre a taxa anual.

## O cartão e o cheque especial

O **rotativo** do cartão de crédito (o que acontece quando se paga menos que o total da fatura) e o cheque especial estão entre os créditos mais caros do país, com taxas que passam de 100% ao ano e, no rotativo, chegam a várias centenas. Pagar só o mínimo da fatura é a porta de entrada mais comum para o superendividamento.

Duas leis recentes mexeram nesse terreno:

- a **Lei nº 14.690, de 2023**, levou a um teto: desde janeiro de 2024, o total de juros e encargos cobrados no rotativo e no parcelamento da fatura não pode ultrapassar o valor original da dívida;
- a **Lei do Superendividamento (nº 14.181, de 2021)** alterou o Código de Defesa do Consumidor: exige informação clara antes da contratação e prevê a renegociação conjunta das dívidas de consumo, preservando o mínimo necessário para a pessoa viver.

Quem está nessa situação pode procurar o Procon ou a Defensoria Pública da sua cidade.

## Como comparar ofertas

1. **Peça o CET**, o custo efetivo total. Ele reúne juros, tarifas, seguros e impostos em uma taxa só, e a instituição é obrigada a informá-lo antes do contrato.
2. **Multiplique a parcela pelo número de parcelas** e compare com o preço à vista. A diferença é o que você paga pelo prazo.
3. **Desconfie do "sem juros".** Se existe desconto para pagamento à vista, os juros estão embutidos no preço a prazo.
4. **Olhe o prazo, não só a parcela.** Uma parcela que "cabe no bolso" por 60 meses pode custar o dobro do produto.

## Juros a favor

O mesmo mecanismo trabalha para quem consegue guardar. Mas os juros de uma aplicação só representam ganho se superarem a **inflação**. Se a aplicação rende 8% em um ano e os preços sobem 5%, o ganho real é de aproximadamente 3%. Com rendimento abaixo da inflação, o dinheiro cresce no extrato e encolhe no mercado.

## Para conversar

Por que quem tem menos paga os juros mais altos? Quem ganha com isso? No seu bairro, que formas de crédito as pessoas usam quando falta dinheiro antes do fim do mês?

## Para praticar

1. Calcule os juros simples de R$ 1.500 a 2% ao mês, por 8 meses.
2. Um empréstimo de R$ 500 a 15% ao mês, a juros compostos, vira quanto em 6 meses? (Use a calculadora: 1,15^6.)
3. Você pegou R$ 1.000 e devolveu R$ 1.150 um mês depois. Qual foi a taxa?
4. Uma geladeira custa R$ 2.400 à vista ou 24 parcelas de R$ 149. Quanto se paga a mais no parcelado?
5. Pela regra do 70, em quanto tempo dobra uma dívida a 7% ao mês?

**Respostas:** 1) R$ 240. 2) Cerca de R$ 1.156,53. 3) 15% ao mês. 4) 24 × 149 = R$ 3.576; R$ 1.176 a mais. 5) Em cerca de 10 meses.
