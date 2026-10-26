---
titulo: "Por que essas máquinas erram"
resumo: "Três fontes de erro: a alucinação, quando o modelo inventa com segurança; os dados de treino que não representam todo mundo; e o uso em decisões importantes sem revisão humana. E o que fazer diante de cada uma."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Hallucination (artificial intelligence)"
    autor: "Wikipédia (em inglês)"
    url: "https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)"
  - titulo: "Gender Shades: Intersectional Accuracy Disparities in Commercial Gender Classification"
    autor: "Joy Buolamwini e Timnit Gebru (PMLR 81)"
    ano: "2018"
    url: "https://proceedings.mlr.press/v81/buolamwini18a.html"
  - titulo: "Lei nº 13.709, de 14 de agosto de 2018 (Lei Geral de Proteção de Dados), artigo 20"
    autor: "Brasil, Presidência da República"
    url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm"
glossario:
  - termo: "alucinação"
    definicao: "Resposta de um sistema de IA com informação falsa ou enganosa apresentada como fato."
  - termo: "viés"
    definicao: "Erro sistemático que prejudica mais um grupo do que outro, muitas vezes porque o grupo estava mal representado nos dados."
  - termo: "revisão humana"
    definicao: "Uma pessoa conferir e poder mudar uma decisão tomada por máquina."
quiz:
  - pergunta: "O que é a alucinação de uma IA?"
    opcoes: ["Um defeito na tela", "Uma resposta com informação falsa ou enganosa apresentada como fato", "Um vírus"]
    resposta: 1
    explicacao: "Por exemplo, citações e referências inventadas."
  - pergunta: "Em que tipo de situação os erros de IA preocupam mais?"
    opcoes: ["Em jogos", "Em situações de alto risco, como diagnóstico médico", "Nunca preocupam"]
    resposta: 1
    explicacao: "Detectar e reduzir alucinações é um desafio para o uso nessas áreas."
  - pergunta: "Que grupo foi o mais mal classificado por três sistemas comerciais no estudo Gender Shades (2018)?"
    opcoes: ["Homens de pele clara", "Mulheres de pele escura, com erro de até 34,7%", "Crianças"]
    resposta: 1
    explicacao: "Os bancos de fotos usados eram, na maioria, de pessoas de pele clara."
  - pergunta: "Se uma decisão tomada só por máquina prejudicou você, o que diz a LGPD?"
    opcoes: ["Nada", "Você pode pedir a revisão dessa decisão (art. 20)", "Que a máquina sempre tem razão"]
    resposta: 1
    explicacao: "Vale, por exemplo, para decisões sobre crédito e perfil de consumo."
---

```provocacao
A máquina errou o seu nome, inventou um livro que não existe e não reconheceu o seu rosto na catraca. Foi azar? Ou existe um padrão nesses erros?
```

## O que você vai aprender

Ao fim desta aula você vai conhecer três fontes de erro da inteligência artificial e o que fazer diante de cada uma.

## 1. Inventar com segurança: a alucinação

Chama-se **alucinação** a resposta de um sistema de IA com **informação falsa ou enganosa apresentada como fato**. Assistentes baseados em modelos de linguagem podem misturar, num texto convincente, falsidades que **parecem verdade**, como **citações e referências inventadas**. Isso acontece porque o modelo gera o texto **provável**, e não confere se ele é **verdadeiro**.

Detectar e reduzir esses erros é um **desafio** para usar a IA em áreas de **alto risco**, como **diagnóstico médico**.

## 2. Os dados não representam todo mundo

Uma máquina só aprende o que está nos exemplos. Em **2018**, **Joy Buolamwini** e **Timnit Gebru** mostraram que dois bancos de fotos muito usados tinham **79,6%** e **86,2%** de pessoas de **pele clara**, e que três sistemas comerciais erravam mais com **mulheres de pele escura**, até **34,7%** das vezes. Quando um grupo está **mal representado** nos dados, o sistema erra **mais** com ele. Esse erro sistemático se chama **viés**.

## 3. Decidir sem gente conferindo

O erro fica perigoso quando a máquina **decide sozinha** algo importante: um crédito, uma vaga, uma abordagem policial. Por isso a **LGPD** (artigo 20) garante o direito de pedir a **revisão** de decisões tomadas **só por tratamento automatizado** que afetem seus interesses.

```navidareal
**O erro não cai igual para todos.** Quando o sistema que erra mais com pessoas negras é usado para identificar suspeitos, o erro vira abordagem, prisão e humilhação para quem já era mais vigiado. A aula sobre privacidade e vigilância volta a isso.
```

```verificar
Um assistente cita um "estudo da Universidade X de 2019" para provar o que diz. O que fazer?
- Confiar, porque tem até o ano
+ Procurar o estudo por conta própria antes de usar: o assistente pode ter inventado a referência
- Copiar no trabalho
> Citações inventadas são um exemplo clássico de alucinação.
```

## Exemplo resolvido

**Diante de cada erro, uma atitude.**

| Erro | Exemplo | O que fazer |
| --- | --- | --- |
| alucinação | referência que não existe | conferir em fonte confiável antes de usar |
| viés | sistema que não reconhece um grupo | denunciar, exigir dados representativos e testes |
| decisão sem revisão | crédito negado por máquina | pedir revisão com base no art. 20 da LGPD |

## Resumo

- **Alucinação**: informação falsa apresentada como fato; **confira sempre**.
- **Viés**: dados que não representam todos geram mais erro com alguns grupos (Gender Shades, 2018).
- **Decisões automáticas** importantes precisam de **revisão**: a LGPD garante pedir (art. 20).

```realidade
Pense numa vez em que uma máquina errou com você. Era alucinação, viés ou decisão sem revisão?
```

```roda
- Quem deve responder quando uma máquina erra: quem a fez, quem a usa ou ninguém?
- Por que o erro da máquina pesa mais sobre alguns grupos?
```

```leve
- Teste um assistente com uma pergunta cuja resposta você sabe. Ele errou?
- Conte a alguém o que foi o estudo Gender Shades.
```
