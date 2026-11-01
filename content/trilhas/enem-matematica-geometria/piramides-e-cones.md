---
titulo: "Pirâmides e cones"
resumo: "Por que o volume da pirâmide e do cone é um terço do prisma e do cilindro, a geratriz pelo Teorema de Pitágoras, telhados, funis, casquinhas e montes de areia."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 9.6, Solve Geometry Applications: Volume and Surface Area"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-6-solve-geometry-applications-volume-and-surface-area"
  - titulo: "Calculus Volume 1, seção 6.2, Determining Volumes by Slicing (volume da pirâmide)"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/6-2-determining-volumes-by-slicing"
  - titulo: "Calculus Volume 1, seção 6.4, Arc Length of a Curve and Surface Area (área lateral do cone)"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/6-4-arc-length-of-a-curve-and-surface-area"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Um cone e um cilindro têm a mesma base e a mesma altura. O volume do cone é:"
    opcoes: ["a metade do volume do cilindro", "o dobro do volume do cilindro", "um terço do volume do cilindro", "igual ao volume do cilindro"]
    resposta: 2
    explicacao: "Pirâmides e cones têm um terço do volume do prisma ou do cilindro de mesma base e mesma altura. São precisos três cones cheios para encher o cilindro."
  - pergunta: "Uma pirâmide tem base quadrada de 6 m de lado e 5 m de altura. Qual é o volume?"
    opcoes: ["60 m³", "180 m³", "30 m³", "90 m³"]
    resposta: 0
    explicacao: "Área da base: 6 × 6 = 36 m². Volume: 36 × 5 ÷ 3 = 180 ÷ 3 = 60 m³. Quem chega a 180 esqueceu de dividir por 3."
  - pergunta: "Um cone tem 3 cm de raio e 4 cm de altura. Quanto mede a geratriz (a linha inclinada do vértice até a borda da base)?"
    opcoes: ["7 cm", "25 cm", "12 cm", "5 cm"]
    resposta: 3
    explicacao: "Altura, raio e geratriz formam um triângulo retângulo. Pelo Teorema de Pitágoras: g² = 3² + 4² = 9 + 16 = 25, e g = 5 cm. Quem marcou 25 esqueceu de tirar a raiz."
  - pergunta: "Qual é o volume de um cone de 2 cm de raio e 6 cm de altura? Use π = 3."
    opcoes: ["72 cm³", "24 cm³", "36 cm³", "12 cm³"]
    resposta: 1
    explicacao: "V = π · r² · h ÷ 3 = 3 × 4 × 6 ÷ 3 = 24 cm³. Sem o ÷ 3 daria 72, que é o cilindro de mesma base e altura."
---

```provocacao
Na frente de uma obra, o caminhão despejou um monte de areia. O pedreiro olha e diz: "isso dá uns seis metros cúbicos". Como ele sabe, sem encher balde por balde?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer pirâmides e cones e os elementos deles (base, vértice, altura, apótema, geratriz), calcular o volume dos dois e a área das faces de um telhado ou da lona de uma tenda. Vai também usar o Teorema de Pitágoras para achar a medida inclinada que a questão esconde.

## Pirâmides e cones: uma base e um bico

Pense numa barraca de acampamento de base quadrada, com quatro panos que se encontram num ponto lá em cima. Essa é uma **pirâmide**: uma base que é um polígono e faces laterais triangulares que se encontram num ponto, o **vértice**.

Agora troque a base quadrada por uma redonda. Em vez de faces, aparece uma superfície curva que sobe da borda até o bico. É um **cone**, como a casquinha de sorvete, o funil, o chapéu de festa e o monte de areia.

A pirâmide ganha o nome da base: triangular, quadrangular, hexagonal. Cada sólido tem três medidas que é preciso separar bem:

- **Altura (h):** a distância em pé, do vértice até a base, em ângulo reto com o chão.
- **Na pirâmide, apótema:** a altura de cada face triangular, medida no meio da face, inclinada.
- **No cone, geratriz (g):** a linha inclinada que vai do vértice até a borda da base.

A altura fica "dentro" do sólido. A apótema e a geratriz ficam na superfície, inclinadas. Elas são sempre maiores que a altura.

## O volume: um terço

Encha uma casquinha de água e despeje num copo cilíndrico com a mesma boca e a mesma altura. São precisas três casquinhas para encher o copo. O mesmo vale para a pirâmide e o prisma de mesma base e mesma altura.

```formula
V = A da base · h ÷ 3
o volume da pirâmide ou do cone é a área da base vezes a altura, dividido por três
no cone, a base é um círculo: V = π · r² · h ÷ 3
```

O "dividido por três" é a parte que todo mundo esquece. Uma forma de lembrar: o bico afina o sólido, então ele guarda bem menos do que o prisma ou o cilindro que o envolve. Um terço, exatamente.

```navidareal
Volte ao monte de areia. Areia despejada forma um cone, porque escorre por igual para todos os lados. O pedreiro estima o diâmetro da base, uns 4 m, e a altura, uns 1,5 m. O raio é 2 m.

Com π = 3: a base tem 3 × 4 = 12 m², vezes 1,5 m dá 18, dividido por 3 dá 6 m³. É a conta que ele faz de cabeça, e é ela que diz quantas viagens de caminhão, quantos sacos de cimento e quanto dinheiro.
```

## A medida inclinada: Teorema de Pitágoras

Corte um cone ao meio, de cima a baixo, pelo vértice. Aparece um triângulo. A altura desce do vértice ao centro da base, o raio vai do centro até a borda e a geratriz volta da borda ao vértice. A altura e o raio formam um ângulo reto. Os três formam um triângulo retângulo, e a geratriz é a hipotenusa (o lado oposto ao ângulo reto).

```formula
g² = h² + r²
a geratriz ao quadrado é a altura ao quadrado mais o raio ao quadrado
na pirâmide de base quadrada: apótema² = altura² + (metade do lado)²
```

Na pirâmide de base quadrada, o triângulo é parecido. A altura desce do vértice ao centro da base. Do centro até o meio de um lado da base, a distância é metade do lado. A apótema da face liga o vértice a esse ponto do meio do lado.

Triângulos retângulos com medidas inteiras aparecem muito: 3, 4 e 5; 6, 8 e 10; 5, 12 e 13. Se a questão der dois desses números, desconfie do terceiro.

```verificar
Um telhado tem a forma de pirâmide de base quadrada com 8 m de lado e 3 m de altura. Quanto mede a apótema de cada face?
- 3 m
+ 5 m
- 11 m
> A altura (3 m) e metade do lado (4 m) formam um triângulo retângulo. A apótema é a hipotenusa: 3² + 4² = 25, e a raiz de 25 é 5 m.
```

## Áreas: quanto material

Para a área da superfície, desmonte o sólido. A pirâmide vira a base mais as faces triangulares. Cada face tem área igual à base do triângulo (o lado da base da pirâmide) vezes a apótema, dividido por 2.

O cone vira um círculo (a base) e um setor de círculo (a lateral, como um leque). A área da lateral é π · r · g: pi vezes o raio da base vezes a geratriz.

Leia com atenção o que a questão quer cobrir. O telhado não tem base: são só as faces. A lona de uma tenda cônica é só a lateral. O chapéu de festa também.

## Exemplo resolvido

**Um funil de cozinha tem a forma de um cone com 6 cm de raio da boca e 8 cm de altura (com o bico tampado). Usando π = 3,14, quantos mililitros cabem nele? E quanto plástico tem a parede do funil, sem contar o bico?**

1. Volume: π · r² · h ÷ 3 = 3,14 × 36 × 8 ÷ 3. Divida primeiro o que é fácil: 36 ÷ 3 = 12. Fica 3,14 × 12 × 8 = 3,14 × 96 = 301,44 cm³.
2. Como 1 cm³ = 1 mL, cabem cerca de 301 mL.
3. Para a parede, falta a geratriz. Altura e raio formam um triângulo retângulo: g² = 8² + 6² = 64 + 36 = 100, então g = 10 cm.
4. Área lateral: π · r · g = 3,14 × 6 × 10 = 188,4 cm².

Confira o volume pelo cilindro: um copo de 6 cm de raio e 8 cm de altura teria 3,14 × 36 × 8 = 904,32 cm³. Um terço disso é 301,44. A conta bate.

## Como isso cai no ENEM

- **Formatos:** montes de areia e de grãos, funis, casquinhas, copos cônicos cheios até certa altura, telhados em forma de pirâmide (área de telhas), tendas e chapéus (área da lona), velas e enfeites (volume de material). Muitas vezes a medida inclinada vem escondida e sai pelo Teorema de Pitágoras.
- **Habilidades:** H8 (resolver problemas de geometria de espaço e forma) e H7 (identificar características de figuras planas e espaciais). Nas provas de 2022 e 2023, classificadas pelo instituto, o tópico pirâmides e cones teve 2 das 81 questões de Matemática (2,5%). A geometria inteira teve 24 (29,6%). São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Esquecer o "dividido por 3".
  - Trocar a altura pela geratriz ou pela apótema. A altura é em pé; as outras são inclinadas.
  - Usar o diâmetro como raio.
  - Contar a base no telhado ou na lona da tenda.
  - No copo cônico cheio até a metade da altura, achar que tem metade do volume. Tem 1/8: o cone pequeno é semelhante ao grande, com todas as medidas pela metade, e (1/2)³ = 1/8.

## Questão comentada

**Texto-base.** Uma sorveteria de bairro serve sorvete em casquinhas cônicas com 3 cm de raio da boca e 10 cm de altura. O sorvete vem da fábrica em potes cilíndricos com 6 cm de raio da base e 10 cm de altura. As medidas são internas. Use π = 3 e considere que cada casquinha é enchida só até a boca, sem a "bola" por cima.

**Comando.** Com o conteúdo de um pote, a sorveteria enche quantas casquinhas?

A) 4
B) 12
C) 3
D) 2
E) 8

**Resolução.**

1. Casquinha: π · r² · h ÷ 3 = 3 × 9 × 10 ÷ 3 = 90 cm³.
2. Pote: π · r² · h = 3 × 36 × 10 = 1.080 cm³.
3. 1.080 ÷ 90 = 12 casquinhas.

**Gabarito: B.**

**Por que as outras não:**

- A) 4: a casquinha foi tratada como cilindro, sem o "dividido por 3". Só a comparação das bases (36 ÷ 9 = 4) entrou na conta.
- C) 3: o diâmetro da casquinha (6 cm) foi usado como raio, e ela ficou com o mesmo raio do pote. O raio da casquinha é 3 cm.
- D) 2: só os raios foram comparados (6 ÷ 3). A base depende do raio ao quadrado, e o cone tem o "um terço".
- E) 8: a razão dos raios foi elevada ao cubo (2³). Mas as alturas são iguais: só o raio muda, e ele entra ao quadrado.

```realidade
Faça um cone de papel (um funil) e um cilindro de papel com a mesma boca e a mesma altura. Encha o cone de arroz ou de areia e despeje no cilindro. Quantas vezes você precisou encher o cone? Anote e compare com o "um terço".
```

## Resumo

- Pirâmide: base poligonal e faces triangulares até um vértice. Cone: base redonda e superfície curva até o vértice.
- Volume: área da base vezes altura, dividido por 3. Cone: π · r² · h ÷ 3.
- Geratriz do cone: g² = h² + r². Apótema da pirâmide quadrada: altura² + (metade do lado)².
- Área lateral do cone: π · r · g. Face da pirâmide: lado da base vezes apótema, dividido por 2.
- Cone cheio até a metade da altura: 1/8 do volume.

## Para aprofundar

- [Geometria espacial](/trilhas/matematica-medio/geometria-espacial)
- [Geometria plana](/trilhas/matematica-medio/geometria-plana)
- [Trigonometria no triângulo retângulo](/trilhas/matematica-medio/trigonometria-no-triangulo-retangulo)
- [Prismas e cilindros](/trilhas/enem-matematica-geometria/prismas-e-cilindros)
- [Formulário de matemática](/trilhas/enem-reta-final/formulario-de-matematica)
