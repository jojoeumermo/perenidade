---
titulo: "Aumentos e descontos sucessivos"
resumo: "O fator multiplicador, por que aumentos e descontos seguidos se multiplicam e não se somam, como voltar ao preço original e como achar a taxa de uma variação."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Contemporary Mathematics, seção 6.2, Discounts, Markups, and Sales Tax"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/6-2-discounts-markups-and-sales-tax"
  - titulo: "Prealgebra 2e, seção 6.3, Solve Sales Tax, Commission, and Discount Applications"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/6-3-solve-sales-tax-commission-and-discount-applications"
  - titulo: "Prealgebra 2e, seção 6.2, Solve General Applications of Percent"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/6-2-solve-general-applications-of-percent"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é o fator que dá um desconto de 15% num preço?"
    opcoes: ["1,15", "0,15", "0,85", "1,85"]
    resposta: 2
    explicacao: "Com desconto de 15%, sobra 100% − 15% = 85% do preço. O fator é 0,85. O 0,15 dá só o valor do desconto, e o 1,15 dá um aumento."
  - pergunta: "Um preço de R$ 200 sobe 10% e, depois, mais 10%. Qual é o preço final?"
    opcoes: ["R$ 242", "R$ 240", "R$ 220", "R$ 244"]
    resposta: 0
    explicacao: "Primeiro aumento: 200 + 20 = 220. Segundo: 10% de 220 é 22, e 220 + 22 = 242. O segundo aumento incide sobre o valor já aumentado."
  - pergunta: "Um preço sobe 50% e, depois, cai 50%. Em relação ao preço inicial, ele"
    opcoes: ["volta a ser igual", "fica 50% maior", "fica 25% maior", "fica 25% menor"]
    resposta: 3
    explicacao: "Os fatores se multiplicam: 1,5 × 0,5 = 0,75. O preço final é 75% do inicial: 25% menor. A queda de 50% é calculada sobre um valor maior."
  - pergunta: "Um quilo de tomate passou de R$ 4,00 para R$ 5,00. De quanto foi o aumento?"
    opcoes: ["10%", "25%", "20%", "50%"]
    resposta: 1
    explicacao: "Variação = (novo − antigo) ÷ antigo = 1 ÷ 4 = 25%. Quem dividiu por 5, o valor novo, achou 20%."
---

```provocacao
O botijão de gás subiu 20% num mês. No mês seguinte, a revenda anunciou: "baixamos 20%!". O preço voltou a ser o que era antes?
```

## O que você vai aprender

Ao fim desta aula você vai saber usar o fator multiplicador para aumentos e descontos, calcular aumentos e descontos seguidos, descobrir que taxa faz um preço voltar ao valor original e achar a taxa de uma variação, sem calculadora.

## O fator multiplicador

Aumentar um preço em 20% é somar 20% dele. Um preço de R$ 100 vira 100 + 20 = 120. Mas dá para fazer isso numa conta só: o preço novo é 120% do antigo, ou seja, 1,2 vez o antigo.

Esse 1,2 é o **fator multiplicador**. Ele resume o aumento num número só.

Com o desconto é igual. Um desconto de 20% deixa 80% do preço. O fator é 0,8.

```formula
aumento de i:  V novo = V × (1 + i)       desconto de i:  V novo = V × (1 − i)
para aumentar, multiplique por um mais a taxa; para descontar, multiplique por um menos a taxa
a taxa vai em número decimal: 20% vira 0,2, 5% vira 0,05
```

Alguns fatores para guardar: aumento de 10% é × 1,1; de 5% é × 1,05; de 50% é × 1,5. Desconto de 10% é × 0,9; de 25% é × 0,75; de 30% é × 0,7.

## Seguidos se multiplicam

Quando há dois aumentos seguidos, o segundo é calculado sobre o valor que já foi aumentado. Por isso as taxas não se somam: os fatores se multiplicam.

Dois aumentos de 10% dão 1,1 × 1,1 = 1,21. O preço final é 121% do inicial. O aumento total é de 21%, e não de 20%. O ponto a mais é o aumento sobre o aumento.

Para multiplicar fatores sem calculadora, faça como com dinheiro. 1,1 × 1,05 é 1,05 mais 10% de 1,05: 1,05 + 0,105 = 1,155. O aumento total é de 15,5%.

O mesmo vale para descontos. Dois descontos de 10% dão 0,9 × 0,9 = 0,81. Paga-se 81% do preço: o desconto total é de 19%, e não de 20%.

## Subir e descer a mesma taxa não volta

Volte à provocação. Subir 20% é × 1,2. Baixar 20% é × 0,8. Junto: 1,2 × 0,8 = 0,96. O botijão ficou com 96% do preço antigo: 4% mais barato que antes do aumento.

Isso acontece porque os 20% da queda foram calculados sobre um preço maior. Então a queda, em reais, foi maior que a subida.

E se a revenda quisesse voltar exatamente ao preço antigo? O fator da volta tem de desfazer o 1,2: 1 ÷ 1,2 = 10/12 = 5/6, que é cerca de 0,833. A queda certa seria de cerca de 16,7%, e não de 20%.

## A taxa de uma variação

Quando a questão dá o valor antigo e o novo e pede a taxa, divida a diferença pelo valor de **partida**.

De R$ 4,00 para R$ 5,00, a diferença é 1. Dividida pelo antigo: 1 ÷ 4 = 0,25, ou seja, 25% de aumento. Se o preço voltar de 5 para 4, a queda é 1 ÷ 5 = 20%. O mesmo real de diferença vale taxas diferentes, conforme o ponto de partida.

Para achar a taxa total de uma sequência de aumentos e descontos, multiplique os fatores e tire 1. Fator total 1,155 quer dizer aumento de 15,5%. Fator total 0,81 quer dizer desconto de 19%.

```navidareal
Reajustes de aluguel, de passagem e de salário costumam ser anunciados ano a ano. Quem soma as taxas subestima o que aconteceu. Um aluguel que sobe 10% por ano, durante dois anos, não sobe 20%: sobe 21%.

Na outra ponta, uma liquidação de "50% + 20% de desconto" não dá 70%. Dá 0,5 × 0,8 = 0,4: paga-se 40% do preço, um desconto de 60%.
```

```verificar
Um produto recebe dois descontos seguidos de 10%. O desconto total é de:
- 20%
+ 19%
- 1%
> Multiplique os fatores: 0,9 × 0,9 = 0,81. Paga-se 81% do preço, então o desconto total é 100% − 81% = 19%.
```

## Exemplo resolvido

**Um aluguel de R$ 800,00 foi reajustado em 5% num ano e em 10% no ano seguinte. Qual é o aluguel depois dos dois reajustes, e de quanto foi o aumento total?**

1. Primeiro reajuste: 5% de 800 é a metade de 10% (80), ou seja, 40. O aluguel vai a 840.
2. Segundo reajuste: 10% de 840 é 84. O aluguel vai a 840 + 84 = 924.
3. Aumento total: 924 − 800 = 124. Em relação aos 800 de partida: 124 ÷ 800 = 0,155, ou 15,5%.

Confira pelos fatores: 1,05 × 1,1 = 1,155. E 800 × 1,155 = 800 + 124 = 924.

## Como isso cai no ENEM

- **Formatos:** reajuste de preço ou de tarifa em duas etapas, liquidação com desconto em cima de desconto, pagamento com acréscimo no cartão e desconto à vista, comparação de duas lojas que aplicam as taxas em ordem diferente. A questão pede o preço final, a taxa total ou a taxa que faz voltar ao valor inicial.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, o tópico aumentos e descontos sucessivos teve 1 das 81 questões classificadas de Matemática (1,2%). Mas ele é a continuação da porcentagem, que teve 5 (6,2%), e aparece dentro de muitas questões de contas do dia a dia.
- **Habilidades:** H3 (resolver problemas com conhecimentos numéricos) e H4 (julgar se um resultado numérico faz sentido ao discutir uma afirmação com números), quando a questão pede para avaliar um anúncio.
- **Armadilhas:**
  - Somar as taxas de aumentos ou descontos seguidos.
  - Achar que subir e descer a mesma taxa volta ao começo.
  - Dividir pelo valor novo ao calcular uma variação.
  - Usar o fator do desconto (0,8) como se fosse o desconto (80%).

## Questão comentada

**Texto-base.** Uma papelaria de bairro aumentou em 60% o preço de um caderno. As vendas caíram tanto que, semanas depois, a dona decidiu dar um desconto sobre o preço novo, de modo que o caderno voltasse a custar exatamente o que custava antes do aumento.

**Comando.** O desconto que ela deve dar sobre o preço novo é de

A) 60%.
B) 40%.
C) 37,5%.
D) 30%.
E) 62,5%.

**Resolução.**

1. O aumento de 60% multiplicou o preço por 1,6.
2. Para voltar, o desconto tem de levar o preço de volta a 1. O fator da volta é 1 ÷ 1,6.
3. Sem calculadora: 1 ÷ 1,6 = 10 ÷ 16 = 5/8. E 5/8 é 0,625, porque 1/8 é 0,125 e 5 × 0,125 = 0,625.
4. Fator 0,625 quer dizer pagar 62,5% do preço novo. O desconto é 100% − 62,5% = 37,5%.

Confira com um preço: R$ 10,00 vira R$ 16,00 com o aumento. 37,5% de 16 é 6 (porque 1/8 de 16 é 2, e 3/8 é 6). 16 − 6 = R$ 10,00.

**Gabarito: C.**

**Por que as outras não:**

- A) 60%: é a mesma taxa do aumento. Mas o desconto incide sobre um preço maior: 1,6 × 0,4 = 0,64, e o caderno ficaria 36% mais barato que antes.
- B) 40%: é 100% − 60%. Dá o mesmo fator 0,6, que não desfaz o 1,6: 1,6 × 0,6 = 0,96.
- D) 30%: é a metade do aumento. 1,6 × 0,7 = 1,12: o caderno ainda ficaria 12% mais caro.
- E) 62,5%: é o fator da volta lido como desconto. 62,5% é a parte do preço novo que se paga; o desconto é o que falta para 100%.

```realidade
Lembre um produto que você compra sempre (pão, gás, passagem, arroz). Procure, em notas antigas ou na memória, o preço de dois momentos diferentes. Calcule a variação em porcentagem, dividindo pelo preço mais antigo. Se houve mais de um aumento no caminho, a soma das taxas daria o mesmo resultado?
```

## Resumo

- Aumento de i: multiplique por (1 + i). Desconto de i: multiplique por (1 − i).
- Aumentos e descontos seguidos: multiplique os fatores, nunca some as taxas.
- Subir e descer a mesma taxa deixa o preço menor que o inicial.
- Para voltar ao preço original, o fator da volta é 1 dividido pelo fator do aumento.
- Variação = (novo − antigo) ÷ antigo. Divida sempre pelo valor de partida.

## Para aprofundar

- [Porcentagem](/trilhas/enem-matematica-proporcionalidade/porcentagem)
- [Porcentagem](/trilhas/matematica-fundamental/porcentagem)
- [Porcentagem no noticiário](/trilhas/estatistica-para-ler-o-brasil/porcentagem-no-noticiario)
- [Preço, salário e inflação](/trilhas/economia-fundamental/preco-salario-e-inflacao)
- [Matemática, o essencial: números, proporção e porcentagem](/trilhas/enem-reta-final/matematica-o-essencial-numeros-e-proporcao)
