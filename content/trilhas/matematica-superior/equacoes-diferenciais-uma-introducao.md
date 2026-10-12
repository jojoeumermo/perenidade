---
titulo: "Equações diferenciais: uma introdução"
resumo: "Equações que descrevem como as coisas mudam: crescimento, decaimento, resfriamento e os limites do crescimento."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Calculus Volume 2, seção 4.1, Basics of Differential Equations"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-2/pages/4-1-basics-of-differential-equations"
  - titulo: "Calculus Volume 2, seção 4.3, Separable Equations"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-2/pages/4-3-separable-equations"
  - titulo: "Calculus Volume 2, seção 4.4, The Logistic Equation"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-2/pages/4-4-the-logistic-equation"
quiz:
  - pergunta: "O que é a solução de uma equação diferencial?"
    opcoes: ["Um número", "Uma função", "Um conjunto vazio"]
    resposta: 1
    explicacao: "A incógnita é uma função: procura-se a regra que descreve a grandeza ao longo do tempo."
  - pergunta: "Qual é a solução de y' = 3y com y(0) = 5?"
    opcoes: ["y = 5e^(3t)", "y = 3t + 5", "y = 15t"]
    resposta: 0
    explicacao: "Toda solução de y' = ky é da forma Ce^(kt). A condição inicial dá C = 5."
  - pergunta: "No modelo logístico, o que acontece com a população a longo prazo?"
    opcoes: ["Cresce sem limite", "Aproxima-se da capacidade de suporte do ambiente", "Cai a zero"]
    resposta: 1
    explicacao: "O crescimento freia à medida que a população se aproxima do máximo que o ambiente sustenta."
---

Nesta aula, y' é a [derivada](/trilhas/matematica-superior/derivadas) de y em relação ao tempo t, e e^(kt) é a exponencial de base e.

## A incógnita é uma função

Em uma equação comum, procura-se um número. Em uma **equação diferencial**, procura-se uma **função**, e o que se conhece é uma relação entre ela e a sua taxa de variação.

É a situação mais comum na ciência. Raramente se sabe de saída como uma grandeza evolui no tempo. O que se sabe é a **lei da mudança**: de que depende, a cada instante, a velocidade com que ela muda. Resolver a equação é passar da lei da mudança à evolução inteira.

## O caso mais simples: queda livre

Perto do chão, um corpo em queda ganha velocidade a uma taxa constante, g ≈ 9,8 m/s²:

v' = g

Que função tem derivada constante? Integrando: v(t) = gt + C. Se o corpo parte do repouso, v(0) = 0 e C = 0. Integrando de novo, a distância percorrida é s(t) = gt²/2, cerca de 4,9t². Galileu chegou a essa relação entre distância e quadrado do tempo por experimentos, antes de o cálculo existir.

Já aparece aqui um traço geral: a equação tem **infinitas soluções** (uma para cada valor de C). Para escolher uma, é preciso uma **condição inicial**: o estado do sistema em um instante.

## Crescer na proporção do que se tem

A equação diferencial mais importante de todas:

**y' = ky**

Ela diz: a taxa de variação é proporcional ao próprio valor. Quanto mais há, mais depressa cresce.

Para resolvê-la, separam-se as variáveis. Escrevendo y' como dy/dt:

```conta
dy/y = k dt
ln |y| = kt + c
= y = Ce^(kt)
```

O C é o valor inicial: y(0) = C. Confira derivando: a derivada de Ce^(kt) é k × Ce^(kt), isto é, k vezes a própria função.

Essa única equação descreve:

- **uma população** com alimento e espaço à vontade (k positivo);
- **uma dívida** a juros compostos creditados continuamente;
- **o decaimento radioativo** (k negativo): a cada instante, desintegra-se uma fração fixa dos átomos que restam;
- **a eliminação de um remédio** pelo organismo.

### Tempo de duplicação e meia-vida

Com k positivo, a quantidade dobra a cada intervalo de ln 2 ÷ k. Como ln 2 ≈ 0,693, uma grandeza que cresce a 2% ao ano (k = 0,02) dobra em cerca de 35 anos. É a origem da "regra do 70" vista na aula de [exponencial e logaritmo](/trilhas/matematica-medio/exponencial-e-logaritmo).

Com k negativo, a quantidade cai à metade a cada ln 2 ÷ |k|: é a **meia-vida**. Para o carbono-14, com meia-vida de cerca de 5.730 anos, k ≈ −0,000121 por ano.

```verificar
Verifique: a função y = 3e^(2t) é solução de qual equação?
- y' = 3y
+ y' = 2y
- y' = 6t
> Derive: y' = 3 × 2 × e^(2t). Compare com a própria função.
```

## O café que esfria

Newton observou que um corpo esfria a uma taxa proporcional à **diferença** entre a sua temperatura T e a do ambiente, Ta:

T' = −k(T − Ta)

Quanto mais quente em relação ao ambiente, mais rápido esfria; perto da temperatura ambiente, quase não muda. A solução é:

T(t) = Ta + (T0 − Ta) × e^(−kt)

em que T0 é a temperatura inicial. Um café a 90 °C, em uma sala a 20 °C, com k = 0,1 por minuto:

```conta
T(10) = 20 + (90 − 20) × e^(−1)
= 20 + 70 × 0,368
= cerca de 45,8 °C depois de 10 minutos
```

A diferença de temperatura decai exponencialmente. O café nunca fica mais frio que a sala.

## Nada cresce para sempre

O modelo y' = ky prevê crescimento sem limite. Nenhuma população real se comporta assim por muito tempo: a comida, o espaço e a água acabam. Em 1838, o matemático belga Pierre-François Verhulst propôs uma correção, a **equação logística**:

P' = rP × (1 − P/K)

- quando a população P é pequena em relação a K, o fator entre parênteses é quase 1, e o crescimento é praticamente exponencial;
- à medida que P se aproxima de K, o fator se aproxima de 0, e o crescimento freia;
- em P = K, o crescimento para.

O K é a **capacidade de suporte**: o máximo que o ambiente sustenta. O gráfico da solução é uma curva em S: arranque lento, disparada, freada e estabilização.

A curva em S aparece no crescimento de bactérias em um frasco, na difusão de uma tecnologia e na evolução de uma epidemia em que cada vez menos gente pode ser infectada. Os modelos de epidemias usados na saúde pública são sistemas de equações diferenciais que dividem a população em compartimentos (suscetíveis, infectados, recuperados); a formulação clássica é de Kermack e McKendrick, de 1927.

A lição passa da biologia para a economia. Um sistema que precisa crescer a uma taxa percentual constante, ano após ano, segue a equação y' = ky em um planeta que tem K. Uma das duas coisas terá de ceder.

## Quando não há fórmula

A maioria das equações diferenciais que interessam não tem solução em fórmula. Resolve-se, então, **numericamente**: anda-se em passos pequenos, usando a própria equação para saber a direção a cada passo. O método mais simples é o de Euler:

novo valor = valor atual + passo × taxa de variação atual

Para y' = y, com y(0) = 1 e passo 0,5:

```conta
y(0,5) ≈ 1 + 0,5 × 1 = 1,5
y(1) ≈ 1,5 + 0,5 × 1,5 = 2,25
= o valor exato é e ≈ 2,718; com passos menores, a aproximação melhora
```

É assim, com métodos mais refinados e bilhões de passos, que os computadores fazem a previsão do tempo, calculam a trajetória de um satélite e projetam o clima das próximas décadas.

## Modelo não é realidade

Uma equação diferencial é um **modelo**: uma hipótese sobre a lei da mudança. Suas previsões valem enquanto valer a hipótese. O modelo exponencial serve para os primeiros dias de uma epidemia e falha depois. O logístico supõe um K fixo, e a capacidade de suporte pode mudar. Diante de qualquer projeção ("neste ritmo, em 2050..."), a pergunta é: que lei de mudança foi suposta, e por que ela continuaria valendo?

## Para praticar

1. Mostre que y = 5e^(3t) é solução de y' = 3y. Quanto vale y(0)?
2. Uma população cresce segundo y' = 0,02y, com t em anos. Em quanto tempo ela dobra?
3. Um material radioativo tem meia-vida de 10 anos. Que fração resta depois de 30 anos?
4. Um corpo cai do repouso. Usando s(t) = 4,9t², que distância percorre em 3 segundos?
5. Use o método de Euler, com passo 0,1, para estimar y(0,2) em y' = 2y, com y(0) = 1.
6. Na equação logística, para que valores de P a população não muda?

**Respostas:** 1) y' = 15e^(3t) = 3 × 5e^(3t); y(0) = 5. 2) ln 2 ÷ 0,02 ≈ 35 anos. 3) 1/8. 4) 44,1 m. 5) y(0,1) ≈ 1,2; y(0,2) ≈ 1,44. 6) P = 0 e P = K.
