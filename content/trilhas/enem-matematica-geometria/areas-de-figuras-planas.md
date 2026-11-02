---
titulo: "Áreas de figuras planas"
resumo: "Retângulo, triângulo, paralelogramo, trapézio e losango; terrenos recortados em pedaços; piso, tinta e conversão de metro quadrado para centímetro quadrado."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Contemporary Mathematics, seção 10.6, Area"
    autor: "Donna Kirk (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/10-6-area"
  - titulo: "Prealgebra 2e, seção 9.5, Solve Geometry Applications: Circles and Irregular Figures"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-5-solve-geometry-applications-circles-and-irregular-figures"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Um triângulo tem 8 m de base e 5 m de altura. Qual é a área dele?"
    opcoes: ["40 m²", "20 m²", "13 m²", "10 m²"]
    resposta: 1
    explicacao: "Área do triângulo: base vezes altura dividido por 2. 8 × 5 = 40, e 40 ÷ 2 = 20 m². Quem marcou 40 esqueceu de dividir por 2."
  - pergunta: "Um trapézio tem bases de 6 m e 4 m e altura de 3 m. Qual é a área?"
    opcoes: ["15 m²", "30 m²", "72 m²", "13 m²"]
    resposta: 0
    explicacao: "Some as bases, multiplique pela altura e divida por 2: (6 + 4) × 3 ÷ 2 = 30 ÷ 2 = 15 m²."
  - pergunta: "Quantos centímetros quadrados há em 1 metro quadrado?"
    opcoes: ["100", "1.000", "100.000", "10.000"]
    resposta: 3
    explicacao: "1 m² é um quadrado de 1 m de lado, ou 100 cm de lado. A área é 100 × 100 = 10.000 cm²."
  - pergunta: "Se os dois lados de um retângulo dobram, a área fica multiplicada por:"
    opcoes: ["2", "8", "4", "6"]
    resposta: 2
    explicacao: "Os dois lados dobram: 2 × 2 = 4. A área fica 4 vezes maior. O perímetro, esse sim, só dobra."
---

```provocacao
Você vai trocar o piso da cozinha. Na loja, o vendedor pergunta: "quantos metros?". Ele quer saber o comprimento das paredes ou outra coisa?
```

## O que você vai aprender

Ao fim desta aula você vai calcular a área das figuras planas que o ENEM mais usa (retângulo, quadrado, triângulo, paralelogramo, trapézio e losango), recortar um terreno torto em pedaços conhecidos, converter metro quadrado em centímetro quadrado e usar a área para decidir quanto piso, tinta ou grama comprar.

## Área é quantos quadradinhos cabem

Perímetro é a volta: a medida da borda. Área é a superfície de dentro: quantos quadradinhos de 1 por 1 cabem na figura.

Pense num quarto de 4 m por 3 m. O rodapé corre pela borda: é o perímetro, 4 + 3 + 4 + 3 = 14 m. O piso cobre o chão: é a área. Nele cabem 4 fileiras de 3 quadrados de 1 m de lado, 12 m² ao todo.

Quando o vendedor pergunta "quantos metros" de piso, ele quer os metros quadrados (m²). Perímetro se mede em metros; área, em metros quadrados.

## Retângulo, quadrado e paralelogramo

O **retângulo** é o ponto de partida: área é base vezes altura. O **quadrado** é um retângulo de lados iguais: lado vezes lado.

O **paralelogramo** é um retângulo "tombado", com os lados opostos paralelos mas sem ângulos retos. Corte o triângulo de uma ponta e cole na outra: vira um retângulo com a mesma base e a mesma altura. Por isso a área continua sendo base vezes altura.

Atenção: a altura é a distância reta, em pé, entre as duas bases. Não é o lado inclinado. No paralelogramo, o lado torto é maior que a altura.

## Triângulo

Todo triângulo é metade de um paralelogramo. Pegue dois triângulos iguais, gire um deles e encoste os dois: eles formam um paralelogramo. Por isso a área do triângulo é a metade de base vezes altura.

```formula
A = b · h ÷ 2
a área do triângulo é a base vezes a altura, dividido por dois
a altura é a distância do vértice de cima até a reta da base, sempre em ângulo reto com a base
```

No triângulo retângulo, os dois lados que formam o ângulo reto (os **catetos**) já são base e altura. É o caso mais comum em rampas, telhados e terrenos de esquina.

## Trapézio e losango

O **trapézio** tem dois lados paralelos, chamados base maior (B) e base menor (b). É a forma de muitos terrenos: a frente e o fundo paralelos, com tamanhos diferentes.

Duas cópias do trapézio, uma de cabeça para baixo, formam um paralelogramo de base B + b. A área do trapézio é a metade disso.

```formula
A = (B + b) · h ÷ 2
a área do trapézio é a soma das duas bases, vezes a altura, dividido por dois
é como fazer a média das bases e multiplicar pela altura
```

O **losango** tem os quatro lados iguais, como uma pipa com os quatro lados do mesmo tamanho. As duas diagonais (D e d) se cruzam no meio, em ângulo reto. O losango cabe exatamente num retângulo de lados D e d e ocupa metade dele. A área é D · d ÷ 2.

```verificar
Um terreno tem a forma de um trapézio: frente de 10 m, fundo de 14 m (paralelo à frente) e 20 m de profundidade. Qual é a área?
- 480 m²
+ 240 m²
- 280 m²
> Some as bases: 10 + 14 = 24. Multiplique pela altura, que é a profundidade: 24 × 20 = 480. Divida por 2: 240 m².
```

## Figuras recortadas: somar e tirar pedaços

Quase nenhum terreno, sala ou canteiro da prova é uma figura pronta. A estratégia é sempre a mesma:

1. Divida a figura em pedaços conhecidos (retângulos, triângulos, trapézios).
2. Calcule a área de cada pedaço.
3. Some os pedaços. Ou, quando é mais fácil, calcule a figura grande e **tire** o que falta.

Uma sala em forma de L, por exemplo, pode ser vista como um retângulo grande do qual se tirou um canto. Uma área com grama em volta de um canteiro redondo é um quadrado menos um círculo.

## Unidades de área

A conversão de área engana porque a área tem duas dimensões. Se 1 m = 100 cm, então 1 m² = 100 cm × 100 cm = 10.000 cm². Não são 100.

Um piso de 50 cm por 50 cm tem 2.500 cm², que são 0,25 m² (um quarto de metro quadrado). Quatro desses pisos cobrem 1 m². Um erro comum é achar que ele tem 0,5 m²: isso seria o piso de 50 cm × 1 m.

```navidareal
Num orçamento de obra, quase tudo é área. Piso, contrapiso, reboco, tinta, forro e telhado são cobrados por metro quadrado. Uma conta de exemplo, com preço inventado só para treinar: se a mão de obra do piso fosse R$ 40 por m², uma cozinha de 3 m por 2,5 m (7,5 m²) custaria 7,5 × 40 = R$ 300.

Medir a área antes de pedir o orçamento ajuda a conferir a conta de quem vende e de quem faz o serviço. Não esqueça de descontar portas e janelas na tinta, e de comprar um pouco a mais de piso para os recortes.
```

## Exemplo resolvido

**Um terreno tem a forma de um retângulo de 10 m por 8 m, mas um dos cantos foi cortado em diagonal: um triângulo retângulo com catetos de 4 m e 3 m saiu do retângulo. Qual é a área do terreno?**

1. Imagine o retângulo inteiro: 10 × 8 = 80 m².
2. O pedaço que falta é um triângulo retângulo. Os catetos são base e altura: 4 × 3 ÷ 2 = 6 m².
3. Tire o pedaço: 80 − 6 = 74 m².

Confira pelo bom senso: o canto que falta é pequeno perto do terreno. A resposta tem de ser um pouco menor que 80 m², e é.

## Como isso cai no ENEM

- **Formatos:** terrenos e lotes (com a figura descrita ou desenhada), quantidade de piso, azulejo, grama ou tinta, custo de uma reforma por metro quadrado, regiões sombreadas (uma figura menos outra), mudança de escala de um cartaz ou de uma planta e o efeito na área.
- **Habilidades:** H8 (resolver problemas de geometria de espaço e forma), H12 (resolver problemas com medidas de grandezas) e H9 (usar a geometria para escolher argumentos que resolvem problemas do cotidiano). Nas provas de 2022 e 2023, classificadas pelo instituto, o tópico áreas de figuras planas teve 2 das 81 questões de Matemática (2,5%). Mas a área aparece também dentro de questões de outros tópicos, como escalas, circunferência e embalagens. São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Confundir área com perímetro.
  - Esquecer o "dividido por 2" no triângulo, no trapézio e no losango.
  - Usar o lado inclinado como altura.
  - Converter área como se fosse comprimento: 1 m² = 10.000 cm², não 100.
  - Esquecer de descontar portas, janelas ou o pedaço que falta.

## Questão comentada

**Texto-base.** Uma cozinha comunitária tem o piso em forma de retângulo, com 4 m de comprimento e 3 m de largura. O grupo vai cobrir o piso com placas cerâmicas quadradas de 50 cm de lado. As placas são vendidas em caixas com 8 placas cada. Despreze o espaço entre as placas e as perdas nos recortes.

**Comando.** O número mínimo de caixas que o grupo precisa comprar é

A) 6.
B) 3.
C) 48.
D) 7.
E) 1,5.

**Resolução.**

1. Área do piso: 4 × 3 = 12 m².
2. Área de uma placa: 0,5 m × 0,5 m = 0,25 m².
3. Placas necessárias: 12 ÷ 0,25 = 48 placas.
4. Caixas: 48 ÷ 8 = 6 caixas.

Atalho: cada caixa tem 8 × 0,25 = 2 m² de placas. 12 ÷ 2 = 6.

**Gabarito: A.**

**Por que as outras não:**

- B) 3: a placa foi tomada como 0,5 m² (50 cm virou meio metro quadrado). A placa de 50 cm por 50 cm tem 0,25 m², e o número de placas dobra.
- C) 48: esse é o número de placas, não de caixas. Falta dividir por 8.
- D) 7: a conta usou o perímetro da cozinha (4 + 3 + 4 + 3 = 14) dividido por 2. Piso é área, não volta.
- E) 1,5: a área (12) foi dividida pelo número de placas da caixa (8), sem passar pela área de cada placa. Além disso, não se compra meia caixa.

```realidade
Meça o cômodo onde você está com passos ou com uma trena. Desenhe a planta no papel, divida em retângulos se ele não for retangular e calcule a área em metros quadrados. Quantas placas de 50 cm por 50 cm cobririam esse piso?
```

## Resumo

- Área é a superfície de dentro, em unidades quadradas. Perímetro é a volta.
- Retângulo e paralelogramo: base vezes altura. Triângulo: base vezes altura dividido por 2.
- Trapézio: (B + b) · h ÷ 2. Losango: D · d ÷ 2.
- Figura recortada: divida em pedaços, some, ou calcule a grande e tire o que falta.
- 1 m² = 10.000 cm². Dobrar os lados multiplica a área por 4.

## Para aprofundar

- [Perímetro e área](/trilhas/matematica-fundamental/perimetro-e-area)
- [Geometria plana](/trilhas/matematica-medio/geometria-plana)
- [Medidas: comprimento, massa, tempo e capacidade](/trilhas/matematica-fundamental/medidas-comprimento-massa-tempo-e-capacidade)
- [Circunferência e círculo](/trilhas/enem-matematica-geometria/circunferencia-e-circulo)
- [Matemática, o essencial: geometria, dados e funções](/trilhas/enem-reta-final/matematica-o-essencial-geometria-dados-e-funcoes)
- [Formulário de matemática](/trilhas/enem-reta-final/formulario-de-matematica)
