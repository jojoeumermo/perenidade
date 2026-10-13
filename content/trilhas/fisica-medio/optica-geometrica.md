---
titulo: "Óptica geométrica"
resumo: "Objetivo: usar o modelo de raios de luz para explicar a reflexão em espelhos, a refração, a reflexão total e o funcionamento das lentes, incluindo a correção dos defeitos da visão."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 16.1, Reflection"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/16-1-reflection"
  - titulo: "Physics, seção 16.2, Refraction"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/16-2-refraction"
  - titulo: "Physics, seção 16.3, Lenses"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/16-3-lenses"
quiz:
  - pergunta: "O que diz a lei da reflexão?"
    opcoes: ["O ângulo de reflexão é igual ao ângulo de incidência", "O ângulo de reflexão é sempre de 90°", "A luz sempre volta pelo mesmo caminho"]
    resposta: 0
    explicacao: "Os dois ângulos são medidos em relação à reta perpendicular à superfície."
  - pergunta: "Por que o retrovisor externo dos carros costuma ser convexo?"
    opcoes: ["Porque aumenta o tamanho das imagens", "Porque amplia o campo de visão, embora as imagens fiquem menores", "Porque é mais barato"]
    resposta: 1
    explicacao: "Por mostrar as imagens menores, dá a impressão de que os objetos estão mais longe do que estão."
  - pergunta: "Que fenômeno mantém a luz presa dentro de uma fibra óptica?"
    opcoes: ["A difração", "A reflexão total", "A absorção"]
    resposta: 1
    explicacao: "A luz bate na parede interna da fibra com ângulo grande e é totalmente refletida, repetidas vezes."
  - pergunta: "Que tipo de lente corrige a miopia?"
    opcoes: ["Divergente", "Convergente", "Qualquer uma"]
    resposta: 0
    explicacao: "No olho míope, a imagem se forma antes da retina; a lente divergente a leva para trás."
---

## Luz em linha reta

A **óptica geométrica** trata a luz como **raios** que andam em linha reta em um meio uniforme. É um modelo simples, que não explica tudo (não explica a difração, por exemplo), mas dá conta de espelhos, lentes, óculos, câmeras e do olho humano. Ela continua a aula [Luz, sombra e cores](/trilhas/fisica-fundamental/luz-sombra-e-cores).

Dois princípios:

- a luz se propaga em **linha reta**: por isso existem as sombras;
- os raios são **independentes**: dois feixes que se cruzam seguem como se o outro não existisse.

## Reflexão

Quando a luz bate em uma superfície e volta, há **reflexão**. Vale a **lei da reflexão**:

> O ângulo de reflexão é igual ao ângulo de incidência.

Os dois ângulos são medidos em relação à **normal**, a reta perpendicular à superfície.

Em superfícies lisas, como o espelho, os raios saem organizados e formam imagens. Em superfícies ásperas, como a parede, saem em todas as direções: é a reflexão **difusa**, que nos permite ver os objetos de qualquer ângulo.

### Espelho plano

A imagem em um espelho plano:

- tem o **mesmo tamanho** do objeto;
- fica à **mesma distância** atrás do espelho que o objeto está à frente;
- é **virtual**: parece estar atrás do espelho, mas ali não há luz nenhuma;
- troca a direita pela esquerda. Por isso a palavra AMBULÂNCIA vem escrita invertida na frente do veículo: para ser lida no retrovisor.

### Espelhos curvos

| Espelho | Superfície refletora | O que faz | Onde se usa |
| --- | --- | --- | --- |
| **Côncavo** | a parte de dentro da curva | de perto, amplia a imagem; concentra a luz em um ponto, o foco | espelho de maquiagem e de dentista, faróis, fornos solares |
| **Convexo** | a parte de fora da curva | mostra imagens menores, mas com campo de visão mais amplo | retrovisores, espelhos de garagens e de lojas |

## Refração

Quando a luz passa de um meio para outro (do ar para a água, por exemplo), a sua **velocidade muda**. Se ela entra inclinada, **desvia**. É a **refração**.

O **índice de refração** (n) de um material diz quantas vezes a luz anda mais devagar nele do que no vácuo:

**n = c ÷ v**

| Meio | Índice de refração (aproximado) |
| --- | --- |
| Ar | 1,00 |
| Água | 1,33 |
| Vidro comum | 1,5 |
| Diamante | 2,4 |

```conta
Velocidade da luz na água:
v = 300 000 000 ÷ 1,33 ≈ 226 000 000 m/s
```

A regra do desvio é a **lei de Snell**:

**n₁ · sen θ₁ = n₂ · sen θ₂**

Na prática:

- ao entrar em um meio de índice **maior** (do ar para a água), o raio **se aproxima** da normal;
- ao entrar em um meio de índice **menor** (da água para o ar), **se afasta** da normal.

A refração explica o canudo que parece quebrado no copo, a piscina que parece mais rasa do que é e o peixe que não está onde parece estar. Quem pesca com arpão ou flecha aprende a mirar **abaixo** da imagem.

### Reflexão total

Quando a luz tenta sair de um meio de índice maior para um de índice menor (da água ou do vidro para o ar) com inclinação muito grande, ela **não consegue sair**: é totalmente refletida de volta, como em um espelho perfeito. É a **reflexão total**.

É assim que funciona a **fibra óptica**: um fio de vidro finíssimo, dentro do qual a luz avança quicando nas paredes, sem escapar, por quilômetros. A internet de alta velocidade e os exames de endoscopia dependem disso.

```verificar
Um raio de luz passa do ar para o vidro, entrando inclinado. O que acontece com ele?
- Continua em linha reta, sem desvio
+ Desvia, aproximando-se da normal
- Desvia, afastando-se da normal
> O vidro tem índice de refração maior que o do ar.
```

## Lentes

Uma **lente** é uma peça transparente que desvia a luz por refração.

| Lente | Forma | O que faz com raios paralelos |
| --- | --- | --- |
| **Convergente** | mais grossa no centro | junta os raios em um ponto, o **foco** |
| **Divergente** | mais grossa nas bordas | espalha os raios |

A distância da lente ao foco é a **distância focal** (f). A posição da imagem é dada pela equação:

**1 ÷ f = 1 ÷ p + 1 ÷ p′**

em que p é a distância do objeto à lente e p′ é a distância da imagem.

```conta
Objeto a 30 cm de uma lente convergente de distância focal 10 cm.
1 ÷ p′ = 1 ÷ 10 − 1 ÷ 30 = 3 ÷ 30 − 1 ÷ 30 = 2 ÷ 30
p′ = 15 cm
```

A imagem se forma 15 cm depois da lente e pode ser projetada em uma tela: é uma imagem **real**. É assim que funcionam o projetor, a câmera e o olho.

A lupa é uma lente convergente usada com o objeto bem perto, antes do foco: a imagem aparece ampliada.

### O "grau" dos óculos

O "grau" é a **vergência** da lente, medida em **dioptrias**: o inverso da distância focal em metros.

```conta
Lente com distância focal de 0,5 m:
vergência = 1 ÷ 0,5 = 2 dioptrias ("2 graus")
```

Quanto menor a distância focal, mais forte a lente.

## O olho e os óculos

O olho funciona como uma câmera. A **córnea** e o **cristalino** formam uma lente convergente, que projeta a imagem sobre a **retina**, no fundo do olho. O cristalino muda de forma para focalizar objetos próximos ou distantes.

| Defeito | O que acontece | Dificuldade | Lente que corrige |
| --- | --- | --- | --- |
| **Miopia** | a imagem se forma antes da retina | ver de longe | divergente |
| **Hipermetropia** | a imagem se formaria depois da retina | ver de perto | convergente |
| **Presbiopia** ("vista cansada") | o cristalino perde elasticidade com a idade | ver de perto | convergente |
| **Astigmatismo** | a córnea tem curvatura irregular | imagem borrada | cilíndrica |

Muitas crianças vão mal na escola simplesmente porque não enxergam o quadro. O exame de vista é um direito, e os óculos mudam uma vida escolar.

## Para praticar

1. Você está a 1,5 m de um espelho plano. A que distância de você está a sua imagem?
2. Calcule a velocidade da luz no vidro comum.
3. Um objeto está a 20 cm de uma lente convergente de distância focal 5 cm. Onde se forma a imagem?
4. Uma receita indica lentes de −2 dioptrias. A lente é convergente ou divergente? Qual é o defeito mais provável? Qual é a distância focal?
