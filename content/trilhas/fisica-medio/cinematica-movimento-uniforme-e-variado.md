---
titulo: "Cinemática: movimento uniforme e variado"
resumo: "Objetivo: descrever movimentos com posição, velocidade e aceleração, usar as equações do movimento uniforme e do uniformemente variado e aplicá-las à frenagem e à queda livre."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 2.2, Speed and Velocity"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/2-2-speed-and-velocity"
  - titulo: "Physics, seção 3.1, Acceleration"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/3-1-acceleration"
  - titulo: "Physics, seção 3.2, Representing Acceleration with Equations and Graphs"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/3-2-representing-acceleration-with-equations-and-graphs"
quiz:
  - pergunta: "Um carro a 72 km/h está a quantos metros por segundo?"
    opcoes: ["20 m/s", "7,2 m/s", "259 m/s"]
    resposta: 0
    explicacao: "Para passar de km/h para m/s, divide-se por 3,6: 72 ÷ 3,6 = 20."
  - pergunta: "No movimento uniforme, o que permanece constante?"
    opcoes: ["A posição", "A velocidade", "A aceleração, diferente de zero"]
    resposta: 1
    explicacao: "No movimento uniforme a velocidade não muda; logo, a aceleração é zero."
  - pergunta: "Um carro que freia com a mesma desaceleração dobra a velocidade inicial. O que acontece com a distância de frenagem?"
    opcoes: ["Dobra", "Fica quatro vezes maior", "Não muda"]
    resposta: 1
    explicacao: "A distância depende do quadrado da velocidade: v² = 2·a·Δs."
  - pergunta: "Desprezando a resistência do ar, um martelo e uma pena soltos da mesma altura chegam ao chão:"
    opcoes: ["O martelo muito antes", "Ao mesmo tempo", "A pena antes"]
    resposta: 1
    explicacao: "Na queda livre, todos os corpos têm a mesma aceleração, a da gravidade."
---

## Descrever antes de explicar

A **cinemática** é a parte da física que **descreve** os movimentos: onde o corpo está, com que rapidez anda, como a velocidade muda. Ela não pergunta pela causa; isso fica para a [dinâmica](/trilhas/fisica-medio/dinamica-aplicacoes-das-leis-de-newton).

Esta aula retoma, com mais ferramentas, o que foi visto em [Movimento e velocidade média](/trilhas/fisica-fundamental/movimento-e-velocidade-media).

## Referencial, posição e deslocamento

Todo movimento é descrito em relação a um **referencial**. Um passageiro sentado no ônibus está parado em relação ao ônibus e em movimento em relação à rua.

- **Posição** (s): onde o corpo está, medido a partir de uma origem.
- **Deslocamento** (Δs): a diferença entre a posição final e a inicial.
- **Distância percorrida**: o total do caminho.

Quem vai de casa ao trabalho e volta percorreu uma distância grande, mas o deslocamento foi **zero**.

## Velocidade

A **velocidade média** é o deslocamento dividido pelo tempo gasto:

**v = Δs ÷ Δt**

No Sistema Internacional, mede-se em **m/s**. Para converter:

- de km/h para m/s: **dividir por 3,6**;
- de m/s para km/h: **multiplicar por 3,6**.

## Movimento uniforme (MU)

No movimento uniforme, a **velocidade é constante**: o corpo percorre distâncias iguais em tempos iguais. A posição em cada instante é:

**s = s₀ + v·t**

em que s₀ é a posição inicial.

```conta
Um trem passa pelo km 10 a 20 m/s. Onde estará depois de 5 minutos?
5 min = 300 s
s = 10 000 + 20 × 300 = 16 000 m (km 16)
```

## Aceleração

Quando a velocidade muda, há **aceleração**:

**a = Δv ÷ Δt**

A unidade é o **m/s²**: quantos metros por segundo a velocidade ganha (ou perde) a cada segundo. Um carro que vai de 0 a 20 m/s em 10 s tem aceleração de 2 m/s².

## Movimento uniformemente variado (MUV)

No MUV, a **aceleração é constante**. Três equações resolvem quase tudo:

| Equação | Quando usar |
| --- | --- |
| v = v₀ + a·t | velocidade em função do tempo |
| s = s₀ + v₀·t + a·t² ÷ 2 | posição em função do tempo |
| v² = v₀² + 2·a·Δs | quando o tempo não aparece (equação de Torricelli) |

### Frenagem: a conta que salva vidas

Um carro a 72 km/h (20 m/s) freia com desaceleração de 5 m/s². Que distância percorre até parar?

```conta
v² = v₀² + 2·a·Δs
0 = 20² + 2 × (−5) × Δs
0 = 400 − 10·Δs
Δs = 40 m
```

Agora o mesmo carro a 36 km/h (10 m/s):

```conta
0 = 10² − 10·Δs
Δs = 10 m
```

Metade da velocidade, **um quarto** da distância. Ou, ao contrário: **dobrar a velocidade quadruplica a distância de frenagem**. Por isso os limites de velocidade perto de escolas e travessias não são capricho: a 30 km/h o motorista para a tempo; a 60 km/h, não.

E ainda falta somar a distância percorrida durante o **tempo de reação**, enquanto o motorista percebe o perigo e pisa no freio.

```verificar
Um carro a 108 km/h (30 m/s) freia com desaceleração de 5 m/s². Qual é a distância de frenagem?
- 60 m
+ 90 m
- 30 m
> Use v² = v₀² + 2·a·Δs com v = 0: 900 = 10·Δs.
```

## Queda livre

Perto da superfície da Terra, um corpo solto cai com aceleração constante, a **aceleração da gravidade**: g ≈ 9,8 m/s², que se costuma arredondar para **10 m/s²**. É um MUV.

Se a resistência do ar puder ser desprezada, **todos os corpos caem com a mesma aceleração**, qualquer que seja a massa. Foi o que Galileu defendeu no século XVII, contra a ideia antiga de que os corpos pesados cairiam mais depressa. No ar, a pena demora porque o ar a freia; no vácuo, cai junto com o martelo.

```conta
Uma ferramenta cai de um andaime e leva 2 s para chegar ao chão. (g = 10 m/s²)
velocidade ao chegar: v = g·t = 10 × 2 = 20 m/s (72 km/h)
altura: h = g·t² ÷ 2 = 10 × 4 ÷ 2 = 20 m
```

Uma ferramenta pequena caindo de 20 m chega ao chão a 72 km/h. É a razão do capacete e da tela de proteção nas obras.

## Lendo gráficos

- No gráfico **posição × tempo**, a inclinação da linha é a **velocidade**. Reta inclinada: movimento uniforme. Reta horizontal: corpo parado.
- No gráfico **velocidade × tempo**, a inclinação é a **aceleração**, e a **área** sob a linha é o deslocamento.

## Para praticar

1. Um ônibus percorre 45 km em 1 h 30 min. Qual é a velocidade média em km/h e em m/s?
2. Um carro parte do repouso e acelera a 2 m/s² durante 8 s. Que velocidade atinge e que distância percorre?
3. Calcule a distância de frenagem de um carro a 54 km/h e a 108 km/h, com desaceleração de 5 m/s². Compare os resultados.
4. Uma pedra é solta do alto de um poço e leva 3 s para atingir a água. Qual é a profundidade?
