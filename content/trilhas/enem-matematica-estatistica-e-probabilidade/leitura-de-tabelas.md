---
titulo: "Leitura de tabelas"
resumo: "Achar o número certo numa tabela, calcular frequências e porcentagens, cruzar linhas e colunas e fazer contas com tabelas de preço por faixa."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 1.2, Data, Sampling, and Variation in Data and Sampling"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/1-2-data-sampling-and-variation-in-data-and-sampling"
  - titulo: "Introductory Statistics 2e, seção 3.4, Contingency Tables"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-4-contingency-tables"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Numa pesquisa com 50 pessoas, 20 responderam \"sim\". Qual é a frequência relativa do \"sim\"?"
    opcoes: ["20%", "40%", "50%", "2,5%"]
    resposta: 1
    explicacao: "Frequência relativa é a parte do total: 20 ÷ 50 = 0,4 = 40%."
  - pergunta: "Numa tabela de tarifa, até 10 m³ de água se pagam R$ 30 fixos e cada m³ acima de 10 custa R$ 4. Quanto paga quem gastou 15 m³?"
    opcoes: ["R$ 60", "R$ 30", "R$ 90", "R$ 50"]
    resposta: 3
    explicacao: "Os primeiros 10 m³ estão nos R$ 30 fixos. Passaram 5 m³, a R$ 4 cada: 5 × 4 = 20. Total: 30 + 20 = R$ 50."
  - pergunta: "Uma tabela mostra: 5 famílias sem filhos, 8 com 1 filho, 6 com 2 filhos e 1 com 3 ou mais. Quantas famílias têm no máximo 1 filho?"
    opcoes: ["13", "8", "19", "5"]
    resposta: 0
    explicacao: "No máximo 1 filho quer dizer 0 ou 1 filho: 5 + 8 = 13 famílias. Isso é a frequência acumulada até a linha do 1 filho."
  - pergunta: "Numa tabela de dupla entrada, com sexo nas linhas e situação de emprego nas colunas, o número da célula \"mulheres\" e \"empregadas\" representa:"
    opcoes: ["o total de mulheres", "o total de pessoas empregadas", "as pessoas que são mulheres e estão empregadas", "a porcentagem de mulheres na pesquisa"]
    resposta: 2
    explicacao: "Cada célula cruza uma linha com uma coluna: conta quem tem as duas características ao mesmo tempo. Os totais ficam na última linha e na última coluna."
---

```provocacao
A conta de água da sua casa chegou mais alta, mas você só gastou um pouco a mais que no mês passado. Como pode a conta subir mais do que o consumo?
```

## O que você vai aprender

Ao fim desta aula você vai saber achar um número numa tabela, calcular frequências e porcentagens a partir dela, cruzar linhas e colunas numa tabela de dupla entrada e fazer a conta de uma tarifa cobrada por faixas.

## Uma tabela é um mapa de números

Uma tabela organiza números em **linhas** (deitadas) e **colunas** (de pé). Cada número mora numa **célula**, o cruzamento de uma linha com uma coluna. Para achar um valor, ande pela linha certa até a coluna certa.

Antes de qualquer conta, leia quatro coisas:

1. **O título:** do que a tabela trata, onde e quando.
2. **Os cabeçalhos:** o que cada linha e cada coluna conta.
3. **A unidade:** reais, mil pessoas, quilos, porcentagem. "Em milhares" muda tudo.
4. **A fonte e as notas de rodapé:** às vezes a nota diz que um valor é estimado, ou que uma faixa inclui o limite.

Na prova, a tabela costuma ter mais números do que a questão usa. Isso é de propósito. Leia a pergunta antes e procure só o que ela pede.

## Frequência absoluta, relativa e acumulada

Numa pesquisa, a **frequência absoluta** é quantas vezes uma resposta apareceu. A **frequência relativa** é a parte que ela representa no total, em fração ou porcentagem.

```formula
frequência relativa = frequência ÷ total
a parte de uma resposta é o número de vezes que ela apareceu dividido pelo total de respostas
multiplique por 100 para ler em porcentagem
```

A **frequência acumulada** soma as linhas, da primeira até a que interessa. Ela responde perguntas como "quantos ganham até dois salários mínimos?" ou "quantas famílias têm no máximo um filho?". As palavras "até", "no máximo" e "pelo menos" pedem para juntar linhas.

- "No máximo 2": 0, 1 ou 2. Some essas linhas.
- "Pelo menos 2": 2 ou mais. Some essas, ou faça o total menos as de 0 e 1.

## Tabela de dupla entrada

A tabela de dupla entrada cruza duas características. Por exemplo: nas linhas, se a pessoa trabalha ou não; nas colunas, o turno em que estuda. Cada célula conta quem tem as duas coisas ao mesmo tempo. A última linha e a última coluna trazem os totais.

O segredo é saber **qual total usar** na porcentagem. Leia a pergunta palavra por palavra:

- "Que parte dos estudantes trabalha e estuda à noite?" O total é **todo mundo**.
- "Entre os que trabalham, que parte estuda à noite?" O total é **só quem trabalha**: o total daquela linha.
- "Entre os que estudam à noite, que parte trabalha?" O total é **só a coluna da noite**.

As três perguntas usam a mesma célula em cima e totais diferentes embaixo. Por isso dão respostas diferentes. A palavra "entre" é a pista: ela diz qual grupo é o todo.

## Tabelas de preço por faixa

Contas de água, de luz e o imposto de renda são cobrados **por faixas**. Cada faixa tem o seu preço, e quem gasta mais paga mais caro só pela parte que passa de cada limite.

O jeito seguro de calcular é quebrar o consumo em pedaços, um por faixa. Primeiro a parte que cabe na primeira faixa, depois a que cabe na segunda, e assim por diante. Cada pedaço paga o preço da sua faixa. No fim, some.

O erro mais comum é cobrar o consumo inteiro pelo preço da última faixa. Outro é esquecer a tarifa fixa da primeira faixa, que se paga mesmo gastando pouco.

```navidareal
Volte à provocação. Na cobrança por faixas, cada metro cúbico a mais pode cair numa faixa mais cara. Se você passou de um limite, os metros que passaram custam mais que os de antes. Por isso a conta pode subir mais, em proporção, do que o consumo.

A tabela de tarifas fica na página da companhia de água ou de luz da sua cidade. Com ela, você confere a sua própria conta.
```

```verificar
Numa pesquisa com 200 estudantes, 80 trabalham. Entre os que trabalham, 70 estudam à noite. Que porcentagem dos que trabalham estuda à noite?
- 35%
- 70%
+ 87,5%
> A palavra "entre" diz qual é o todo: os 80 que trabalham. 70 ÷ 80 = 0,875 = 87,5%. Dividir por 200 responde outra pergunta.
```

## Exemplo resolvido

**Uma companhia de água cobra conforme a tabela abaixo (valores de exemplo). Quanto paga uma família que gastou 27 m³ no mês?**

| Faixa de consumo | Preço |
| --- | --- |
| Até 10 m³ | R$ 40,00 fixos |
| De 10 a 20 m³ | R$ 5,00 por m³ que passa de 10 |
| Acima de 20 m³ | R$ 8,00 por m³ que passa de 20 |

1. Quebre os 27 m³ por faixa: os primeiros 10 m³ ficam na primeira faixa; de 10 a 20 há mais 10 m³; de 20 a 27, mais 7 m³. Confira: 10 + 10 + 7 = 27.
2. Primeira faixa: R$ 40,00 fixos.
3. Segunda faixa: 10 × 5 = R$ 50,00.
4. Terceira faixa: 7 × 8 = R$ 56,00.
5. Some: 40 + 50 + 56 = R$ 146,00.

Confira: se todos os 27 m³ fossem cobrados a R$ 8, a conta daria 27 × 8 = R$ 216, bem mais. Se você chegou a esse valor, cobrou tudo pela faixa mais cara.

## Como isso cai no ENEM

- **Formatos:** tabelas de preços, de tarifas por faixa, de resultados de pesquisa, de dupla entrada ou de dados de vários anos. A questão pede um valor, uma diferença, uma porcentagem, a linha que atende a um critério ou a conta de uma faixa.
- **Habilidades:** H25 (resolver problemas com dados de tabelas ou gráficos), a principal; H24 (fazer inferências a partir de gráficos ou tabelas); H26 (analisar gráficos ou tabelas para construir argumentos).
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, de 81 questões de Matemática, 2 (2,5%) foram de leitura de tabelas. A H25 teve 4 questões (4,9%), somando tabelas e gráficos. São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Pular a unidade ("em milhares", "em %").
  - Na dupla entrada, dividir pelo total errado. A palavra "entre" diz qual é o todo.
  - Em "até" e "no máximo", pegar só uma linha em vez de acumular.
  - Na tarifa por faixa, cobrar tudo pelo preço da última faixa ou esquecer a tarifa fixa.
  - Comparar números absolutos de grupos de tamanhos diferentes. Use a taxa ou a porcentagem.

## Questão comentada

**Texto-base.** Um cursinho popular perguntou aos seus 200 estudantes se trabalham e em que turno estudam. O resultado está na tabela.

| | Manhã | Noite | Total |
| --- | --- | --- | --- |
| Trabalham | 10 | 70 | 80 |
| Não trabalham | 90 | 30 | 120 |
| Total | 100 | 100 | 200 |

**Comando.** Entre os estudantes que trabalham, a porcentagem dos que estudam à noite é

A) 35%.
B) 40%.
C) 50%.
D) 70%.
E) 87,5%.

**Resolução.**

1. "Entre os que trabalham" diz qual é o todo: a linha "Trabalham", com 80 estudantes.
2. Desses, 70 estudam à noite.
3. A porcentagem é 70 ÷ 80. Simplifique por 10: 7 ÷ 8 = 0,875 = 87,5%.

**Gabarito: E.**

**Por que as outras não:**

- A) 35% é 70 ÷ 200: você dividiu pelo total da pesquisa. Isso responde "que parte de todos trabalha e estuda à noite".
- B) 40% é 80 ÷ 200, a parte dos estudantes que trabalham. Falta olhar só para a noite.
- C) 50% é 100 ÷ 200, a parte de todos que estuda à noite, trabalhando ou não.
- D) 70% é 70 ÷ 100: você dividiu pelo total da coluna da noite. Isso responde "entre os que estudam à noite, quantos trabalham".

```realidade
Pegue a sua última conta de luz ou de água. Procure a tabela de tarifas da companhia da sua cidade e refaça a conta do mês, faixa por faixa. O valor bateu? Se não bateu, que parte da conta você não tinha visto (taxa fixa, imposto, outro serviço)?
```

## Resumo

- Leia título, cabeçalhos, unidade e fonte antes de procurar os números.
- Frequência relativa = frequência ÷ total.
- "Até", "no máximo" e "pelo menos" pedem para somar linhas.
- Na dupla entrada, a palavra "entre" diz qual total vai embaixo da divisão.
- Em tarifas por faixa, quebre o consumo em pedaços e cobre cada pedaço pelo preço da sua faixa.

## Para aprofundar

- [Leitura de gráficos e tabelas](/trilhas/matematica-fundamental/leitura-de-graficos-e-tabelas)
- [Porcentagem](/trilhas/matematica-fundamental/porcentagem)
- [Porcentagem no noticiário](/trilhas/estatistica-para-ler-o-brasil/porcentagem-no-noticiario)
- [O que é uma pesquisa por amostragem](/trilhas/estatistica-para-ler-o-brasil/o-que-e-uma-pesquisa-por-amostragem)
- [Matemática: ler gráficos e tabelas](/trilhas/enem-por-area/matematica-ler-graficos-e-tabelas)
