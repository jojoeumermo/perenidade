---
titulo: "Relatividade restrita"
resumo: "Objetivo: deduzir as consequências dos postulados de Einstein: relatividade da simultaneidade, dilatação do tempo, contração do comprimento, transformações de Lorentz e a equivalência entre massa e energia."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "University Physics, volume 3, seção 5.2, Relativity of Simultaneity"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/5-2-relativity-of-simultaneity"
  - titulo: "University Physics, volume 3, seção 5.3, Time Dilation"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/5-3-time-dilation"
  - titulo: "University Physics, volume 3, seção 5.5, The Lorentz Transformation"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/5-5-the-lorentz-transformation"
  - titulo: "University Physics, volume 3, seção 5.9, Relativistic Energy"
    autor: "Samuel J. Ling, Jeff Sanny, William Moebs (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/university-physics-volume-3/pages/5-9-relativistic-energy"
quiz:
  - pergunta: "Quanto vale o fator de Lorentz γ para v = 0,8c?"
    opcoes: ["0,6", "1,25", "1,67"]
    resposta: 2
    explicacao: "γ = 1/√(1 − 0,64) = 1/0,6 ≈ 1,67."
  - pergunta: "O que é o tempo próprio?"
    opcoes: ["O tempo medido por um relógio em repouso em relação aos eventos medidos", "O tempo medido por qualquer relógio", "O tempo que a luz leva para atravessar o universo"]
    resposta: 0
    explicacao: "Os outros observadores medem um intervalo maior: Δt = γ·Δt₀."
  - pergunta: "Dois eventos simultâneos para um observador são simultâneos para todos?"
    opcoes: ["Sim, sempre", "Não, se ocorrem em lugares diferentes e os observadores se movem um em relação ao outro", "Só no vácuo"]
    resposta: 1
    explicacao: "É a relatividade da simultaneidade."
  - pergunta: "Qual é a energia de repouso de uma partícula de massa m?"
    opcoes: ["m·c²", "m·v²/2", "Zero"]
    resposta: 0
    explicacao: "Mesmo parada, a partícula tem energia E₀ = m·c²."
---

## O ponto de partida

Na aula de [Física moderna](/trilhas/fisica-medio/fisica-moderna-relatividade-e-quantica), vimos os dois postulados de Einstein (1905):

1. As leis da física são as mesmas em todos os **referenciais inerciais**.
2. A **velocidade da luz no vácuo**, c, é a mesma em todos esses referenciais.

Aqui, vamos tirar deles as consequências com algumas contas. Elas surgem de uma exigência simples: c tem de ser igual para todos. O enigma deixado pelas [equações de Maxwell](/trilhas/fisica-superior/eletromagnetismo-e-as-equacoes-de-maxwell) se resolve assim.

## A simultaneidade é relativa

Um vagão anda depressa. Uma lâmpada no meio dele pisca. Para quem está **dentro** do vagão, a luz chega às duas portas ao mesmo tempo: os eventos são simultâneos.

Para quem está **na plataforma**, a luz também anda a c nos dois sentidos, mas a porta de trás vem ao encontro da luz e a da frente foge dela. A luz chega **primeiro** à porta de trás.

Dois eventos simultâneos em um referencial podem não ser simultâneos em outro. Não há um "agora" universal.

## O relógio de luz e a dilatação do tempo

Imagine um relógio feito de dois espelhos, com um pulso de luz indo e voltando entre eles, a uma distância L.

- Para quem viaja com o relógio, o pulso sobe e desce na vertical. O tempo de uma ida e volta é o **tempo próprio**: Δt₀ = 2L/c.
- Para quem vê o relógio passar a velocidade v, o pulso faz um caminho em diagonal, mais longo. Como c é a mesma, o tempo é maior.

Pelo teorema de Pitágoras, chega-se a:

**Δt = γ · Δt₀**, com **γ = 1 / √(1 − v²/c²)**

| v / c | γ |
| --- | --- |
| 0,1 | 1,005 |
| 0,5 | 1,155 |
| 0,6 | 1,25 |
| 0,8 | 1,667 |
| 0,99 | 7,09 |

Para velocidades do cotidiano, γ é praticamente 1, e a física de Newton funciona.

### Prova experimental: os múons

Os **múons** são partículas instáveis produzidas pelos raios cósmicos na alta atmosfera, a muitos quilômetros de altura. Em repouso, vivem em média cerca de 2,2 milionésimos de segundo. Sem a dilatação do tempo, mesmo à velocidade da luz, quase nenhum chegaria ao solo. Mas chegam muitos: como viajam a velocidades próximas de c, o seu "relógio" anda mais devagar visto da Terra.

```conta
Múon com v = 0,99c (γ ≈ 7,09). Vida média própria: 2,2 × 10⁻⁶ s
vida média vista da Terra: 7,09 × 2,2 × 10⁻⁶ ≈ 1,56 × 10⁻⁵ s
distância média percorrida: 0,99 × 3 × 10⁸ × 1,56 × 10⁻⁵ ≈ 4 600 m
(sem a relatividade seriam cerca de 650 m)
```

## Contração do comprimento

Um objeto em movimento é medido **mais curto** na direção do movimento:

**L = L₀ / γ**

em que L₀ é o **comprimento próprio**, medido em repouso em relação ao objeto. Do ponto de vista do múon, não é o tempo dele que se dilata: é a atmosfera que se contrai. As duas descrições dão o mesmo resultado.

## As transformações de Lorentz

As transformações de Galileu (x′ = x − v·t; t′ = t) são substituídas por:

**x′ = γ·(x − v·t)**
**t′ = γ·(t − v·x/c²)**

O tempo e o espaço se misturam: passam a formar o **espaço-tempo**. Quando v é muito menor que c, γ ≈ 1 e o termo v·x/c² some, e volta-se a Galileu.

Uma consequência: velocidades não se somam simplesmente. A fórmula relativística garante que **nenhuma** soma de velocidades menores que c dá mais que c.

```verificar
Uma nave a 0,6c em relação à Terra passa por um relógio na Terra. Para cada 1 hora marcada pelo relógio da nave, quanto tempo passa na Terra, segundo os observadores terrestres?
- 48 minutos
+ 1 hora e 15 minutos
- 1 hora e 40 minutos
> Para v = 0,6c, γ = 1,25.
```

## Energia e momento

As leis de conservação continuam valendo, desde que o momento e a energia sejam redefinidos:

- momento: **p = γ·m·v**;
- energia total: **E = γ·m·c²**;
- energia de repouso: **E₀ = m·c²**;
- energia cinética: **K = (γ − 1)·m·c²**.

Para v pequeno, K se reduz ao conhecido m·v²/2.

A relação geral é **E² = (p·c)² + (m·c²)²**. Para uma partícula sem massa, como o fóton, E = p·c.

Como γ cresce sem limite quando v se aproxima de c, a energia necessária para acelerar uma partícula com massa até c seria **infinita**. Nos aceleradores de partículas, os prótons chegam a velocidades extremamente próximas da de c, mas nunca a alcançam.

## Uma teoria testada todos os dias

A relatividade restrita é confirmada nos aceleradores, na física nuclear, nos relógios atômicos e na correção dos satélites de GPS. Não é especulação: é engenharia.

## Para praticar

1. Calcule γ para v = 0,9c.
2. Uma barra de 10 m em repouso passa por você a 0,8c. Que comprimento você mede?
3. Calcule a energia cinética de um elétron (m = 9,11 × 10⁻³¹ kg) a 0,6c.
4. Explique com as suas palavras por que não existe um "agora" válido para todo o universo.
