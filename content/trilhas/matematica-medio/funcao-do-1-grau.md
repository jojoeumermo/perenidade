---
titulo: "Função do 1º grau"
resumo: "A função que cresce sempre no mesmo passo: valor inicial, taxa de variação e a reta que as desenha."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 4.1, Linear Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/4-1-linear-functions"
  - titulo: "Algebra and Trigonometry 2e, seção 4.2, Modeling with Linear Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/4-2-modeling-with-linear-functions"
quiz:
  - pergunta: "Na função f(x) = 2x − 6, qual é o zero (a raiz)?"
    opcoes: ["x = −6", "x = 3", "x = 2"]
    resposta: 1
    explicacao: "2x − 6 = 0 quando 2x = 6, isto é, x = 3."
  - pergunta: "Uma reta passa pelos pontos (1, 5) e (3, 11). Qual é a sua taxa de variação?"
    opcoes: ["2", "3", "6"]
    resposta: 1
    explicacao: "O y subiu 6 (de 5 para 11) enquanto o x andou 2 (de 1 para 3). 6 ÷ 2 = 3."
  - pergunta: "O que acontece com o gráfico de f(x) = ax + b quando a é negativo?"
    opcoes: ["A reta sobe", "A reta desce", "A reta fica deitada"]
    resposta: 1
    explicacao: "Com a negativo, cada passo em x faz o valor diminuir: a função é decrescente."
---

## Sempre o mesmo passo

Uma corrida custa R$ 4 de taxa fixa mais R$ 2 por quilômetro. A cada quilômetro, o preço sobe **sempre os mesmos** R$ 2, seja no primeiro ou no vigésimo. Esse é o traço da **função do 1º grau** (também chamada função afim):

f(x) = ax + b

- **b** é o **valor inicial**: quanto a função vale quando x é zero. Na corrida, os R$ 4.
- **a** é a **taxa de variação**: quanto a função muda a cada unidade de x. Na corrida, os R$ 2 por quilômetro.

O gráfico é sempre uma **reta**. O b mostra onde ela corta o eixo y; o a mostra a inclinação.

| Valor de a | A reta | Exemplo |
| --- | --- | --- |
| positivo | sobe (função crescente) | preço da corrida conforme a distância |
| negativo | desce (função decrescente) | água que resta na caixa conforme o uso |
| zero | fica deitada (função constante) | mensalidade fixa, use quanto usar |

## Função que desce

Uma caixa-d'água tem 600 litros e a casa gasta 50 litros por hora. A água que resta depois de t horas é:

f(t) = 600 − 50t

O valor inicial é 600 e a taxa é −50. A caixa esvazia quando f(t) = 0:

```conta
600 − 50t = 0
50t = 600
= t = 12 horas
```

Esse valor de x que zera a função chama-se **zero** ou **raiz**. No gráfico, é onde a reta corta o eixo x. Em geral, o zero de f(x) = ax + b é x = −b/a.

## Achando a regra a partir de dois valores

Dois pontos bastam para definir uma reta. Um trabalhador recebeu R$ 1.560 no mês em que fez 12 horas extras e R$ 1.680 no mês em que fez 20. Supondo salário fixo mais um valor por hora extra, qual é a regra?

**A taxa** é a variação do resultado dividida pela variação da entrada:

```conta
a = (1.680 − 1.560) ÷ (20 − 12)
a = 120 ÷ 8
= a = 15 reais por hora extra
```

**O valor inicial** sai de qualquer um dos pontos: 1.560 = 15 × 12 + b, logo b = 1.560 − 180 = 1.380.

A regra é f(x) = 1.380 + 15x. Com ela dá para conferir qualquer outro mês.

```verificar
Uma reta passa por (0, 3) e (2, 11). Qual é a função?
- f(x) = 3x + 4
+ f(x) = 4x + 3
- f(x) = 8x + 3
> O ponto (0, 3) já dá o valor inicial. A taxa é a subida (8) dividida pelo avanço (2).
```

## Comparando duas opções

Dois aplicativos de transporte:

- A cobra R$ 4 fixos e R$ 2 por km: f(x) = 4 + 2x.
- B cobra R$ 10 fixos e R$ 1,50 por km: g(x) = 10 + 1,5x.

Qual é mais barato? Depende da distância. Veja onde os dois empatam:

```conta
4 + 2x = 10 + 1,5x
0,5x = 6
= x = 12 km
```

Até 12 km, A sai mais barato (começa de mais baixo). Depois de 12 km, B passa a compensar (sobe mais devagar). No gráfico, é o ponto em que as duas retas se cruzam. O mesmo raciocínio serve para comparar planos de celular, tarifas de energia e formas de contratar um serviço.

## Proporção direta é um caso particular

Quando b = 0, a função fica f(x) = ax e a reta passa pela origem. É a **proporcionalidade direta**: dobro de x, dobro do resultado. O preço de x quilos de feijão a R$ 8 o quilo é f(x) = 8x.

Com b diferente de zero, isso deixa de valer. Na corrida, 5 km custam R$ 14 e 10 km custam R$ 24, que não é o dobro. É por isso que a [regra de três](/trilhas/matematica-fundamental/regra-de-tres) falha quando existe uma parte fixa.

## O limite do modelo

A função do 1º grau supõe que o ritmo nunca muda. Serve bem para trechos curtos e engana em prazos longos. Uma dívida não cresce em reta, cresce em curva, porque os juros incidem sobre os juros: é o assunto das aulas de [função exponencial](/trilhas/matematica-medio/exponencial-e-logaritmo) e de [juros](/trilhas/matematica-medio/juros-simples-e-compostos). Antes de usar uma reta para prever qualquer coisa, pergunte se o passo é mesmo constante.

## Para praticar

1. Em f(x) = 2x − 6, calcule f(0), f(5) e o zero da função.
2. Ache a função cuja reta passa por (1, 5) e (3, 11).
3. Um tanque tem 60 litros e o motor consome 5 litros por hora. Escreva a função e diga em quanto tempo o tanque esvazia.
4. Uma gráfica cobra R$ 50 pela arte mais R$ 0,20 por panfleto. Outra cobra R$ 0,30 por panfleto, sem taxa. A partir de quantos panfletos a primeira compensa?
5. A função f(x) = −3x + 12 é crescente ou decrescente? Onde corta os dois eixos?

**Respostas:** 1) −6, 4 e x = 3. 2) f(x) = 3x + 2. 3) f(t) = 60 − 5t; 12 horas. 4) Acima de 500 panfletos. 5) Decrescente; corta o eixo y em 12 e o eixo x em 4.
