---
titulo: "Porcentagem no noticiário"
resumo: "Por cento de quê? Pontos percentuais, base de comparação, altas e quedas em sequência e outras armadilhas das manchetes."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 6.2, Solve General Applications of Percent"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/6-2-solve-general-applications-of-percent"
  - titulo: "Como mentir com estatística"
    autor: "Darrell Huff"
    ano: "1954"
quiz:
  - pergunta: "Uma taxa passou de 8% para 10%. Qual frase está correta?"
    opcoes: ["Subiu 2%", "Subiu 2 pontos percentuais, o que representa um aumento de 25%", "Subiu 20%"]
    resposta: 1
    explicacao: "A diferença entre as duas taxas é de 2 pontos. Em relação à taxa inicial, 2 em 8 são 25%."
  - pergunta: "Um preço sobe 20% e depois cai 20%. Em relação ao começo, ele fica:"
    opcoes: ["igual", "4% mais barato", "4% mais caro"]
    resposta: 1
    explicacao: "De 100 vai a 120. Depois, 20% de 120 são 24: cai para 96."
  - pergunta: "O salário subiu 5% no ano e a inflação foi de 8%. O que aconteceu com o poder de compra?"
    opcoes: ["Subiu 5%", "Caiu cerca de 2,8%", "Ficou igual"]
    resposta: 1
    explicacao: "1,05 ÷ 1,08 ≈ 0,972. O salário compra cerca de 2,8% menos que antes."
---

Os exemplos numéricos desta aula são inventados para o exercício. O que importa é o raciocínio, que serve para qualquer notícia.

## Por cento de quê?

Toda porcentagem é uma fração de **alguma coisa**. "Aumento de 50%" não diz nada enquanto não se sabe 50% de quê. A primeira pergunta diante de qualquer porcentagem é: **qual é a base?**

Um município tinha 2 casos de uma doença e passou a ter 4. A manchete "casos dobram" e a manchete "dois casos a mais" descrevem o mesmo fato. A primeira assusta; a segunda, não. Quando a base é pequena, qualquer mudança vira uma porcentagem enorme. Por isso, exija sempre os **números absolutos** ao lado da porcentagem.

## Ponto percentual não é por cento

Esta é a confusão mais comum do noticiário.

A taxa de desocupação de uma região passou de 8% para 10%.

- Em **pontos percentuais**, subiu 2 (é a diferença simples: 10 − 8).
- Em **porcentagem**, subiu 25% (porque 2 é um quarto de 8).

As duas afirmações são verdadeiras. Dizer que "o desemprego subiu 2%" está errado, e a diferença não é pequena: aumento de 2% sobre 8% levaria a taxa a 8,16%.

O mesmo vale para juros (de 10% para 12% ao ano: 2 pontos, ou 20% de aumento) e para pesquisas eleitorais (de 20% para 25%: 5 pontos, ou 25% de crescimento). Quem quer exagerar escolhe o número maior; quem quer minimizar, o menor.

## Subir e descer não se anulam

Um preço de R$ 100 sobe 20% e depois cai 20%. Não volta a R$ 100:

```conta
100 + 20% de 100 = 120
120 − 20% de 120 = 120 − 24
= 96
```

A queda foi calculada sobre uma base maior. Pelo mesmo motivo, depois de uma queda de 50% é preciso um aumento de **100%** para voltar ao ponto de partida. Um salário que perde metade do poder de compra não se recupera com um reajuste de 50%.

Aumentos em sequência também não se somam: multiplicam-se. Dois reajustes de 10% dão 21%, e não 20%, porque o segundo incide sobre o valor já aumentado (1,10 × 1,10 = 1,21).

```verificar
Uma tarifa de ônibus de R$ 4,00 sobe 25%. Tempos depois, o prefeito anuncia que vai 'devolver o aumento' com uma redução de 20%. A tarifa volta a R$ 4,00?
+ Sim: 25% de aumento levam a R$ 5,00, e 20% de R$ 5,00 é R$ 1,00
- Não, fica em R$ 4,20
- Não, fica em R$ 3,80
> Faça as duas contas, cada uma sobre a sua base.
```

Repare que, para desfazer um aumento de 25%, basta uma redução de 20%. Se o anúncio fosse "reduzimos os mesmos 25%", a tarifa ficaria em R$ 3,75.

## Nominal e real

Um salário de R$ 2.000 reajustado em 5% vai a R$ 2.100. Se, no mesmo período, os preços subiram 8%, a cesta que custava R$ 2.000 custa R$ 2.160. O salário subiu no papel (**aumento nominal**) e encolheu no mercado (**perda real**).

```conta
1,05 ÷ 1,08 ≈ 0,972
= o salário compra cerca de 2,8% menos
```

Toda comparação de valores em reais entre datas diferentes precisa descontar a inflação. "Maior orçamento da história" e "recorde de arrecadação" são frases quase sempre verdadeiras em valores nominais, simplesmente porque os preços sobem todo ano. A aula sobre o [IPCA](/trilhas/estatistica-para-ler-o-brasil/inflacao-o-que-e-o-ipca) mostra como fazer a correção.

## Risco relativo e risco absoluto

"Produto X aumenta em 50% o risco da doença Y." Parece gravíssimo. Mas, se o risco era de 2 casos em cada 10.000 pessoas e passou a 3 em cada 10.000, o **risco relativo** subiu 50% e o **risco absoluto** subiu 1 caso em 10.000.

As duas informações importam, e a manchete costuma trazer só a primeira. O truque também funciona ao contrário: um remédio que "reduz o risco pela metade" pode estar reduzindo de 2 para 1 em 10.000.

## A porcentagem que troca de base

Imagine a frase: "A maioria dos acidentes de trânsito acontece perto de casa." Mesmo que seja verdade, isso não quer dizer que dirigir perto de casa seja mais perigoso: é perto de casa que as pessoas mais dirigem.

Sempre que aparecer "X% dos casos são do grupo A", pergunte que parte da população o grupo A representa. Se 70% dos internados por uma doença são vacinados em um lugar onde 95% da população é vacinada, os não vacinados (5% da população) respondem por 30% das internações: estão muito mais representados no hospital do que na rua.

## Um roteiro para ler manchetes

1. **Por cento de quê?** Qual é a base e qual é o número absoluto?
2. **Ponto ou por cento?** A notícia compara duas taxas?
3. **Em relação a quando?** Ao mês passado, ao mesmo mês do ano passado, ao pior momento da série?
4. **Nominal ou real?** A inflação foi descontada?
5. **Quem escolheu este número, e que outro número contaria a mesma história de outro jeito?**

## Para praticar

1. A aprovação de um governo foi de 40% para 46%. Quantos pontos percentuais subiu? E quanto por cento?
2. Um produto de R$ 80 sobe 25% e depois recebe um desconto de 25%. Qual é o preço final?
3. Uma ação caiu 50%. Quanto precisa subir para voltar ao valor inicial?
4. Três reajustes seguidos de 10% equivalem a um reajuste único de quanto?
5. Um salário foi reajustado em 4% em um ano de inflação de 6%. Houve ganho ou perda real? De quanto, aproximadamente?

**Respostas:** 1) 6 pontos percentuais; 15%. 2) R$ 75. 3) 100%. 4) 33,1%. 5) Perda de cerca de 1,9% (1,04 ÷ 1,06 ≈ 0,981).
