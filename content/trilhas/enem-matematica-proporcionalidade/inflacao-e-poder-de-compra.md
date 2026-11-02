---
titulo: "Inflação e poder de compra"
resumo: "O que é inflação, por que a inflação acumulada se multiplica, como ler um número-índice e como saber se um reajuste de salário ganhou ou perdeu da alta dos preços."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Inflação (IBGE Explica)"
    autor: "Instituto Brasileiro de Geografia e Estatística (IBGE)"
    url: "https://www.ibge.gov.br/explica/inflacao.php"
  - titulo: "IPCA em dezembro vai a 0,33% e acumula 4,26% em 2025"
    autor: "Agência de Notícias do IBGE"
    ano: "2026"
    url: "https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/45613-ipca-em-dezembro-vai-a-0-33-e-acumula-4-26-em-2025"
  - titulo: "Metas para a inflação"
    autor: "Banco Central do Brasil"
    url: "https://www.bcb.gov.br/controleinflacao/metainflacao"
  - titulo: "Contemporary Mathematics, seção 6.2, Discounts, Markups, and Sales Tax"
    autor: "Donna Kirk e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/6-2-discounts-markups-and-sales-tax"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "O que é inflação?"
    opcoes: ["A alta do preço de um único produto", "O aumento generalizado dos preços ao longo do tempo", "O aumento do salário mínimo", "A queda da taxa de juros"]
    resposta: 1
    explicacao: "Inflação é a alta dos preços em geral, de muitos produtos e serviços ao mesmo tempo. Um produto que sobe sozinho não é inflação."
  - pergunta: "A inflação foi de 10% num mês e de 10% no mês seguinte. A inflação acumulada nos dois meses foi de"
    opcoes: ["20%", "10%", "100%", "21%"]
    resposta: 3
    explicacao: "Os fatores se multiplicam: 1,1 × 1,1 = 1,21. Os preços ficaram 21% mais altos, e não 20%."
  - pergunta: "Num ano, um salário subiu 10% e a inflação também foi de 10%. O poder de compra desse salário"
    opcoes: ["subiu 10%", "caiu 10%", "ficou igual", "subiu 20%"]
    resposta: 2
    explicacao: "Salário e preços foram multiplicados pelo mesmo fator, 1,1. O salário compra a mesma quantidade de antes: 1,1 ÷ 1,1 = 1."
  - pergunta: "Um índice de preços passou de 100 para 112. A inflação no período foi de"
    opcoes: ["12%", "112%", "1,12%", "88%"]
    resposta: 0
    explicacao: "Com base 100, o índice 112 quer dizer que os preços estão 112% do que eram: subiram 12%."
---

```provocacao
No último ano, o seu salário subiu 5%. No mesmo período, os preços do que você compra subiram 8%. Você ganhou ou perdeu? E quanto?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é inflação, calcular a inflação acumulada de vários meses, ler um número-índice e dizer se um reajuste de salário ganhou ou perdeu da inflação, e por quanto. Tudo com o fator multiplicador, que você já conhece dos aumentos sucessivos.

## O que é inflação

**Inflação** é o aumento generalizado dos preços: de muitos produtos e serviços ao mesmo tempo, ao longo do tempo. Quando um só produto sobe, como o tomate na entressafra, isso não é inflação. Quando sobem a comida, o aluguel, a passagem e a conta de luz, é.

No Brasil, o IBGE mede a inflação com índices de preços. O mais conhecido é o IPCA, que o Banco Central usa como referência nas metas de inflação. O índice acompanha os preços de uma cesta de produtos e serviços e calcula quanto, em média, ela ficou mais cara.

O contrário da inflação é a **deflação**: uma queda geral dos preços, ou seja, uma inflação negativa.

## Inflação acumulada: os fatores se multiplicam

A inflação de cada mês incide sobre os preços que já subiram. É o mesmo caso dos aumentos sucessivos: não se somam as taxas, multiplicam-se os fatores.

Com 1% num mês e 2% no outro: 1,01 × 1,02 = 1,0302. A inflação acumulada é de 3,02%, e não de 3%. Com taxas pequenas, a diferença é pequena. Com taxas grandes, como 10% e 10%, ela aparece: 1,21, ou 21%.

## Número-índice

Muitas tabelas mostram um **número-índice**: um valor de referência, a **base**, vale 100, e os outros períodos são comparados com ele. Se o índice vai de 100 para 112, os preços subiram 12%.

Cuidado quando a base não é o ponto de partida da pergunta. Se o índice vai de 110 para 121, a alta não é de 11%. É 121 ÷ 110 = 1,1, ou seja, 10%. Os pontos do índice só viram porcentagem quando se parte de 100.

O número-índice também serve para trocar a base. Se um produto custava R$ 40,00 quando o índice valia 100, e o índice agora vale 115, o mesmo produto, acompanhando a média, custaria 40 × 1,15 = 46 reais. É assim que se "corrige pela inflação" um valor antigo: multiplica-se pelo fator do índice no período.

## Poder de compra: ganho real

**Poder de compra** é quanto o dinheiro consegue comprar. Ele depende do salário e dos preços ao mesmo tempo: é o salário dividido pelos preços.

O reajuste que aparece no contracheque é o **reajuste nominal**. O que importa para a vida é o **reajuste real**, o que sobra depois de descontar a inflação. E, de novo, não se subtraem as taxas: dividem-se os fatores.

```formula
1 + real = (1 + nominal) ÷ (1 + inflação)
o fator do ganho real é o fator do salário dividido pelo fator dos preços
real maior que zero: o salário ganhou da inflação; menor que zero: perdeu
```

Volte à provocação. O fator do salário é 1,05; o dos preços, 1,08. Então 1,05 ÷ 1,08 ≈ 0,972. O salário compra cerca de 97,2% do que comprava: uma perda real de cerca de 2,8%. Subtrair as taxas (5 − 8 = −3) dá uma boa ideia, mas não é a conta exata, e a prova pode cobrar a diferença.

```verificar
Os preços subiram 25%, e o salário ficou igual. Com ele, agora se compra:
- 25% a menos
+ 20% a menos
- 75% a menos
> O poder de compra é 1 ÷ 1,25 = 0,8 do que era. Compra-se 80%, ou seja, 20% a menos.
```

```navidareal
Nas negociações de salário, a inflação do período é o ponto de partida. Um reajuste igual à inflação só repõe o que se perdeu: o poder de compra fica igual. Ganho real é o que passa disso.

Um caso concreto: segundo o IBGE, o IPCA acumulou 4,26% em 2025. Quem teve reajuste de 4,26% naquele ano só ficou no zero a zero, em média.

Por isso, quem negocia precisa saber fazer a conta do reajuste real e conhecer o índice usado. O IBGE explica que a inflação de cada família pode ser diferente da média, porque cada uma tem a sua cesta de consumo. A aula [Inflação: o que é o IPCA](/trilhas/estatistica-para-ler-o-brasil/inflacao-o-que-e-o-ipca) mostra como isso é medido.
```

## Exemplo resolvido

**Um salário de R$ 2.000,00 passou para R$ 2.310,00 num ano em que a inflação foi de 5%. Houve ganho real? De quanto?**

1. Reajuste nominal: 2.310 ÷ 2.000 = 1,155, ou 15,5%.
2. Fator dos preços: 1,05.
3. Fator real: 1,155 ÷ 1,05. Como 1,05 × 1,1 = 1,155, o resultado é 1,1.
4. Ganho real de 10%.

Outro jeito de ver: para só repor a inflação, o salário iria a 2.000 × 1,05 = 2.100. Ele foi a 2.310, que é 2.100 × 1,1. Em poder de compra, é como ganhar 10% a mais que antes.

## Como isso cai no ENEM

- **Formatos:** reajuste de salário, de aluguel ou de aposentadoria comparado com a inflação; tabela de inflação mensal para achar a acumulada; número-índice com base 100; cesta de produtos de uma família com pesos diferentes; notícia ou gráfico de inflação para julgar uma afirmação.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma das 81 questões classificadas de Matemática foi marcada neste tópico. Ele usa as mesmas contas dos aumentos sucessivos (1 questão) e da porcentagem (5 questões, 6,2%). A H3 teve 12 das 81 questões (14,8%). São só duas provas: é tendência, não promessa.
- **Habilidades:** H3 (resolver problemas com conhecimentos numéricos), H4 (julgar se um resultado numérico faz sentido ao discutir uma afirmação com números) e H5 (avaliar propostas de intervenção na realidade usando conhecimentos numéricos), por exemplo uma proposta de reajuste.
- **Armadilhas:**
  - Somar as inflações mensais em vez de multiplicar os fatores.
  - Subtrair as taxas para achar o ganho real (dá uma aproximação, não a conta exata).
  - Ler os pontos do índice como porcentagem quando a base não é o ponto de partida.
  - Achar que inflação de 100% deixa o salário sem valor: ele passa a comprar a metade.

## Questão comentada

**Texto-base.** Uma associação de moradores acompanha um índice de preços da cesta de alimentos do bairro. Em janeiro, o índice foi fixado em 100. Em junho, ele estava em 104. Em dezembro, estava em 110,24.

**Comando.** De junho a dezembro, a alta dos preços da cesta foi de

A) 6%.
B) 6,24%.
C) 10,24%.
D) 4%.
E) 106%.

**Resolução.**

1. A pergunta parte de junho, não da base. Compare dezembro com junho: 110,24 ÷ 104.
2. Sem calculadora, teste: 104 × 1,06 = 104 + 6,24 = 110,24. Então a divisão dá 1,06.
3. O fator 1,06 quer dizer uma alta de 6%.

**Gabarito: A.**

**Por que as outras não:**

- B) 6,24%: são os pontos do índice (110,24 − 104). Pontos só viram porcentagem quando se parte de 100.
- C) 10,24%: é a alta desde janeiro, a base. A pergunta começa em junho.
- D) 4%: é a alta de janeiro a junho.
- E) 106%: é o fator lido como taxa. Os preços de dezembro são 106% dos de junho; a alta é o que passa de 100%.

```realidade
Escolha três coisas que você compra todo mês (por exemplo, arroz, gás e passagem). Anote o preço de hoje e procure o preço de um ano atrás, numa nota, num aplicativo do mercado ou na memória de alguém da casa. Calcule a alta de cada uma. A sua inflação pessoal foi maior ou menor que o reajuste do seu salário ou da sua renda?
```

## Resumo

- Inflação é a alta generalizada dos preços; deflação é a queda.
- Inflação acumulada: multiplique os fatores de cada período.
- Número-índice: com base 100, o índice menos 100 é a alta desde a base; entre outros dois períodos, divida um índice pelo outro.
- Poder de compra é salário dividido por preços.
- Ganho real: (1 + nominal) ÷ (1 + inflação) − 1. Reajuste igual à inflação só repõe.

## Para aprofundar

- [Inflação: o que é o IPCA](/trilhas/estatistica-para-ler-o-brasil/inflacao-o-que-e-o-ipca)
- [Preço, salário e inflação](/trilhas/economia-fundamental/preco-salario-e-inflacao)
- [Aumentos e descontos sucessivos](/trilhas/enem-matematica-proporcionalidade/aumentos-e-descontos-sucessivos)
- [Juros compostos](/trilhas/enem-matematica-proporcionalidade/juros-compostos)
