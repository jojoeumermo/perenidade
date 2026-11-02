---
titulo: "Plano cartesiano e distância entre pontos"
resumo: "Localizar pontos com dois números, medir a distância entre eles numa malha e achar o ponto do meio: o mapa do bairro virado conta."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Intermediate Algebra 2e, seção 11.1, Distance and Midpoint Formulas; Circles"
    autor: "Lynn Marecek, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/intermediate-algebra-2e/pages/11-1-distance-and-midpoint-formulas-circles"
  - titulo: "Prealgebra 2e, seção 11.1, Use the Rectangular Coordinate System"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/11-1-use-the-rectangular-coordinate-system"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Em que quadrante fica o ponto (−3, 2)?"
    opcoes: ["1º quadrante", "2º quadrante", "3º quadrante", "4º quadrante"]
    resposta: 1
    explicacao: "x negativo (à esquerda) e y positivo (para cima): é o 2º quadrante, o de cima à esquerda."
  - pergunta: "Qual é a distância entre os pontos (2, 1) e (2, 7)?"
    opcoes: ["6", "8", "9", "5"]
    resposta: 0
    explicacao: "Os dois têm o mesmo x: estão na mesma linha vertical. A distância é a diferença dos y: 7 − 1 = 6."
  - pergunta: "Qual é a distância entre a origem (0, 0) e o ponto (3, 4)?"
    opcoes: ["7", "25", "5", "1"]
    resposta: 2
    explicacao: "Ande 3 para o lado e 4 para cima: é um triângulo retângulo de catetos 3 e 4. A distância é a raiz de 9 + 16 = 25, ou seja, 5. Quem marcou 7 somou os catetos (o caminho pelas ruas)."
  - pergunta: "Qual é o ponto médio entre (2, 4) e (8, 10)?"
    opcoes: ["(10, 14)", "(6, 6)", "(3, 3)", "(5, 7)"]
    resposta: 3
    explicacao: "Ponto médio é a média de cada coordenada: (2 + 8) ÷ 2 = 5 e (4 + 10) ÷ 2 = 7. Fica (5, 7)."
---

```provocacao
Num bairro em que as ruas se cruzam em ângulo reto, o caminho a pé de casa até o posto de saúde tem 7 quarteirões. Um drone que fosse em linha reta voaria quantos quarteirões? Menos de 7, com certeza. Mas quanto menos?
```

## O que você vai aprender

Ao fim desta aula você vai localizar um ponto pelas coordenadas, medir a distância entre dois pontos de uma malha (a pé e em linha reta) e achar o ponto que fica exatamente no meio do caminho.

## Dois números para achar um lugar

Pense num cinema. O ingresso diz "fila F, cadeira 12". Com uma letra e um número você acha o lugar, sem precisar de mais nada. O plano cartesiano faz a mesma coisa com dois números.

Desenhe uma linha deitada, o **eixo x** (horizontal), e uma linha em pé, o **eixo y** (vertical). As duas se cruzam num ponto chamado **origem**, o (0, 0). Em cada eixo os números crescem como numa régua: no eixo x, para a direita é positivo e para a esquerda é negativo; no eixo y, para cima é positivo e para baixo é negativo.

Um ponto é escrito como um par **(x, y)**, sempre nessa ordem: primeiro quanto andar para o lado, depois quanto subir ou descer. O ponto (3, 2) fica 3 para a direita e 2 para cima. O ponto (−4, 1) fica 4 para a esquerda e 1 para cima. Trocar a ordem muda o lugar: (2, 3) não é o mesmo ponto que (3, 2).

Os dois eixos repartem o plano em quatro **quadrantes**, contados no sentido contrário ao do relógio, a partir do canto de cima à direita:

- 1º quadrante: x positivo e y positivo (cima, direita).
- 2º quadrante: x negativo e y positivo (cima, esquerda).
- 3º quadrante: x negativo e y negativo (baixo, esquerda).
- 4º quadrante: x positivo e y negativo (baixo, direita).

Ponto em cima de um eixo não está em quadrante nenhum: (0, 5) está no eixo y, e (−2, 0) está no eixo x.

## Distância na mesma linha

Quando dois pontos têm o mesmo y, eles estão na mesma linha horizontal. A distância entre eles é a diferença dos x, sempre positiva. De (−2, 3) até (5, 3) são 5 − (−2) = 7 unidades. Cuidado com o sinal: do −2 até o 0 já são 2 unidades, e do 0 até o 5 são mais 5.

Quando têm o mesmo x, estão na mesma linha vertical, e a distância é a diferença dos y.

Num mapa de ruas em quadrícula, quem anda a pé só anda na horizontal e na vertical. O caminho pelas ruas é a soma das duas diferenças: tanto para o lado, mais tanto para cima.

## Distância em linha reta

Agora o caso que mais cai: dois pontos em posição qualquer. Ligue um ao outro com um segmento. Depois, desenhe o caminho "pelas ruas": uma perna horizontal e uma vertical. Apareceu um **triângulo retângulo**. As pernas são os catetos. O segmento em linha reta é a hipotenusa, o lado maior, em frente ao ângulo reto.

O Teorema de Pitágoras diz que, no triângulo retângulo, a hipotenusa ao quadrado é a soma dos catetos ao quadrado. Daí sai a fórmula da distância.

```formula
d = √[(x₂ − x₁)² + (y₂ − y₁)²]
a distância é a raiz quadrada da soma de dois quadrados: a diferença dos x ao quadrado mais a diferença dos y ao quadrado
é Pitágoras: as diferenças são os catetos, e a distância é a hipotenusa
```

Como as diferenças vão ao quadrado, o sinal não importa: (−6)² e 6² dão os mesmos 36.

Figura descrita em palavras: numa malha, marque A em (1, 1) e B em (4, 5). Do A ande 3 casas para a direita, até (4, 1). De lá suba 4 casas, até B. O caminho a pé tem 3 + 4 = 7 casas. A linha reta de A até B fecha o triângulo, e mede √(9 + 16) = √25 = 5 casas.

```verificar
Qual é a distância, em linha reta, entre (1, 1) e (4, 5)?
- 7
+ 5
- 25
> Diferenças: 4 − 1 = 3 e 5 − 1 = 4. Quadrados: 9 e 16. Soma 25, raiz 5. O 7 é o caminho pelas ruas; o 25 é a soma antes da raiz.
```

## O ponto do meio

O **ponto médio** de um segmento fica à mesma distância das duas pontas. Para achá-lo, faça a média de cada coordenada: some os dois x e divida por 2; some os dois y e divida por 2.

```formula
M = ((x₁ + x₂) ÷ 2 ; (y₁ + y₂) ÷ 2)
o ponto médio tem como x a média dos x e como y a média dos y
```

Entre (2, 3) e (10, 7), o meio é ((2 + 10) ÷ 2 ; (3 + 7) ÷ 2) = (6, 5).

```navidareal
O mapa do celular localiza você com dois números, a latitude e a longitude. É a mesma ideia do par (x, y): um número diz quanto ao norte ou ao sul, o outro quanto a leste ou a oeste. Quando o aplicativo mostra "a 1,2 km em linha reta", ele fez uma conta de distância parecida com a desta aula. Quando mostra "15 minutos a pé", ele seguiu as ruas, e o caminho é maior.
```

## Exemplo resolvido

**Num mapa em quadrícula, cada lado de quadradinho vale 50 m. A casa de Dona Rosa fica no ponto (−2, 1) e a feira no ponto (4, 9). Qual é a distância em linha reta, em metros?**

1. Diferença dos x: 4 − (−2) = 6.
2. Diferença dos y: 9 − 1 = 8.
3. Quadrados: 6² = 36 e 8² = 64. Soma: 100.
4. Raiz: √100 = 10 unidades da malha.
5. Escala: 10 × 50 = 500 m.

Confira: pelas ruas seriam 6 + 8 = 14 unidades, 700 m. A linha reta tem de ser menor que isso e maior que a perna mais comprida (8 unidades, 400 m). 500 m está entre os dois.

## Como isso cai no ENEM

- **Formatos:** mapas e plantas em malha quadriculada (bairro, parque, campo de futebol), localização de um ponto pelas coordenadas, distância em linha reta contra caminho pelas ruas, ponto de encontro "no meio do caminho", alcance de uma antena ou de um sinal.
- **Habilidades:** H6 (interpretar posição e movimento no espaço e sua representação no plano) e H8 (resolver problemas de geometria de espaço e forma); quando o problema vira equação, H22 (usar álgebra e geometria para construir argumentos). Nas provas de 2022 e 2023, classificadas pelo instituto, o tópico plano cartesiano e distância entre pontos teve 2 das 81 questões de Matemática (2,5%). O objeto inteiro de conhecimentos algébricos e geométricos teve 4 (4,9%). São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Trocar a ordem do par: primeiro x (o lado), depois y (a altura).
  - Errar o sinal ao subtrair um número negativo: 5 − (−2) = 7.
  - Somar as diferenças quando a pergunta é a linha reta (ou o contrário).
  - Esquecer a raiz no fim da fórmula da distância.
  - Esquecer a escala do mapa: a conta dá unidades da malha, e a resposta pede metros.

## Questão comentada

**Texto-base.** Uma secretaria de saúde desenhou o mapa de um bairro numa malha quadriculada, em que o lado de cada quadradinho representa 100 m. A Unidade Básica de Saúde (UBS) está no ponto (1, 2) e uma escola está no ponto (7, 10). A secretaria quer testar a entrega de remédios por drone, que voa em linha reta.

**Comando.** A distância percorrida pelo drone, da UBS até a escola, é de

A) 1.400 m.
B) 1.000 m.
C) 10 m.
D) 600 m.
E) 800 m.

**Resolução.**

1. Diferença dos x: 7 − 1 = 6. Diferença dos y: 10 − 2 = 8.
2. Distância na malha: √(6² + 8²) = √(36 + 64) = √100 = 10 unidades.
3. Cada unidade vale 100 m: 10 × 100 = 1.000 m.

**Gabarito: B.**

**Por que as outras não:**

- A) 1.400 m: é o caminho pelas ruas, 6 + 8 = 14 unidades. O drone vai em linha reta, pela hipotenusa.
- C) 10 m: a distância na malha está certa, 10 unidades, mas falta a escala. Cada unidade vale 100 m.
- D) 600 m: é só o deslocamento horizontal. Falta a parte vertical.
- E) 800 m: é só o deslocamento vertical. Falta a parte horizontal.

```realidade
Desenhe o seu bairro numa folha quadriculada, com a sua casa na origem (0, 0). Marque o ponto de ônibus, a escola ou o posto de saúde mais perto. Quais são as coordenadas? Calcule o caminho pelas ruas e a distância em linha reta. Quanto a mais você anda por causa do traçado das ruas?
```

## Resumo

- Ponto é um par (x, y): primeiro o lado, depois a altura. A origem é (0, 0).
- Quadrantes: 1º (+, +), 2º (−, +), 3º (−, −), 4º (+, −).
- Mesma linha: a distância é a diferença de uma coordenada.
- Linha reta: d = √[(x₂ − x₁)² + (y₂ − y₁)²], que é Pitágoras.
- Ponto médio: a média dos x e a média dos y.
- No mapa, termine multiplicando pela escala.

## Para aprofundar

- [Números negativos](/trilhas/matematica-fundamental/numeros-negativos)
- [Potências e raízes](/trilhas/matematica-fundamental/potencias-e-raizes)
- [Teorema de Pitágoras e relações métricas](/trilhas/enem-matematica-geometria/pitagoras-e-relacoes-metricas)
- [Escalas](/trilhas/enem-matematica-proporcionalidade/escalas)
- [Equação da reta, paralelismo e perpendicularidade](/trilhas/enem-matematica-geometria/equacao-da-reta)
- [Formulário de matemática](/trilhas/enem-reta-final/formulario-de-matematica)
