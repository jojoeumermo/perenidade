---
titulo: "Como funcionam os assistentes de texto"
resumo: "Os assistentes que escrevem, resumem e traduzem são modelos de linguagem: treinados com enormes quantidades de texto para prever a próxima palavra, depois ajustados para seguir instruções. O que isso explica sobre os acertos e os erros deles."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Large language model"
    autor: "Wikipédia (em inglês)"
    url: "https://en.wikipedia.org/wiki/Large_language_model"
  - titulo: "Hallucination (artificial intelligence)"
    autor: "Wikipédia (em inglês)"
    url: "https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)"
glossario:
  - termo: "modelo de linguagem"
    definicao: "Programa treinado com enormes quantidades de texto para gerar, resumir, traduzir e analisar textos."
  - termo: "prever a próxima palavra"
    definicao: "A tarefa básica do pré-treino: dado um começo de texto, calcular qual palavra provavelmente vem depois."
  - termo: "ajuste fino"
    definicao: "Treino extra, depois do pré-treino, para o modelo seguir instruções e se comportar como assistente."
quiz:
  - pergunta: "Qual é a tarefa básica com que os modelos do tipo GPT são pré-treinados?"
    opcoes: ["Decorar enciclopédias", "Prever a próxima palavra de um texto", "Conversar com pessoas"]
    resposta: 1
    explicacao: "Depois, são ajustados para seguir instruções e agir como assistentes."
  - pergunta: "Em que arquitetura a maioria desses modelos se baseia?"
    opcoes: ["Na rede neural do tipo transformer, de 2017", "Em planilhas", "Em regras escritas à mão"]
    resposta: 0
    explicacao: "Antes de 2017, os modelos de linguagem usavam outras técnicas, como os n-gramas e as redes recorrentes."
  - pergunta: "Por que dados de treino enviesados ou errados são um problema?"
    opcoes: ["Não são", "Porque tornam as respostas do modelo menos confiáveis", "Porque deixam o modelo mais rápido"]
    resposta: 1
    explicacao: "O modelo aprende o que está nos textos, inclusive os erros e preconceitos."
  - pergunta: "Como um assistente pode \"pesquisar na internet\" ou \"lembrar\" de conversas?"
    opcoes: ["O modelo sabe tudo sozinho", "Um programa em volta do modelo dá a ele ferramentas, como busca na web, e memória", "Não pode"]
    resposta: 1
    explicacao: "O modelo em si só gera texto; as ferramentas são acrescentadas por fora."
---

```provocacao
Você pergunta, e em segundos sai um texto bem escrito, seguro, cheio de detalhes. Quem escreveu isso? E por que, às vezes, está tudo errado com a mesma segurança?
```

## O que você vai aprender

Ao fim desta aula você vai entender, em linguagem simples, como funcionam os assistentes de texto e por que isso explica tanto os acertos quanto os erros deles.

## Um modelo de linguagem

Os assistentes de texto se baseiam em **modelos de linguagem grandes**: programas de **aprendizado de máquina**, quase sempre **redes neurais**, treinados com uma **enorme quantidade de texto**. Eles conseguem **gerar, resumir, traduzir e analisar** textos.

A maioria usa a arquitetura de rede neural chamada **transformer**, criada em **2017**. Antes disso, já existiam modelos de linguagem, mas menores, com outras técnicas.

## Prever a próxima palavra

Os modelos do tipo **GPT** são **pré-treinados** numa tarefa simples de dizer e difícil de fazer: **prever a próxima palavra** de um texto. De tanto fazer isso com uma quantidade enorme de texto, o modelo aprende padrões de gramática, de assunto e de estilo. Depois, passam por um **ajuste fino** para **seguir instruções** e se comportar como **assistentes**.

## O que vem por fora

Um programa em volta do modelo pode dar a ele **memória** e **ferramentas**, como **busca na internet**. Quando o assistente "pesquisa", é essa camada que busca; o modelo continua gerando texto.

## O que isso explica

- **Acertos**: o modelo viu muito texto e reproduz bem padrões comuns.
- **Erros**: ele gera o texto **provável**, não o **verdadeiro**. Por isso pode inventar, com a mesma segurança, uma citação ou uma referência que não existe. É o que se chama de **alucinação** (próxima aula).
- **Preconceitos**: se os textos do treino têm vieses ou erros, as respostas ficam **menos confiáveis**.

```verificar
Por que um assistente de texto pode inventar uma fonte que não existe?
- Porque quer enganar
+ Porque ele gera o texto mais provável a partir de padrões, e não confere se a informação é verdadeira
- Porque a internet acabou
> Releia "O que isso explica".
```

## Exemplo resolvido

**Brinque de "prever a próxima palavra".**

Frase: "Ninguém nasce sabendo que é ___"

| Palavra possível | Parece provável? |
| --- | --- |
| explorado | sim, combina com o resto |
| azul | não |
| feliz | talvez |

Um modelo de linguagem faz esse tipo de cálculo, palavra por palavra, com base em tudo o que leu. Ele escolhe o que **soa certo**, e não o que **é certo**: por isso, sempre **confira** o que ele diz.

## Resumo

- Assistentes de texto usam **modelos de linguagem** treinados com **muito texto**, quase sempre com a arquitetura **transformer** (2017).
- São **pré-treinados** para **prever a próxima palavra** e depois **ajustados** para seguir instruções.
- **Memória** e **busca** vêm de ferramentas em volta do modelo.
- Geram o texto **provável**, não o **verdadeiro**: **confira sempre**.

```realidade
Peça a um assistente de texto três fontes sobre um assunto que você conhece. Confira se as fontes existem de verdade.
```

```leve
- Explique a alguém o que é "prever a próxima palavra".
- Combine com amigos uma regra: nada tirado de assistente vai para trabalho sem conferir.
```
