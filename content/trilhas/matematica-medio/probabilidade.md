---
titulo: "Probabilidade"
resumo: "Medir a chance: como calcular, como combinar eventos e por que a casa sempre ganha."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 13.7, Probability"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/13-7-probability"
  - titulo: "Introductory Statistics 2e, seção 3.1, Terminology"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-1-terminology"
  - titulo: "Mega-Sena (regras e probabilidades)"
    autor: "Caixa Econômica Federal"
    url: "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx"
quiz:
  - pergunta: "Ao lançar um dado comum, qual é a probabilidade de sair um número maior que 4?"
    opcoes: ["1/6", "1/3", "1/2"]
    resposta: 1
    explicacao: "São dois resultados favoráveis (5 e 6) em seis possíveis: 2/6 = 1/3."
  - pergunta: "Uma moeda honesta deu cara cinco vezes seguidas. Qual é a probabilidade de dar cara na sexta?"
    opcoes: ["Menor que 1/2, porque já saiu muita cara", "1/2", "Maior que 1/2, porque a moeda está com sorte"]
    resposta: 1
    explicacao: "A moeda não tem memória. Cada lançamento é independente dos anteriores."
  - pergunta: "Qual é a probabilidade de sair pelo menos uma cara em três lançamentos de uma moeda?"
    opcoes: ["1/2", "3/8", "7/8"]
    resposta: 2
    explicacao: "O contrário é não sair nenhuma cara: 1/2 × 1/2 × 1/2 = 1/8. Então 1 − 1/8 = 7/8."
---

## Medir a incerteza

Não se sabe se a moeda vai dar cara ou coroa, mas sabe-se que as duas faces têm a mesma chance. A **probabilidade** é um número que mede essa chance.

Alguns termos:

- **experimento aleatório:** aquele cujo resultado não se pode prever com certeza, como lançar um dado;
- **espaço amostral:** o conjunto de todos os resultados possíveis. No dado: {1, 2, 3, 4, 5, 6};
- **evento:** um subconjunto do espaço amostral. "Sair número par": {2, 4, 6}.

Quando todos os resultados têm a mesma chance:

**probabilidade = número de resultados favoráveis ÷ número de resultados possíveis**

A probabilidade de sair número par no dado é 3/6 = 1/2, ou 0,5, ou 50%.

A probabilidade vai sempre de **0** (impossível) a **1** (certo).

## O evento contrário

A probabilidade de um evento **não** acontecer é 1 menos a probabilidade de ele acontecer. Se a chance de chover é de 30%, a de não chover é de 70%.

Esse atalho resolve problemas com "pelo menos um". Qual é a probabilidade de sair pelo menos uma cara em três lançamentos? É mais fácil calcular o contrário (nenhuma cara, isto é, três coroas) e subtrair de 1:

```conta
P(três coroas) = 1/2 × 1/2 × 1/2 = 1/8
= P(pelo menos uma cara) = 1 − 1/8 = 7/8
```

## "Ou": somar

Para eventos que **não podem acontecer juntos**, a probabilidade de acontecer um **ou** outro é a soma. No dado, sair 1 ou sair 6: 1/6 + 1/6 = 2/6.

Se os eventos podem acontecer juntos, é preciso descontar a parte comum, para não contar duas vezes. Sair número par ou número maior que 4: os pares são {2, 4, 6} e os maiores que 4 são {5, 6}. O 6 está nos dois. Juntando, {2, 4, 5, 6}: probabilidade 4/6 = 2/3.

## "E": multiplicar

Dois eventos são **independentes** quando um não muda a chance do outro. A probabilidade de os dois acontecerem é o produto. Duas caras em dois lançamentos: 1/2 × 1/2 = 1/4.

Quando um evento muda a chance do outro, usa-se a probabilidade já ajustada. Em uma urna com 3 bolas vermelhas e 2 azuis, tiram-se duas bolas sem devolver. A probabilidade de as duas serem vermelhas:

```conta
primeira vermelha: 3/5
segunda vermelha, já tirada uma: 2/4
= 3/5 × 2/4 = 6/20 = 3/10
```

## Dois dados

Lançando dois dados, há 6 × 6 = 36 resultados igualmente prováveis. As somas não têm todas a mesma chance:

| Soma | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Maneiras de obter | 1 | 2 | 3 | 4 | 5 | 6 | 5 | 4 | 3 | 2 | 1 |

A soma 7 é a mais provável: 6/36 = 1/6. A soma 12 só sai de um jeito: 1/36.

```verificar
Em um baralho comum de 52 cartas, qual é a probabilidade de tirar um ás ao acaso?
+ 1/13
- 1/52
- 1/4
> Há 4 ases em 52 cartas. Simplifique a fração.
```

## A moeda não tem memória

Depois de cinco caras seguidas, muita gente aposta em coroa, "porque está na hora". É a **falácia do apostador**. A moeda não sabe o que saiu antes: a chance continua sendo 1/2.

O que a matemática garante é outra coisa: em um número muito **grande** de lançamentos, a proporção de caras se aproxima de 50%. Isso não acontece porque a moeda "compensa", e sim porque as sequências longas diluem os desvios. Em poucos lançamentos, tudo pode acontecer.

## Por que a casa sempre ganha

Para avaliar um jogo, calcula-se o **valor esperado**: quanto se ganha ou se perde, em média, por aposta, se o jogo for repetido muitas vezes.

Uma rifa vende 200 números a R$ 5 e sorteia um prêmio de R$ 600. Quem compra um número tem 1 chance em 200 de ganhar R$ 600. Em média, cada número "vale" 600 ÷ 200 = R$ 3, e custa R$ 5. O comprador perde, em média, R$ 2 por número; a soma dessas perdas é o que fica com quem organiza (R$ 400). Em uma rifa beneficente, isso é combinado e todo mundo sabe.

Nos jogos comerciais, a regra é a mesma, e nem sempre é dita. Na roleta com 37 casas, quem acerta um número recebe 35 vezes a aposta, mas a chance de acertar é de 1 em 37. Essa pequena diferença garante ao cassino, em média, cerca de 2,7% de tudo o que é apostado. Na Mega-Sena, a chance da aposta simples é de 1 em 50.063.860, e só uma parte do que é arrecadado volta em prêmios.

As casas de apostas esportivas, físicas ou de aplicativo, funcionam assim também: os prêmios são calculados de modo que, somando todos os apostadores, a empresa fique com uma parte. Um apostador pode ganhar em um dia. O conjunto dos apostadores, ao longo do tempo, perde: é disso que a empresa vive. Aposta não é investimento nem renda extra.

## Para praticar

1. Qual é a probabilidade de sair um múltiplo de 3 no lançamento de um dado?
2. Lançando duas moedas, qual é a probabilidade de saírem duas caras?
3. Em uma rifa de 200 números, você comprou 5. Qual é a sua chance de ganhar?
4. Em uma urna há 4 bolas brancas e 6 pretas. Tirando duas sem devolver, qual é a probabilidade de as duas serem brancas?
5. Qual é a probabilidade de a soma de dois dados ser 10 ou mais?
6. Uma peça sai com defeito em 2% das vezes. Qual é a probabilidade de duas peças seguidas saírem perfeitas?

**Respostas:** 1) 2/6 = 1/3. 2) 1/4. 3) 5/200 = 2,5%. 4) 4/10 × 3/9 = 2/15. 5) (3 + 2 + 1)/36 = 1/6. 6) 0,98 × 0,98 = 0,9604, cerca de 96%.
