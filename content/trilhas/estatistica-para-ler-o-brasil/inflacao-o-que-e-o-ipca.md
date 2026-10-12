---
titulo: "Inflação: o que é o IPCA"
resumo: "Como o IBGE mede a alta dos preços, por que a sua inflação pode ser diferente da oficial e como saber se o salário ganhou ou perdeu."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Inflação (IBGE Explica)"
    autor: "Instituto Brasileiro de Geografia e Estatística (IBGE)"
    url: "https://www.ibge.gov.br/explica/inflacao.php"
  - titulo: "Metas para a inflação"
    autor: "Banco Central do Brasil"
    url: "https://www.bcb.gov.br/controleinflacao/metainflacao"
  - titulo: "Salário mínimo nominal e necessário"
    autor: "Departamento Intersindical de Estatística e Estudos Socioeconômicos (DIEESE)"
    url: "https://www.dieese.org.br/analisecestabasica/salarioMinimo.html"
quiz:
  - pergunta: "Qual é a diferença entre o IPCA e o INPC?"
    opcoes: ["O IPCA cobre famílias com renda de 1 a 40 salários mínimos; o INPC, de 1 a 5", "O IPCA mede preços no atacado", "Não há diferença"]
    resposta: 0
    explicacao: "Os dois são do IBGE e usam o mesmo método. Muda a faixa de renda das famílias cuja cesta é acompanhada."
  - pergunta: "De onde vem a lista de produtos e os pesos usados no cálculo?"
    opcoes: ["Da escolha do governo", "Da Pesquisa de Orçamentos Familiares, que verifica o que as famílias consomem", "Das vendas dos supermercados"]
    resposta: 1
    explicacao: "A POF, do IBGE, levanta o que a população consome e quanto do orçamento vai para cada item."
  - pergunta: "Uma inflação de 1% ao mês, durante 12 meses, dá quanto no ano?"
    opcoes: ["12%", "Cerca de 12,7%", "Cerca de 10%"]
    resposta: 1
    explicacao: "As variações mensais se multiplicam: 1,01 elevado a 12 dá cerca de 1,127."
---

## O que é inflação

**Inflação** é o aumento geral dos preços de produtos e serviços. Não é o aumento de um preço só: é o movimento do conjunto. Ela é medida pelos **índices de preços**.

O IBGE produz os dois índices mais importantes do país:

- o **IPCA** (Índice Nacional de Preços ao Consumidor Amplo), que o governo federal considera o índice oficial de inflação;
- o **INPC** (Índice Nacional de Preços ao Consumidor).

## Como se mede

Não dá para acompanhar todos os preços de tudo. O IBGE acompanha uma **cesta** de produtos e serviços que representa o consumo das famílias.

**Passo 1: descobrir o que as famílias compram.** Isso é feito pela Pesquisa de Orçamentos Familiares (POF), que verifica o que a população consome e quanto do rendimento vai para cada coisa: arroz, feijão, passagem de ônibus, material escolar, médico, cinema.

**Passo 2: coletar os preços.** Todo mês, o IBGE levanta aproximadamente 430 mil preços em 30 mil locais, em áreas urbanas de todas as regiões do país, e compara com os do mês anterior.

**Passo 3: fazer a média ponderada.** Cada item entra com um **peso**, igual à sua parte no orçamento das famílias. Um aumento no aluguel ou na carne mexe muito no índice; um aumento no sal, quase nada.

O resultado é um número só, que resume a variação dos preços no mês.

## IPCA e INPC: a cesta de quem?

A diferença está nas famílias consideradas:

| Índice | Famílias com renda de | Usado como referência para |
| --- | --- | --- |
| IPCA | 1 a 40 salários mínimos | metas de inflação e decisões sobre a taxa de juros |
| INPC | 1 a 5 salários mínimos | reajuste do salário mínimo e muitas negociações salariais |

O IBGE explica a razão de existir o INPC: as famílias de menor renda são mais sensíveis às variações de preços, porque tendem a gastar todo o seu rendimento em itens básicos, como alimentação, remédios e transporte.

## A sua inflação não é a oficial

O índice é uma **média**. A sua cesta pode ser bem diferente da cesta média. O IBGE dá o exemplo: uma família que não come carne vermelha e não tem filhos em idade escolar terá uma inflação pessoal diferente da oficial, porque o cálculo dá peso considerável à carne e à mensalidade escolar.

Isso tem um lado de classe. Quanto menor a renda, maior a parte dela que vai para comida, gás, aluguel e transporte. Quando são esses os preços que disparam, a inflação sentida pelos mais pobres fica acima do índice geral. Não é impressão nem "sensação": é efeito do peso de cada item em cada orçamento.

Há mais de uma fonte para acompanhar esse custo de vida. O DIEESE, o departamento de estudos mantido pelo movimento sindical, pesquisa todo mês o preço da cesta básica e calcula o **salário mínimo necessário**: quanto o mínimo deveria valer para cobrir as despesas de uma família, como manda a Constituição.

```verificar
Em um ano, o IPCA foi de 5%. Os alimentos subiram 12% e os eletrônicos caíram 4%. Para uma família que gasta quase tudo em comida, a inflação foi:
- de 5%, igual à de todos
+ maior que 5%
- menor que 5%
> O índice é uma média ponderada pela cesta média. Qual item pesa mais para essa família?
```

## Ganhei ou perdi?

O IBGE resume assim: se o salário varia **menos** que o IPCA, perde-se poder de compra; se varia igual, mantém-se; se varia mais, ganha-se.

Para fazer a conta com precisão, divida:

```conta
Salário reajustado em 5%; inflação de 8% no período
1,05 ÷ 1,08 ≈ 0,972
= perda real de cerca de 2,8%
```

É por isso que, em toda campanha salarial, a primeira reivindicação é **repor a inflação** do período. Reajuste abaixo dela é corte de salário. Só o que vem acima é **aumento real**.

Para corrigir um valor antigo, o IBGE oferece uma calculadora do IPCA na sua página, e o Banco Central, a Calculadora do cidadão.

## Acumulado: as variações se multiplicam

A inflação de vários meses não é a soma das inflações mensais. Como nos [juros compostos](/trilhas/matematica-medio/juros-simples-e-compostos), cada aumento incide sobre os preços já aumentados.

```conta
1% ao mês, por 12 meses
1,01^12 ≈ 1,127
= cerca de 12,7% no ano
```

Com taxas pequenas, a diferença é pequena. Com taxas altas, é enorme. O Brasil conhece isso bem: o IBGE calcula o IPCA desde 1980, e registra que a maior variação mensal da série foi a de março de 1990, **82,39% em um só mês**. Entre 1980 e 1994, ano do Plano Real, o índice acumulado passou de 13 trilhões por cento. Na outra ponta, a menor variação mensal foi a de julho de 2022: −0,68%.

Quando o índice é negativo, os preços, em média, caíram: é a **deflação**. Não confunda com a inflação "em queda": se ela passa de 8% para 5% ao ano, os preços continuam subindo, só que mais devagar.

## Inflação e juros

O Conselho Monetário Nacional, órgão do governo federal, define uma **meta de inflação**, medida pelo IPCA, e o Banco Central é encarregado de persegui-la. O principal instrumento é a taxa básica de juros, a Selic: juros mais altos encarecem o crédito, esfriam as compras e os investimentos e, com isso, seguram os preços.

O remédio tem custo. Juros altos significam menos emprego, crédito mais caro para quem deve e uma despesa maior do governo com a dívida pública, paga a quem tem dinheiro aplicado. Quem ganha e quem perde com cada ponto da Selic é um dos debates centrais da política econômica, e não uma questão apenas técnica.

## Para praticar

1. Um salário passou de R$ 2.000 para R$ 2.120 em um ano de inflação de 4%. Houve ganho real? De quanto, aproximadamente?
2. A inflação foi de 2% em um mês e de 3% no seguinte. Qual é o acumulado dos dois meses?
3. Um aluguel de R$ 1.000 é reajustado por um índice que acumulou 10% no ano. Qual é o novo valor?
4. Por que o reajuste do salário mínimo costuma tomar por base o INPC, e não o IPCA?
5. Anote os preços de dez itens que você compra todo mês. Repita daqui a três meses e calcule a sua inflação pessoal.

**Respostas:** 1) Sim: o reajuste foi de 6%; 1,06 ÷ 1,04 ≈ 1,019, ganho real de cerca de 1,9%. 2) 1,02 × 1,03 = 1,0506: cerca de 5,06%. 3) R$ 1.100. 4) Porque o INPC acompanha a cesta das famílias com renda de 1 a 5 salários mínimos, mais próxima da de quem recebe o mínimo.
