---
titulo: "Leitura de gráficos e tabelas"
resumo: "Como tirar informação de uma tabela e de um gráfico, e as perguntas a fazer antes de acreditar no que eles mostram."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 2.1, Stem-and-Leaf Graphs (Stemplots), Line Graphs, and Bar Graphs"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-1-stem-and-leaf-graphs-stemplots-line-graphs-and-bar-graphs"
  - titulo: "Como mentir com estatística"
    autor: "Darrell Huff"
    ano: "1954"
quiz:
  - pergunta: "Que tipo de gráfico é mais indicado para mostrar como um preço mudou ao longo dos meses?"
    opcoes: ["Gráfico de setores (pizza)", "Gráfico de linha", "Nenhum, só tabela serve"]
    resposta: 1
    explicacao: "A linha mostra bem a mudança no tempo: sobe, desce, fica parada."
  - pergunta: "Num gráfico de setores, quanto têm de somar todas as fatias?"
    opcoes: ["100%", "50%", "Depende do assunto"]
    resposta: 0
    explicacao: "O gráfico de setores mostra as partes de um todo. Juntas, elas formam o todo: 100%."
  - pergunta: "Um gráfico de barras começa o eixo vertical em 90, e não em 0. Qual é o efeito?"
    opcoes: ["Nenhum", "As diferenças entre as barras parecem maiores do que são", "As barras ficam todas iguais"]
    resposta: 1
    explicacao: "Cortar a base das barras estica as diferenças. Sempre leia os números do eixo."
---

## Para que servem

Uma **tabela** organiza informações em linhas e colunas, para você achar um valor exato. Um **gráfico** transforma os números em desenho, para você ver de uma vez a comparação ou a tendência. Contas de luz, exames, pesquisas eleitorais, notícias de economia: tudo isso chega em tabelas e gráficos. Saber ler é uma defesa.

Os números usados nos exemplos desta aula são **inventados para o exercício**.

## Lendo uma tabela

**Colheita de uma horta comunitária em um mês (dados de exemplo)**

| Produto | Quilos |
| --- | --- |
| Alface | 40 |
| Tomate | 80 |
| Cenoura | 30 |
| Couve | 50 |
| **Total** | **200** |

Antes dos números, leia o **título** (do que se trata?), os **cabeçalhos** das colunas (o que está sendo contado, e em que unidade?) e a **fonte** (quem levantou os dados, e quando?). Depois, procure cruzando linha e coluna: tomate, 80 kg.

Uma tabela permite fazer perguntas novas. Que parte da colheita foi de tomate? 80 em 200, isto é, 40%.

## Gráfico de barras

Cada barra representa uma categoria, e o comprimento mostra a quantidade. Serve para **comparar**.

```
Alface   ████████ 40
Tomate   ████████████████ 80
Cenoura  ██████ 30
Couve    ██████████ 50
```

De um relance: o tomate rendeu o dobro da alface. Para ler uma barra, vá da ponta dela até o eixo que traz os números.

## Gráfico de linha

Os pontos são ligados por uma linha. Serve para mostrar **mudança ao longo do tempo**.

**Preço do quilo de feijão em uma feira (dados de exemplo)**

| Mês | Janeiro | Fevereiro | Março | Abril |
| --- | --- | --- | --- | --- |
| Preço (R$) | 6,00 | 6,50 | 8,00 | 7,50 |

Em um gráfico de linha, esses dados formariam uma subida suave, uma subida forte em março e uma pequena queda em abril. O que interessa na linha é a **inclinação**: quanto mais em pé, mais rápida a mudança.

## Gráfico de setores

É a "pizza". O círculo inteiro é o total (100%), e cada fatia é uma parte. Serve para mostrar **como um todo se divide**. Na horta: tomate 40%, couve 25%, alface 20%, cenoura 15%. A soma tem de dar 100%.

Ele só faz sentido quando há um todo sendo repartido. E fica ruim de ler com muitas fatias pequenas.

```verificar
Você quer mostrar como o orçamento de uma associação de moradores foi dividido entre aluguel, luz, material e eventos. Qual gráfico é o mais indicado?
+ Gráfico de setores
- Gráfico de linha
- Nenhum gráfico serve para isso
> Há um todo (o orçamento) sendo repartido em partes.
```

## Cinco perguntas antes de acreditar

1. **Qual é o título?** Ele diz exatamente o que foi medido?
2. **O que há em cada eixo, e em que unidade?** Reais ou milhares de reais? Pessoas ou porcentagem?
3. **Onde começa a escala?** No zero?
4. **Qual é a fonte e a data?** Dado sem fonte é opinião.
5. **O que ficou de fora?** Por que este período, e não um mais longo?

## Como um gráfico engana

O jornalista Darrell Huff reuniu esses truques em 1954, no livro *Como mentir com estatística*. Eles continuam em uso.

**O eixo cortado.** Dois candidatos têm 48% e 52% em uma pesquisa. Num gráfico que comece no zero, as barras são quase iguais. Se o eixo começar em 45, a segunda barra fica com mais que o dobro da altura da primeira. Os números são os mesmos; a impressão, não.

```
Eixo começando em 0          Eixo começando em 45
A ████████████████████ 48    A ███ 48
B █████████████████████ 52   B ███████ 52
```

**O período escolhido a dedo.** Um preço que subiu durante anos e caiu no último mês pode virar "preço em queda" se o gráfico mostrar só as últimas semanas.

**O número sem comparação.** "Mil casos" é muito ou pouco? Depende do tamanho da população e de quanto era antes.

**O desenho que cresce para os dois lados.** Quando uma figura (uma moeda, uma casinha) representa o dobro do valor com o dobro da altura **e** da largura, ela ocupa quatro vezes mais espaço, e o olho vê quatro vezes mais.

Nada disso exige mentir nos números. Basta escolher como mostrar. Por isso a regra é: **leia os números, não só o desenho**. A trilha [Estatística para ler o Brasil](/trilhas/estatistica-para-ler-o-brasil) aprofunda esses cuidados.

## Para praticar

Use a tabela da horta e a tabela do feijão.

1. Quantos quilos a mais de couve do que de cenoura foram colhidos?
2. Que porcentagem da colheita foi de alface?
3. Em que mês o feijão teve a maior alta em relação ao mês anterior? De quanto?
4. De janeiro a abril, quanto o preço subiu em reais? E em porcentagem?
5. Pegue um gráfico de um jornal ou de uma conta de luz e responda às cinco perguntas desta aula.

**Respostas:** 1) 20 kg. 2) 20%. 3) Em março: R$ 1,50. 4) R$ 1,50, que são 25% de R$ 6,00.
