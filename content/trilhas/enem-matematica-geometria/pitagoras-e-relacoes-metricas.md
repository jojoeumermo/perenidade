---
titulo: "Teorema de Pitágoras e relações métricas"
resumo: "O lado que falta num triângulo retângulo: escada na parede, diagonal da tela, esquadro da obra, cabo de poste e as relações da altura com a hipotenusa."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 9.3, Use Properties of Angles, Triangles, and the Pythagorean Theorem"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-3-use-properties-of-angles-triangles-and-the-pythagorean-theorem"
  - titulo: "Contemporary Mathematics, seção 10.3, Triangles"
    autor: "Donna Kirk (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/10-3-triangles"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Os catetos de um triângulo retângulo medem 6 cm e 8 cm. Quanto mede a hipotenusa?"
    opcoes: ["14 cm", "10 cm", "48 cm", "100 cm"]
    resposta: 1
    explicacao: "a² = 6² + 8² = 36 + 64 = 100. Então a = √100 = 10 cm. Quem marcou 100 esqueceu a raiz; quem marcou 14 somou os catetos."
  - pergunta: "Uma escada de 5 m está encostada numa parede, com o pé a 3 m da parede. A que altura ela toca a parede?"
    opcoes: ["4 m", "2 m", "8 m", "√34 m"]
    resposta: 0
    explicacao: "A escada é a hipotenusa: 5² = 3² + h². Então h² = 25 − 9 = 16 e h = 4 m."
  - pergunta: "Um triângulo tem lados de 7, 24 e 25. Ele é retângulo?"
    opcoes: ["Não, porque 7 + 24 é diferente de 25", "Não dá para saber sem medir o ângulo", "Sim, porque 49 + 576 = 625", "Sim, porque 25 é o maior lado"]
    resposta: 2
    explicacao: "Vale a volta do teorema: se o quadrado do maior lado é a soma dos quadrados dos outros dois, o triângulo é retângulo. 7² + 24² = 49 + 576 = 625 = 25²."
  - pergunta: "Num triângulo retângulo de catetos 6 e 8 e hipotenusa 10, quanto mede a altura relativa à hipotenusa?"
    opcoes: ["7", "48", "5", "4,8"]
    resposta: 3
    explicacao: "Produto dos catetos é igual a hipotenusa vezes a altura: 6 × 8 = 10 × h. Então h = 48 ÷ 10 = 4,8."
---

```provocacao
Uma escada encostada no muro, um cabo que segura o poste, o caminho cortando a praça na diagonal. Em todos aparece o mesmo triângulo. Se você sabe dois lados dele, consegue achar o terceiro sem medir?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer um triângulo retângulo numa situação real, calcular o lado que falta com o Teorema de Pitágoras, conferir se um canto é reto pelas medidas e usar as relações entre a altura e a hipotenusa.

## O triângulo retângulo e os nomes dos lados

Um **triângulo retângulo** tem um ângulo reto, de 90 graus, como o canto de uma folha de papel ou o encontro do chão com a parede. Os dois lados que formam esse canto são os **catetos**. O lado em frente ao ângulo reto é a **hipotenusa**. Ela é sempre o maior lado.

Pense na escada encostada no muro. O muro e o chão formam o canto reto. A altura do muro até a ponta da escada é um cateto. A distância do pé da escada até o muro é o outro cateto. A própria escada, inclinada, é a hipotenusa.

Antes de qualquer conta, ache o canto reto e diga em voz alta: "estes dois são os catetos, este é a hipotenusa". Metade dos erros nessa matéria vem de trocar os papéis.

## O Teorema de Pitágoras

O teorema liga os três lados numa só igualdade.

```formula
a² = b² + c²
o quadrado da hipotenusa (a) é igual à soma dos quadrados dos catetos (b e c)
```

Figura descrita em palavras: desenhe um triângulo retângulo de catetos 3 e 4. Sobre cada lado, desenhe um quadrado. O quadrado do cateto 3 tem 9 quadradinhos. O do cateto 4 tem 16. O da hipotenusa tem 25, que é exatamente 9 + 16. A hipotenusa mede √25 = 5.

Há dois usos:

- **Achar a hipotenusa:** some os quadrados dos catetos e tire a raiz. Catetos 5 e 12: 25 + 144 = 169, e √169 = 13.
- **Achar um cateto:** do quadrado da hipotenusa, subtraia o quadrado do cateto conhecido e tire a raiz. Hipotenusa 17 e cateto 8: 289 − 64 = 225, e √225 = 15.

Alguns trios aparecem muito porque dão números inteiros: 3, 4 e 5; 5, 12 e 13; 8, 15 e 17; 7, 24 e 25. Os múltiplos também valem: 6, 8 e 10; 30, 40 e 50. Reconhecer um deles poupa a conta.

```verificar
Uma tela retangular mede 9 dm por 12 dm. Quanto mede a diagonal?
- 21 dm
+ 15 dm
- 225 dm
> A diagonal divide o retângulo em dois triângulos retângulos de catetos 9 e 12. 81 + 144 = 225, e √225 = 15. É o trio 3, 4 e 5 multiplicado por 3.
```

## A volta do teorema: conferir o canto reto

O teorema também funciona ao contrário. Se o quadrado do maior lado é igual à soma dos quadrados dos outros dois, o triângulo é retângulo. Se der diferente, não é.

Em obra, isso serve para conferir o esquadro, isto é, se duas paredes formam um canto reto. Marque 60 cm numa parede e 80 cm na outra, a partir do canto. Se a distância entre as duas marcas for 100 cm, o canto é reto, porque 60² + 80² = 3.600 + 6.400 = 10.000 = 100². Se der mais de 100 cm, o canto está aberto demais; se der menos, fechado demais.

## Relações métricas: a altura sobre a hipotenusa

Do canto reto, trace a **altura** até a hipotenusa: o segmento que cai nela formando outro ângulo reto. Figura descrita em palavras: a altura h divide a hipotenusa a em dois pedaços, m e n, chamados **projeções** dos catetos. O cateto b fica do lado do pedaço m; o cateto c, do lado do pedaço n.

Essa altura cria dois triângulos menores, parecidos com o grande (semelhantes, como na aula de semelhança). Da semelhança saem as relações métricas:

```formula
b · c = a · h   ·   h² = m · n   ·   b² = a · m   ·   c² = a · n
o produto dos catetos é a hipotenusa vezes a altura; a altura ao quadrado é o produto das duas projeções; cada cateto ao quadrado é a hipotenusa vezes a projeção do lado dele
```

A primeira é a mais útil e a mais fácil de lembrar, porque vem da área: o triângulo tem área b · c ÷ 2 (com um cateto de base) e também a · h ÷ 2 (com a hipotenusa de base). As duas contas medem a mesma área.

Exemplo: catetos 6 e 8, hipotenusa 10. A altura é 6 × 8 ÷ 10 = 4,8. As projeções: 6² = 10 · m dá m = 3,6; 8² = 10 · n dá n = 6,4. Confira: 3,6 + 6,4 = 10, e 4,8² = 23,04 = 3,6 × 6,4.

```navidareal
Quem compra uma televisão ouve falar em "polegadas". Esse número é a medida da diagonal da tela, não da largura. Duas telas com a mesma diagonal podem ter larguras diferentes, conforme o formato. Pitágoras liga as três medidas: largura ao quadrado mais altura ao quadrado é a diagonal ao quadrado. Antes de comprar, é ela que diz se a TV cabe no móvel.
```

## Exemplo resolvido

**Uma praça é um retângulo de 30 m por 40 m. Quem vai de um canto ao canto oposto pode contornar a praça pelas calçadas ou cortar pela diagonal. Quantos metros o atalho economiza?**

1. Contornando: 30 + 40 = 70 m.
2. A diagonal divide a praça em dois triângulos retângulos de catetos 30 m e 40 m. A diagonal é a hipotenusa.
3. a² = 30² + 40² = 900 + 1.600 = 2.500, então a = √2.500 = 50 m.
4. Economia: 70 − 50 = 20 m.

Confira: a hipotenusa tem de ser maior que o maior cateto (40 m) e menor que a soma dos catetos (70 m). 50 m está entre os dois. É o trio 3, 4 e 5 multiplicado por 10.

## Como isso cai no ENEM

- **Formatos:** escadas, rampas, cabos e cordas esticadas, diagonais de telas e terrenos, atalhos que cortam praças, conferência de esquadro, distâncias num mapa (que viram triângulo retângulo), a maior vareta que cabe numa caixa.
- **Habilidades:** H7 (identificar características de figuras planas e espaciais), H8 (resolver problemas de geometria de espaço e forma) e H9 (usar a geometria para escolher argumentos que resolvem problemas do cotidiano). Nas provas de 2022 e 2023, classificadas pelo instituto, o tópico Teorema de Pitágoras e relações métricas teve 1 das 81 questões de Matemática (1,2%). Mas Pitágoras também está por dentro de questões de distância, de sólidos e de trigonometria. São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Trocar os papéis: a hipotenusa é a que fica em frente ao canto reto, a maior.
  - Somar os quadrados quando o que falta é um cateto (aí se subtrai).
  - Esquecer a raiz no fim.
  - Somar os lados em vez dos quadrados: 3 + 4 não é 5.
  - Esquecer uma parte que não está no triângulo, como a altura da mão de quem segura a pipa ou a sobra para amarrar o cabo.

## Questão comentada

**Texto-base.** Para resistir ao vento, um poste de 8 m de altura, em pé num terreno plano, será preso por 4 cabos de aço. Cada cabo sai do topo do poste e vai até um ponto no chão a 6 m da base do poste. Para a amarração, cada cabo precisa de 1 m a mais além da distância entre o topo e o chão.

**Comando.** O total de cabo de aço que deve ser comprado é de

A) 40 m.
B) 60 m.
C) 56 m.
D) 11 m.
E) 44 m.

**Resolução.**

1. Cada cabo é a hipotenusa de um triângulo retângulo de catetos 8 m e 6 m: √(64 + 36) = √100 = 10 m.
2. Com a amarração: 10 + 1 = 11 m por cabo.
3. Quatro cabos: 4 × 11 = 44 m.

**Gabarito: E.**

**Por que as outras não:**

- A) 40 m: são os 4 cabos de 10 m, mas sem o metro de amarração de cada um.
- B) 60 m: os catetos foram somados (8 + 6 + 1 = 15 por cabo). O cabo esticado é a hipotenusa, que é menor que a soma dos catetos.
- C) 56 m: os catetos foram somados e a amarração esquecida (4 × 14). Use Pitágoras para o cabo.
- D) 11 m: é um cabo só. O poste leva 4.

```realidade
Procure em casa um canto que deveria ser reto: o encontro de duas paredes, o batente de uma porta, uma mesa. Marque 30 cm num lado e 40 cm no outro, a partir do canto. Meça a distância entre as marcas. Deu 50 cm? Se deu diferente, o canto está fora do esquadro. Para que lado?
```

## Resumo

- No triângulo retângulo, os catetos formam o canto reto; a hipotenusa fica em frente a ele e é o maior lado.
- Pitágoras: a² = b² + c². Para a hipotenusa, some os quadrados; para um cateto, subtraia. Tire a raiz no fim.
- Trios inteiros: 3-4-5, 5-12-13, 8-15-17, 7-24-25 e os múltiplos.
- A volta: se o maior lado ao quadrado é a soma dos outros dois ao quadrado, o canto é reto.
- Relações métricas: b · c = a · h e h² = m · n.

## Para aprofundar

- [Potências e raízes](/trilhas/matematica-fundamental/potencias-e-raizes)
- [Geometria plana](/trilhas/matematica-medio/geometria-plana)
- [Plano cartesiano e distância entre pontos](/trilhas/enem-matematica-geometria/plano-cartesiano)
- [Trigonometria no triângulo retângulo](/trilhas/enem-matematica-geometria/trigonometria-no-triangulo-retangulo)
- [Áreas de figuras planas](/trilhas/enem-matematica-geometria/areas-de-figuras-planas)
- [Formulário de matemática](/trilhas/enem-reta-final/formulario-de-matematica)
