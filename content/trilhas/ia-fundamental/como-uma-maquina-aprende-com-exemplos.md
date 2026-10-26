---
titulo: "Como uma máquina aprende com exemplos"
resumo: "O aprendizado supervisionado em linguagem simples: exemplos com a resposta certa, um modelo que procura o padrão e o teste com casos novos. Por que os exemplos precisam representar o mundo real, e o que acontece quando não representam."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Supervised learning"
    autor: "Wikipédia (em inglês)"
    url: "https://en.wikipedia.org/wiki/Supervised_learning"
  - titulo: "Gender Shades: Intersectional Accuracy Disparities in Commercial Gender Classification"
    autor: "Joy Buolamwini e Timnit Gebru (PMLR 81)"
    ano: "2018"
    url: "https://proceedings.mlr.press/v81/buolamwini18a.html"
  - titulo: "Inteligência Artificial: uma abordagem moderna"
    autor: "Stuart Russell e Peter Norvig"
    ano: "2021"
glossario:
  - termo: "aprendizado supervisionado"
    definicao: "Jeito de treinar uma máquina com exemplos que já vêm com a resposta certa (os rótulos), para ela aprender a acertar casos novos."
  - termo: "rótulo"
    definicao: "A resposta certa de cada exemplo: \"gato\", \"spam\", \"preço da casa\"."
  - termo: "generalizar"
    definicao: "Acertar casos que a máquina nunca viu no treino. É o objetivo do aprendizado."
quiz:
  - pergunta: "O que é um exemplo rotulado?"
    opcoes: ["Um exemplo sem resposta", "Um exemplo que vem com a resposta certa, como a foto de um gato marcada \"gato\"", "Uma etiqueta de roupa"]
    resposta: 1
    explicacao: "É com esses pares (entrada e resposta certa) que a máquina é treinada."
  - pergunta: "Qual é o objetivo do aprendizado supervisionado?"
    opcoes: ["Decorar os exemplos do treino", "Acertar casos novos, que a máquina nunca viu", "Gastar energia"]
    resposta: 1
    explicacao: "Isso se chama generalizar."
  - pergunta: "Prever o preço de uma casa é que tipo de tarefa?"
    opcoes: ["Classificação", "Regressão: prever um número", "Tradução"]
    resposta: 1
    explicacao: "Classificação põe numa categoria; regressão prevê um valor numérico."
  - pergunta: "Por que os exemplos do treino precisam representar o mundo real?"
    opcoes: ["Por enfeite", "Porque a máquina só aprende o padrão que está nos exemplos: se faltar um grupo, ela erra com esse grupo", "Não precisam"]
    resposta: 1
    explicacao: "O conjunto de treino precisa representar o uso real."
---

```provocacao
Ninguém escreveu, linha por linha, a regra "isto é um gato". Mesmo assim, o celular separa as fotos de gato das fotos de cachorro. Como ele aprendeu?
```

## O que você vai aprender

Ao fim desta aula você vai entender, sem fórmulas difíceis, como funciona o aprendizado supervisionado: exemplos com a resposta certa, a busca de um padrão e o teste com casos novos.

## Aprender com respostas certas

No **aprendizado supervisionado**, a máquina recebe **exemplos com a resposta certa**, chamados de **dados rotulados**: milhares de fotos marcadas "gato" e "cachorro", milhares de e-mails marcados "spam" e "não spam". O nome "supervisionado" vem da ideia de um **professor** que mostra a resposta. O sistema ajusta um **modelo** até ele acertar a maior parte desses exemplos.

## O objetivo: acertar o que nunca viu

O que importa não é decorar o treino, e sim **acertar casos novos**. Isso se chama **generalizar**. Por isso, depois de treinar, testa-se o modelo com exemplos que ele **nunca viu**.

## Dois tipos de tarefa

- **Classificação**: pôr numa **categoria** (spam ou não spam; gato ou cachorro).
- **Regressão**: prever um **número** (o preço de uma casa).

## Os exemplos decidem tudo

A máquina só aprende o padrão que **está nos exemplos**. Por isso, o **conjunto de treino** precisa **representar o uso real**. Em **2018**, as pesquisadoras **Joy Buolamwini** e **Timnit Gebru** mostraram que dois bancos de fotos muito usados para treinar análise de rostos tinham **79,6%** e **86,2%** de pessoas de **pele clara**, e que três sistemas comerciais erravam mais com **mulheres de pele escura**: até **34,7%** de erro. A aula sobre erros e a de privacidade voltam a isso.

```verificar
Um sistema foi treinado só com fotos de gatos tiradas de dia. O que provavelmente acontece com fotos de gatos à noite?
- Acerta tudo
+ Erra mais, porque os exemplos do treino não representavam essa situação
- Vira um sistema de cachorros
> O modelo só aprende o que está nos exemplos.
```

## Exemplo resolvido

**Treine "à mão" um classificador de frutas com quatro exemplos rotulados.**

| Peso (g) | Cor | Rótulo |
| --- | --- | --- |
| 150 | vermelha | maçã |
| 170 | vermelha | maçã |
| 120 | amarela | banana |
| 130 | amarela | banana |

Olhando os exemplos, um padrão simples aparece: **vermelha → maçã; amarela → banana**. Agora teste com uma fruta nova: **160 g, vermelha**. O modelo diz **maçã**: ele generalizou.

E uma **maçã verde**? Nenhum exemplo era verde: o "modelo" não sabe o que fazer. É o problema dos dados que não representam o mundo.

## Resumo

- No **aprendizado supervisionado**, a máquina treina com **exemplos rotulados** (com a resposta certa).
- O objetivo é **generalizar**: acertar **casos novos**.
- Tarefas: **classificação** (categoria) e **regressão** (número).
- O modelo só aprende o que está nos exemplos: o treino precisa **representar o mundo real**.

```realidade
Pense num sistema que tomou uma decisão sobre você (um crédito negado, uma conta bloqueada). Com que exemplos ele pode ter sido treinado?
```

```leve
- Explique a alguém o exemplo das frutas e o problema da maçã verde.
- Separe 10 fotos suas por categoria e pense: que padrão você usou?
```
