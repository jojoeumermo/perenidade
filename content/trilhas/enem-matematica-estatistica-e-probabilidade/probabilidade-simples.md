---
titulo: "Probabilidade simples"
resumo: "Medir a chance de algo acontecer contando casos: espaço amostral, evento, casos favoráveis sobre casos possíveis, e o cuidado de contar resultados que têm a mesma chance."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 3.1, Terminology"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-1-terminology"
  - titulo: "Algebra and Trigonometry 2e, seção 13.7, Probability"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/13-7-probability"
  - titulo: "Mega-Sena: como jogar e probabilidades"
    autor: "Caixa Econômica Federal"
    url: "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx"
  - titulo: "Blaise Pascal, biografia"
    autor: "MacTutor History of Mathematics, Universidade de St Andrews"
    url: "https://mathshistory.st-andrews.ac.uk/Biographies/Pascal/"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Ao lançar um dado comum, qual é a probabilidade de sair um número maior que 4?"
    opcoes: ["1/3", "1/2", "4/6", "1/6"]
    resposta: 0
    explicacao: "Maiores que 4 são o 5 e o 6: 2 casos de 6. 2/6 = 1/3."
  - pergunta: "Uma urna tem 3 bolas azuis, 5 brancas e 2 pretas. Tirando uma bola ao acaso, qual é a probabilidade de ela ser branca?"
    opcoes: ["1/5", "5/3", "1/3", "1/2"]
    resposta: 3
    explicacao: "São 5 brancas num total de 3 + 5 + 2 = 10 bolas. 5/10 = 1/2."
  - pergunta: "Duas moedas são lançadas. Qual é a probabilidade de saírem duas caras?"
    opcoes: ["1/2", "1/4", "1/3", "1"]
    resposta: 1
    explicacao: "Os resultados possíveis são cara-cara, cara-coroa, coroa-cara e coroa-coroa: 4, todos com a mesma chance. Duas caras é 1 deles: 1/4."
  - pergunta: "Qual destes números não pode ser uma probabilidade?"
    opcoes: ["0", "0,99", "1,2", "1/1000"]
    resposta: 2
    explicacao: "Probabilidade vai de 0 (impossível) a 1 (certo). 1,2 passa de 1, isto é, de 100%."
---

```provocacao
Num jogo, você lança dois dados e soma os pontos. As somas possíveis vão de 2 a 12: são 11 resultados. Então a chance de a soma dar 7 é 1 em 11? Pense antes de seguir. Esse raciocínio parece certo, mas tem um erro escondido.
```

## O que você vai aprender

Ao fim desta aula você vai saber calcular a probabilidade de um evento contando casos: montar o espaço amostral, separar os casos favoráveis e dividir. Vai saber escrever a resposta em fração, decimal e porcentagem, e vai saber evitar o erro mais comum: contar resultados que não têm a mesma chance.

## O acaso tem regras

Um **experimento aleatório** é uma situação em que não dá para saber o resultado antes, mesmo repetindo do mesmo jeito. Lançar uma moeda, tirar um número numa rifa, sortear um nome.

Não dá para saber o resultado de uma vez. Mas dá para medir a **chance** de cada resultado. É isso que a probabilidade faz.

Três palavras organizam tudo:

- **Espaço amostral:** o conjunto de todos os resultados possíveis. Num dado comum, {1, 2, 3, 4, 5, 6}.
- **Evento:** a parte do espaço amostral que interessa à pergunta. "Sair número par" é o evento {2, 4, 6}.
- **Casos favoráveis:** os resultados que fazem o evento acontecer. Aqui, 3.

## A conta

Quando todos os resultados do espaço amostral têm a **mesma chance** de sair, a probabilidade é uma divisão.

```formula
P(A) = casos favoráveis ÷ casos possíveis
a probabilidade de um evento A é o número de resultados em que ele acontece dividido pelo número total de resultados, todos com a mesma chance
o resultado fica sempre entre 0 (impossível) e 1 (certo)
```

No dado, P(par) = 3 ÷ 6 = 1/2. A mesma resposta pode ser escrita de três jeitos: **1/2**, **0,5** ou **50%**. Para passar de fração a porcentagem, divida e multiplique por 100.

Dois extremos ajudam a conferir:

- Um evento **impossível** tem probabilidade 0. Sair 7 num dado comum.
- Um evento **certo** tem probabilidade 1, ou 100%. Sair um número de 1 a 6.

Se a sua conta der mais que 1, ou um número negativo, há um erro.

## O erro escondido: resultados com a mesma chance

Volte à provocação. As somas de dois dados vão de 2 a 12, mas elas **não** têm a mesma chance. A soma 2 só sai de um jeito: 1 no primeiro dado e 1 no segundo. A soma 7 sai de seis jeitos.

Para contar certo, pense nos dois dados como diferentes, um azul e um vermelho. Cada dado tem 6 faces. Pelo princípio multiplicativo, são 6 × 6 = 36 pares, e cada par tem a mesma chance.

Somas iguais a 7: (1, 6), (2, 5), (3, 4), (4, 3), (5, 2) e (6, 1). São 6 pares.

P(soma 7) = 6 ÷ 36 = 1/6, e não 1/11.

A tabela mostra quantos pares dão cada soma:

| Soma | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pares | 1 | 2 | 3 | 4 | 5 | 6 | 5 | 4 | 3 | 2 | 1 |

Some a linha de baixo: dá 36. A soma 7 é a mais provável; 2 e 12 são as menos.

O mesmo cuidado vale para moedas. Com duas moedas, "uma cara e uma coroa" sai de dois jeitos (cara-coroa e coroa-cara), e por isso tem chance 2/4 = 1/2, o dobro de "duas caras".

## Quando a contagem é grande

Muitas vezes os casos possíveis são tantos que não dá para listar. Aí entra a contagem: o princípio multiplicativo, os arranjos e as combinações. A probabilidade continua sendo favoráveis ÷ possíveis; só que cada parte vem de uma conta.

## Probabilidade e frequência

Probabilidade 1/2 não quer dizer que, em 2 lançamentos de moeda, sai exatamente 1 cara. Quer dizer que, em **muitos** lançamentos, a parte de caras tende a ficar perto da metade. Em poucos lançamentos, pode sair qualquer coisa.

Às vezes a questão não dá um sorteio, e sim uma pesquisa: "de 400 lâmpadas testadas, 12 queimaram antes do prazo". Nesse caso, a **frequência observada**, 12 ÷ 400 = 3%, é usada como estimativa da probabilidade de uma lâmpada queimar.

```navidareal
Na Mega-Sena, a aposta simples marca 6 números entre 60. O número de apostas diferentes é 50.063.860, e só uma acerta os seis. A Caixa informa que a chance de acertar a sena com uma aposta simples é de 1 em 50.063.860.

Em porcentagem, isso dá cerca de 0,000002%. Repetir os mesmos números toda semana não aumenta a chance: cada sorteio começa do zero, com as mesmas 60 bolas.
```

```verificar
Lançando dois dados comuns, qual é a probabilidade de a soma dar 7?
- 1/11, porque há 11 somas possíveis
+ 6/36, porque 6 dos 36 pares dão soma 7
- 1/12, porque há 12 faces nos dois dados
> As 11 somas não têm a mesma chance. Os 36 pares (dado 1, dado 2) têm. Seis deles somam 7: 6/36 = 1/6.
```

```historia
# Pascal, Fermat e um jogo interrompido, França, 1654
No verão de 1654, os matemáticos franceses Blaise Pascal e Pierre de Fermat trocaram cinco cartas sobre problemas de jogos de dados. Um deles ficou conhecido como o problema dos pontos: se uma partida de apostas é interrompida antes do fim, como dividir o dinheiro de forma justa entre os jogadores?

Os dois resolveram o problema para uma partida de dois jogadores, pensando nos resultados possíveis do resto do jogo e em quantos deles cada jogador venceria.

Essa troca de cartas é considerada um dos começos da teoria da probabilidade: a ideia de medir o acaso contando casos.

Fonte: biografia de Blaise Pascal no MacTutor, Universidade de St Andrews.
```

## Exemplo resolvido

**Numa rifa da festa da escola, os bilhetes vão de 1 a 50, e um será sorteado. Calcule a probabilidade de o número sorteado: (a) ser múltiplo de 7; (b) ter os dois algarismos iguais; (c) ser maior que 50.**

1. **Casos possíveis:** 50 bilhetes, todos com a mesma chance.
2. **(a) Múltiplos de 7 até 50:** 7, 14, 21, 28, 35, 42 e 49. São 7 casos. P = 7/50 = 0,14 = 14%.
3. **(b) Algarismos iguais:** 11, 22, 33 e 44. O 55 passa de 50. São 4 casos. P = 4/50 = 0,08 = 8%.
4. **(c) Maior que 50:** nenhum bilhete. É um evento impossível. P = 0.

Confira: todas as respostas ficaram entre 0 e 1. E 7 × 7 = 49 é o último múltiplo de 7 antes de 50, o que confirma os 7 casos de (a).

## Como isso cai no ENEM

- **Formatos:** sorteios, rifas, dados, moedas, urnas com bolas, escolha ao acaso de uma pessoa num grupo descrito em tabela, controle de qualidade com dados de pesquisa. A resposta pode vir em fração, decimal ou porcentagem.
- **Habilidades:** H28 (resolver problemas de estatística e probabilidade), a principal, e H29 (usar estatística e probabilidade para construir argumentos).
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, de 81 questões de Matemática, nenhuma aparece na contagem com este tópico como principal. Mas a probabilidade simples é a base dos tópicos vizinhos que apareceram: probabilidade condicional (2 questões, 2,5%) e eventos independentes (2 questões, 2,5%). A H28 teve 4 questões (4,9%). São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Contar resultados que não têm a mesma chance, como as 11 somas de dois dados.
  - Trocar favoráveis e possíveis de lugar (e achar uma "probabilidade" maior que 1).
  - Esquecer casos ao listar: confira contando de outro jeito.
  - Dividir pelo número de tipos (3 cores) em vez do número de objetos (10 bolas).
  - Errar a passagem de fração para porcentagem.

## Questão comentada

**Texto-base.** Numa oficina de jogos de tabuleiro feita na biblioteca do bairro, um grupo criou um jogo em que cada jogador lança dois dados comuns e anda o número de casas igual à soma dos pontos. Para cair na casa do prêmio, um jogador precisa tirar soma 9 na próxima jogada.

**Comando.** A probabilidade de esse jogador cair na casa do prêmio na próxima jogada é

A) 1/11.
B) 1/9.
C) 1/18.
D) 1/6.
E) 2/21.

**Resolução.**

1. Dois dados dão 6 × 6 = 36 pares, todos com a mesma chance.
2. Pares com soma 9: (3, 6), (4, 5), (5, 4) e (6, 3). São 4.
3. P = 4/36 = 1/9.

**Gabarito: B.**

**Por que as outras não:**

- A) 1/11 trata as 11 somas possíveis (de 2 a 12) como se tivessem a mesma chance. Elas não têm.
- C) 1/18 é 2/36: você contou só (3, 6) e (4, 5), esquecendo que (6, 3) e (5, 4) são outros resultados.
- D) 1/6 é a probabilidade da soma 7, a mais comum. A pergunta é a soma 9.
- E) 2/21 conta os pares sem ordem (21 duplas como {3, 6}) como se tivessem a mesma chance. Uma dupla de números iguais, como {4, 4}, sai de um jeito só; uma de números diferentes sai de dois.

```realidade
Pense numa promessa de sorte que você já ouviu: "esse número está para sair", "essa máquina já vai pagar". Com o que você aprendeu, o que dá para dizer sobre ela? Escreva a sua resposta em duas frases.
```

## Resumo

- Espaço amostral: todos os resultados possíveis. Evento: os que interessam.
- P = favoráveis ÷ possíveis, quando todos os resultados têm a mesma chance.
- A probabilidade vai de 0 (impossível) a 1 (certo), ou de 0% a 100%.
- Dois dados: 36 pares, não 11 somas. Duas moedas: 4 resultados, não 3.
- Muitos casos: use a contagem para achar favoráveis e possíveis.

## Para aprofundar

- [Princípio fundamental da contagem](/trilhas/enem-matematica-estatistica-e-probabilidade/principio-fundamental-da-contagem)
- [União, complementar e probabilidade condicional](/trilhas/enem-matematica-estatistica-e-probabilidade/uniao-complementar-e-probabilidade-condicional)
- [Eventos independentes](/trilhas/enem-matematica-estatistica-e-probabilidade/eventos-independentes)
- [Probabilidade](/trilhas/matematica-medio/probabilidade)
