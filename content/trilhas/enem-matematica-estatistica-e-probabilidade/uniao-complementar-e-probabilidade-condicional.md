---
titulo: "União, complementar e probabilidade condicional"
resumo: "A chance de algo não acontecer, de acontecer uma coisa ou outra, e de acontecer sabendo que outra já aconteceu: com tabela, sem fórmula decorada."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 3.1, Terminology"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-1-terminology"
  - titulo: "Introductory Statistics 2e, seção 3.3, Two Basic Rules of Probability"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-3-two-basic-rules-of-probability"
  - titulo: "Introductory Statistics 2e, seção 3.4, Contingency Tables"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-4-contingency-tables"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "A previsão diz que a chance de chover amanhã é de 30%. Qual é a chance de não chover?"
    opcoes: ["30%", "130%", "70%", "3%"]
    resposta: 2
    explicacao: "Chover e não chover são complementares: juntos dão 100%. 100% − 30% = 70%."
  - pergunta: "Ao lançar um dado comum, qual é a probabilidade de sair o número 2 ou um número ímpar?"
    opcoes: ["2/3", "1/2", "1/6", "4/3"]
    resposta: 0
    explicacao: "O 2 não é ímpar: os dois eventos não têm nada em comum. Some: 1/6 + 3/6 = 4/6 = 2/3."
  - pergunta: "Numa sala com 30 estudantes, 12 trabalham, e 8 dos que trabalham estudam à noite. Escolhendo ao acaso alguém que trabalha, qual é a probabilidade de essa pessoa estudar à noite?"
    opcoes: ["8/30", "12/30", "1/2", "2/3"]
    resposta: 3
    explicacao: "\"Alguém que trabalha\" reduz o grupo aos 12 que trabalham. Desses, 8 estudam à noite: 8/12 = 2/3."
  - pergunta: "Uma moeda é lançada duas vezes. Qual é a probabilidade de sair pelo menos uma cara?"
    opcoes: ["1/2", "3/4", "1/4", "1"]
    resposta: 1
    explicacao: "O contrário de \"pelo menos uma cara\" é \"nenhuma cara\", ou coroa e coroa: 1/4. Então a resposta é 1 − 1/4 = 3/4."
---

```provocacao
Um teste rápido para uma doença acerta 90% das pessoas doentes. O seu teste deu positivo. A chance de você ter a doença é de 90%? Guarde o seu palpite: a resposta vem no fim da explicação.
```

## O que você vai aprender

Ao fim desta aula você vai saber calcular a probabilidade de um evento não acontecer (o complementar), de acontecer um evento ou outro (a união) e de acontecer um evento sabendo que outro já aconteceu (a probabilidade condicional), usando tabelas e contagens.

## O ponto de partida

Probabilidade mede a chance de algo acontecer. Quando todos os resultados têm a mesma chance, ela é uma divisão:

```formula
P(A) = casos favoráveis ÷ casos possíveis
a probabilidade de um evento A é o número de resultados em que A acontece dividido pelo número de resultados possíveis
ela vai de 0 (impossível) a 1 (certo); em porcentagem, de 0% a 100%
```

O conjunto de todos os resultados possíveis se chama **espaço amostral**. Num dado comum, é {1, 2, 3, 4, 5, 6}. Um **evento** é uma parte dele: "sair par" é {2, 4, 6}, com probabilidade 3/6 = 1/2.

## O complementar: o que não acontece

O **complementar** de um evento é tudo o que não é ele. "Não sair 6" é o complementar de "sair 6". Juntos, os dois cobrem todas as possibilidades. Por isso:

P(não A) = 1 − P(A).

Esse atalho é ouro nas perguntas com **"pelo menos um"**. Calcular "pelo menos uma cara em três lançamentos" pede somar muitos casos. O contrário é um caso só: nenhuma cara, ou seja, três coroas, com chance 1/8. Então a resposta é 1 − 1/8 = 7/8.

Quando a pergunta diz "pelo menos um", pense primeiro no contrário: "nenhum".

## A união: um ou outro

A probabilidade de acontecer **A ou B** (um deles, ou os dois) se chama união. Se os eventos não têm nada em comum, basta somar. Esses eventos se chamam **mutuamente exclusivos**: um impede o outro.

Mas, se há resultados nos dois ao mesmo tempo, a soma conta esses resultados duas vezes. Então é preciso tirar uma vez:

P(A ou B) = P(A) + P(B) − P(A e B).

Exemplo: num sorteio de 1 a 20, há 10 pares e 6 múltiplos de 3 (3, 6, 9, 12, 15, 18). Os números 6, 12 e 18 estão nos dois grupos. "Par ou múltiplo de 3" tem 10 + 6 − 3 = 13 números. A probabilidade é 13/20 = 65%.

## A condicional: sabendo que algo aconteceu

Às vezes a questão dá uma informação antes: "sabendo que", "dado que", "entre os que", "se a pessoa escolhida for...". Essa informação **encolhe o espaço amostral**. Você deixa de olhar para todo mundo e olha só para o grupo que a informação aponta.

```formula
P(A | B) = P(A e B) ÷ P(B)
a probabilidade de A, sabendo que B aconteceu, é a parte de B em que A também acontece
lê-se "probabilidade de A dado B"; com contagens: casos de A dentro de B ÷ casos de B
```

Com uma tabela, não precisa da fórmula. Ache a linha ou a coluna do grupo que já se sabe e divida pelo total dela, e não pelo total geral.

A condicional também aparece em sorteios **sem reposição**, quando quem sai não volta. Num grupo de 4 mulheres e 2 homens, a chance de a primeira sorteada ser mulher é 4/6. Sabendo que saiu uma mulher, sobram 3 mulheres em 5 pessoas: a chance de a segunda também ser é 3/5. As duas juntas: 4/6 × 3/5 = 12/30 = 2/5. O segundo sorteio depende do primeiro.

A ordem importa muito. "Entre os doentes, quantos testam positivo" é diferente de "entre os que testam positivo, quantos estão doentes". Trocar uma pela outra é o erro mais caro deste tema.

```navidareal
Volte à provocação, com números de exemplo. Imagine 1.000 pessoas, das quais 2% têm a doença: 20 pessoas. O teste acerta 90% dos doentes: 18 dão positivo. Mas ele também dá positivo, por engano, em 5% das 980 saudáveis: 49 pessoas.

São 18 + 49 = 67 positivos. Desses, só 18 estão doentes. Sabendo que o teste deu positivo, a chance de ter a doença é 18 ÷ 67, perto de 27%, e não 90%.

Por isso, quando a doença é rara, um positivo costuma pedir um segundo exame para confirmar.
```

```verificar
Num grupo de 30 estudantes, 12 trabalham. Dos que trabalham, 8 estudam à noite. Escolhida ao acaso uma pessoa que trabalha, qual é a probabilidade de ela estudar à noite?
- 8/30
+ 8/12
- 12/30
> "Uma pessoa que trabalha" encolhe o grupo para os 12 que trabalham. Desses, 8 estudam à noite: 8/12 = 2/3.
```

## Exemplo resolvido

**Numa urna há fichas numeradas de 1 a 20. Uma ficha é sorteada. Calcule: (a) a probabilidade de sair par ou múltiplo de 3; (b) a probabilidade de não sair par nem múltiplo de 3; (c) sabendo que saiu um múltiplo de 3, a probabilidade de ser par.**

1. **Liste os grupos.** Pares: 10 números. Múltiplos de 3: 3, 6, 9, 12, 15, 18, ou seja, 6 números. Nos dois grupos: 6, 12 e 18, que são 3 números.
2. **(a) União.** 10 + 6 − 3 = 13 números. P = 13/20 = 65%.
3. **(b) Complementar.** "Nem par nem múltiplo de 3" é o contrário de (a): 1 − 13/20 = 7/20 = 35%. Confira contando: 1, 5, 7, 11, 13, 17, 19, que são 7 números.
4. **(c) Condicional.** Agora o grupo é só o dos 6 múltiplos de 3. Desses, 3 são pares. P = 3/6 = 1/2.

Confira: (a) e (b) somam 13/20 + 7/20 = 1, como todo par de complementares. Em (c), a resposta coincidiu com a chance de sair par sem informação nenhuma (10/20 = 1/2). Nem sempre é assim: na questão comentada, a informação muda bastante a resposta.

## Como isso cai no ENEM

- **Formatos:** sorteios, pesquisas apresentadas em tabela de dupla entrada, testes de saúde, controle de qualidade. A questão pede a chance de um evento não acontecer, de "pelo menos um", de um ou outro, ou de um evento dentro de um grupo ("sabendo que", "entre os que").
- **Habilidades:** H28 (resolver problemas de estatística e probabilidade), a principal; H29 (usar estatística e probabilidade para construir argumentos); H30 (avaliar propostas de intervenção usando estatística e probabilidade).
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, de 81 questões de Matemática, 2 (2,5%) foram deste tópico. A H28 teve 4 questões (4,9%). São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Na condicional, dividir pelo total geral em vez do total do grupo que já se sabe.
  - Trocar a ordem: P(A dado B) não é P(B dado A).
  - Na união, somar e esquecer de tirar quem está nos dois grupos.
  - Em "pelo menos um", somar casos um a um e esquecer algum. Faça 1 menos "nenhum".
  - Escrever probabilidade maior que 1 (ou que 100%). Se deu, a conta errou.

## Questão comentada

**Texto-base.** Uma associação de entregadores de aplicativo fez um levantamento com 500 trabalhadores sobre o uso de equipamento de proteção e os acidentes sofridos no último ano.

| | Teve acidente | Não teve acidente | Total |
| --- | --- | --- | --- |
| Usa equipamento | 30 | 270 | 300 |
| Não usa equipamento | 50 | 150 | 200 |
| Total | 80 | 420 | 500 |

**Comando.** Escolhendo ao acaso um dos trabalhadores que tiveram acidente, a probabilidade de ele não usar equipamento de proteção é

A) 25%.
B) 62,5%.
C) 10%.
D) 40%.
E) 16%.

**Resolução.**

1. "Um dos que tiveram acidente" diz qual é o grupo: a coluna "Teve acidente", com 80 trabalhadores.
2. Desses 80, os que não usam equipamento são 50.
3. P = 50 ÷ 80 = 5 ÷ 8 = 0,625 = 62,5%.

**Gabarito: B.**

**Por que as outras não:**

- A) 25% é 50 ÷ 200: a chance de ter acidente **entre os que não usam** equipamento. É a pergunta ao contrário.
- C) 10% é 50 ÷ 500: você dividiu pelo total da pesquisa. A informação "teve acidente" encolhe o grupo para 80.
- D) 40% é 200 ÷ 500, a parte dos que não usam equipamento na pesquisa toda, sem olhar os acidentes.
- E) 16% é 80 ÷ 500, a parte dos que tiveram acidente na pesquisa toda.

```realidade
Pense numa situação da sua vida em que alguém tirou uma conclusão trocando a ordem da pergunta. Por exemplo: "a maioria dos acidentes acontece perto de casa, então perto de casa é mais perigoso". Que informação faltaria para saber se a conclusão está certa?
```

## Resumo

- P(A) = favoráveis ÷ possíveis, entre 0 e 1.
- Complementar: P(não A) = 1 − P(A). "Pelo menos um" = 1 − "nenhum".
- União: P(A ou B) = P(A) + P(B) − P(A e B). Se não há nada em comum, só some.
- Condicional: "sabendo que" encolhe o grupo. Divida pelo total do grupo que já se sabe.
- P(A dado B) e P(B dado A) são perguntas diferentes.

## Para aprofundar

- [Probabilidade](/trilhas/matematica-medio/probabilidade)
- [Análise combinatória](/trilhas/matematica-medio/analise-combinatoria)
- [Correlação não é causa](/trilhas/estatistica-para-ler-o-brasil/correlacao-nao-e-causa)
- [Probabilidade e distribuições](/trilhas/matematica-superior/probabilidade-e-distribuicoes)
