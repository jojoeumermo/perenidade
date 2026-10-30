---
titulo: "Matemática, o essencial: geometria, dados e funções"
resumo: "Revisão condensada de dados, geometria e funções, na ordem do que mais caiu: média, mediana e moda, gráficos e tabelas, probabilidade, áreas e circunferência, prismas e cilindros, função afim e quadrática e plano cartesiano. Tudo com conta feita à mão."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
  - titulo: "Introductory Statistics 2e, seção 2.1, Stem-and-Leaf Graphs (Stemplots), Line Graphs, and Bar Graphs"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-1-stem-and-leaf-graphs-stemplots-line-graphs-and-bar-graphs"
  - titulo: "Introductory Statistics 2e, seção 2.5, Measures of the Center of the Data"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-5-measures-of-the-center-of-the-data"
  - titulo: "Introductory Statistics 2e, seção 3.1, Terminology"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-1-terminology"
  - titulo: "Introductory Statistics 2e, seção 3.2, Independent and Mutually Exclusive Events"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/3-2-independent-and-mutually-exclusive-events"
  - titulo: "Prealgebra 2e, seção 9.5, Solve Geometry Applications: Circles and Irregular Figures"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-5-solve-geometry-applications-circles-and-irregular-figures"
  - titulo: "Prealgebra 2e, seção 9.6, Solve Geometry Applications: Volume and Surface Area"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-6-solve-geometry-applications-volume-and-surface-area"
  - titulo: "Prealgebra 2e, seção 11.1, Use the Rectangular Coordinate System"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/11-1-use-the-rectangular-coordinate-system"
  - titulo: "Algebra and Trigonometry 2e, seção 4.1, Linear Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/4-1-linear-functions"
  - titulo: "Algebra and Trigonometry 2e, seção 5.1, Quadratic Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/5-1-quadratic-functions"
quiz:
  - pergunta: "Numa pequena empresa, os salários são R$ 1.500, R$ 1.600, R$ 1.700, R$ 1.800 e R$ 9.000. Que medida representa melhor o salário típico de quem trabalha ali?"
    opcoes: ["A média", "A mediana", "A soma", "O maior valor"]
    resposta: 1
    explicacao: "A média é 15.600 ÷ 5 = R$ 3.120, puxada para cima pelo salário de R$ 9.000. Quatro das cinco pessoas ganham bem menos que isso. A mediana, R$ 1.700, é o valor do meio e não se deixa levar pelo valor extremo."
  - pergunta: "Numa urna há 3 bolas vermelhas e 7 azuis. Tirando uma bola ao acaso, qual é a probabilidade de ela ser vermelha?"
    opcoes: ["3/7", "7/10", "1/3", "3/10"]
    resposta: 3
    explicacao: "Casos favoráveis: 3 vermelhas. Casos possíveis: 3 + 7 = 10 bolas. A probabilidade é 3/10. Quem marca 3/7 dividiu as vermelhas pelas azuis, e não pelo total."
  - pergunta: "Uma praça circular tem 20 m de diâmetro. Usando π = 3, quanto mede uma volta completa em torno dela?"
    opcoes: ["60 m", "120 m", "300 m", "30 m"]
    resposta: 0
    explicacao: "O raio é a metade do diâmetro: 10 m. C = 2 · π · r = 2 × 3 × 10 = 60 m. Quem chega a 120 m usou o diâmetro no lugar do raio; 300 é a área (3 × 10²), em metros quadrados."
  - pergunta: "Uma lata cilíndrica tem raio de 5 cm e altura de 10 cm. Usando π = 3, qual é o volume?"
    opcoes: ["150 cm³", "300 cm³", "750 cm³", "1.500 cm³"]
    resposta: 2
    explicacao: "V = π · r² · h = 3 × 5² × 10 = 3 × 25 × 10 = 750 cm³. Como 1.000 cm³ são 1 litro, cabem 0,75 litro."
  - pergunta: "Um táxi cobra R$ 6 de bandeirada (valor fixo) e R$ 3 por quilômetro. Quanto custa uma corrida de 8 km?"
    opcoes: ["R$ 54", "R$ 30", "R$ 24", "R$ 17"]
    resposta: 1
    explicacao: "É uma função afim: preço = 6 + 3 · km. Para 8 km: 6 + 3 × 8 = 6 + 24 = 30. Quem marca 24 esqueceu a bandeirada."
---

```provocacao
Uma reportagem diz que o salário médio de uma empresa é alto. Isso quer dizer que a maior parte das pessoas que trabalham ali ganha perto desse valor?
```

## O que você vai aprender

Ao fim desta aula você vai ter revisado dados, geometria e funções, na ordem do que mais caiu: média, mediana e moda, gráficos e tabelas, probabilidade, áreas e circunferência, prismas e cilindros, função afim, função quadrática e plano cartesiano. Cada parte traz um jeito de fazer a conta à mão.

## Por que esta ordem

Nas provas de 2022 e 2023, classificadas pelo instituto, 81 questões de Matemática entraram na contagem. A geometria ficou com 24 (29,6%), a estatística e a probabilidade com 18 (22,2%), a álgebra com 11 (13,6%) e a parte que junta álgebra e geometria com 4 (4,9%).

O tópico que mais apareceu em toda a prova foi média, mediana e moda: 6 questões, mais 2 de média ponderada. Gráficos tiveram 4 e tabelas, 2. A probabilidade teve 4, divididas entre eventos independentes e probabilidade condicional. Circunferência, prismas e cilindros, função quadrática e leitura de gráficos de funções tiveram 3 cada. Áreas, função afim e plano cartesiano tiveram 2 cada.

São só duas provas: a contagem mostra uma tendência, não uma promessa. Com poucos dias, ela ajuda a escolher o que revisar primeiro.

## Média, mediana e moda

São três jeitos de resumir uma lista de números num valor só.

- **Média:** some todos os valores e divida pela quantidade de valores.
- **Mediana:** ponha os valores em ordem e pegue o do meio. Se a quantidade for par, faça a média dos dois do meio.
- **Moda:** o valor que mais se repete.

A mediana pede os dados em ordem. Esse é o erro mais comum: pegar o valor do meio da lista como ela veio.

A média sente os valores extremos; a mediana, não. Com salários de 1.500, 1.600, 1.700, 1.800 e 9.000 reais, a média é 3.120 e a mediana é 1.700. É por isso que um salário médio alto pode esconder que quase todo mundo ganha pouco.

Na **média ponderada**, cada valor tem um peso. Multiplique cada valor pelo seu peso, some tudo e divida pela soma dos pesos. Notas 8, 6 e 7 com pesos 1, 2 e 2 dão (8 + 12 + 14) ÷ 5 = 34 ÷ 5 = 6,8.

```verificar
Qual é a mediana de 4, 9, 2 e 7?
- 9
+ 5,5
- 5
> Ponha em ordem: 2, 4, 7, 9. A quantidade é par, então a mediana é a média dos dois do meio: (4 + 7) ÷ 2 = 5,5.
```

## Gráficos e tabelas

Antes de olhar as barras, leia o título, os eixos e as unidades. Muita questão se resolve só aí: "em milhares", "por 100 mil habitantes", "em porcentagem".

Três cuidados:

1. Veja onde o eixo começa. Um eixo que não começa no zero faz uma diferença pequena parecer enorme.
2. Separe aumento absoluto de aumento percentual. De 100 para 130 é um aumento de 30 unidades e de 30%. De 130 para 150 é um aumento de 20 unidades, mas de só 20 ÷ 130, cerca de 15%.
3. No gráfico de setores (a "pizza"), o círculo inteiro é 100% e tem 360°. Então 25% é um quarto do círculo, 90°.

Nas tabelas, confira se há linha ou coluna de total. Muitas questões pedem uma parte do total, e a resposta é uma divisão.

## Probabilidade

```formula
P(A) = casos favoráveis ÷ casos possíveis
a probabilidade é o número de casos que interessam dividido pelo número de casos possíveis, todos com a mesma chance
o resultado vai de 0 (impossível) a 1 (certo); vezes 100, vira porcentagem
```

Quatro regras resolvem quase tudo:

- **Complementar:** a chance de não acontecer é 1 − P. Se a chance de chover é 0,3, a de não chover é 0,7.
- **"E", com eventos independentes:** quando um não muda a chance do outro, multiplique. Duas moedas dando cara: 1/2 × 1/2 = 1/4.
- **"Ou":** some as chances e tire o que foi contado duas vezes.
- **Condicional ("dado que", "sabendo que"):** o universo encolhe. Numa turma de 40 pessoas, 25 trabalham, e 15 dessas 25 estudam à noite. Sorteando alguém que trabalha, a chance de estudar à noite é 15/25 = 3/5. O denominador é 25, não 40.

Para "pelo menos um", costuma ser mais rápido calcular o contrário: 1 − P(nenhum).

## Áreas e circunferência

A área mede a superfície, em unidades quadradas (m², cm²).

- Retângulo: base × altura.
- Triângulo: base × altura ÷ 2.
- Trapézio: (base maior + base menor) × altura ÷ 2.

```formula
A = π · r²        C = 2 · π · r
área do círculo: pi vezes o raio ao quadrado; comprimento da circunferência: dois vezes pi vezes o raio
o raio é a metade do diâmetro; a prova diz que valor usar para pi (3 ou 3,14)
```

Atenção ao quadrado. Dobrar o raio multiplica a área por 4. Uma pizza de 40 cm de diâmetro tem 4 vezes a área de uma de 20 cm, e não o dobro.

Figuras estranhas quase sempre são juntas ou recortes de figuras simples. Some as partes, ou calcule o todo e tire o pedaço que falta.

## Prismas e cilindros

Prisma e cilindro têm a mesma regra: o volume é a área da base vezes a altura.

```formula
V = A da base · h        V do cilindro = π · r² · h
volume do prisma ou do cilindro: área da base vezes a altura, em unidades cúbicas
1 m³ = 1.000 litros; 1 litro = 1.000 cm³
```

Uma caixa-d'água em forma de bloco, com 2 m por 1,5 m por 1 m, tem 2 × 1,5 × 1 = 3 m³, ou 3.000 litros.

No cilindro, o raio entra ao quadrado. Dobrar o raio multiplica o volume por 4; dobrar a altura, só por 2. É assim que a prova compara embalagens.

## Funções: afim, quadrática e leitura de gráficos

Uma função liga duas grandezas: para cada valor de x, há um valor de y.

```formula
f(x) = a · x + b
função afim: a é quanto y muda quando x aumenta 1; b é o valor fixo, quando x é zero
o gráfico é uma reta; a = (y₂ − y₁) ÷ (x₂ − x₁)
```

Na vida, a função afim é "um valor fixo mais um valor por unidade": taxa de entrega mais preço por quilômetro, assinatura mais preço por minuto.

A função quadrática, f(x) = a · x² + b · x + c, tem gráfico em forma de parábola. Ela aparece em lucro, área e lançamento de objetos.

```formula
x do vértice = −b ÷ (2 · a)
o vértice é o ponto de virada da parábola
com a negativo, o vértice é o máximo; com a positivo, é o mínimo
```

Para achar o valor máximo, calcule o x do vértice e ponha esse x na função. Cuidado: a prova pode pedir o x (o preço, o tempo) ou o y (o lucro, a altura). Releia o comando.

Para ler o gráfico de uma função, pergunte: onde ela cresce, onde decresce, onde atinge o máximo e onde cruza um certo valor.

## Plano cartesiano

Cada ponto do plano é um par (x, y): primeiro a posição na horizontal, depois na vertical.

A distância entre dois pontos sai do teorema de Pitágoras. De (1, 2) a (4, 6), anda-se 3 na horizontal e 4 na vertical. A distância é √(3² + 4²) = √25 = 5.

Muitas questões usam o plano como mapa: ruas, quarteirões, posição de uma antena. Desenhe os pontos no rascunho antes de calcular.

## Exemplo resolvido

**Uma associação de moradores vai alugar caixas de som para uma festa. A locadora A cobra R$ 50 de taxa e R$ 2 por hora. A locadora B cobra R$ 20 de taxa e R$ 5 por hora. A partir de quantas horas a locadora A fica mais barata?**

1. Escreva cada preço como função das horas, x. Locadora A: 50 + 2x. Locadora B: 20 + 5x.
2. Ache o ponto em que os preços se igualam: 50 + 2x = 20 + 5x.
3. Passe os números para um lado e o x para o outro: 50 − 20 = 5x − 2x, ou seja, 30 = 3x. Então x = 10 horas.
4. Com 10 horas, as duas cobram o mesmo: 50 + 20 = 70 e 20 + 50 = 70.
5. Teste um valor maior, 12 horas: A cobra 50 + 24 = 74; B cobra 20 + 60 = 80. Passando de 10 horas, a locadora A fica mais barata.

Confira no gráfico: são duas retas. A de B começa mais baixa (20) mas sobe mais rápido (5 por hora). Elas se cruzam em x = 10, e depois disso a reta de A fica embaixo.

## Como isso cai no ENEM

- **Formatos:** tabelas e gráficos de dados reais ou parecidos com reais, embalagens para comparar, plantas de terrenos, modelos de lucro e de lançamento. Muitas questões descrevem a situação e deixam a fórmula por sua conta.
- **Habilidades:** nas provas de 2022 e 2023, classificadas pelo instituto, a H8 (resolver problemas de geometria de espaço e forma) teve 9 das 81 questões de Matemática; a H21 (resolver problemas cuja modelagem pede álgebra) e a H27 (calcular médias, moda, mediana ou dispersão) tiveram 7 cada; a H20 (interpretar gráficos cartesianos) teve 5; a H24 (fazer inferências a partir de gráficos ou tabelas), a H25 (resolver problemas com dados de tabelas ou gráficos) e a H28 (resolver problemas de estatística e probabilidade) tiveram 4 cada.
- **Armadilhas:**
  - Achar a mediana sem pôr os dados em ordem.
  - Fazer média simples quando a questão dá pesos.
  - Na probabilidade condicional, dividir pelo total em vez de dividir pelo grupo do "dado que".
  - Usar o diâmetro no lugar do raio.
  - Esquecer que área e volume crescem com o quadrado do raio.
  - Na quadrática, responder o x do vértice quando a pergunta pede o valor máximo, ou o contrário.
  - Ler o gráfico sem olhar a unidade do eixo.
- **Na prova:** sem calculadora. Use os valores de π que a questão der e prefira deixar as contas em frações até o fim.

## Questão comentada

**Texto-base.** Uma cooperativa de catadores anotou quantos quilogramas de latinhas recolheu em cada dia de uma semana: segunda, 110; terça, 95; quarta, 160; quinta, 80; sexta, 95; sábado, 130; domingo, 100. Para planejar a compra de sacos, a cooperativa quer usar um valor que não seja puxado pelos dias muito bons ou muito fracos.

**Comando.** A mediana da quantidade recolhida por dia, em quilogramas, foi de

A) 80.
B) 95.
C) 110.
D) 100.
E) 120.

**Resolução.**

1. Ponha os valores em ordem: 80, 95, 95, 100, 110, 130, 160.
2. São 7 valores, uma quantidade ímpar. O do meio é o 4º.
3. O 4º valor é 100.

**Gabarito: D.**

**Por que as outras não:**

- A) 80: é o 4º valor da lista na ordem dos dias (quinta-feira), sem ordenar. A mediana exige a lista em ordem crescente.
- B) 95: é a moda, o valor que mais se repete (terça e sexta). Moda e mediana são medidas diferentes.
- C) 110: é a média, (80 + 95 + 95 + 100 + 110 + 130 + 160) ÷ 7 = 770 ÷ 7. A pergunta pede a mediana.
- E) 120: é a média entre o menor e o maior valor, (80 + 160) ÷ 2. Isso não é nenhuma das três medidas.

```realidade
Anote quanto você gastou com transporte em cada dia da última semana. Calcule a média e a mediana. Elas ficaram parecidas ou distantes? Que dia puxou a média?
```

## Resumo

- Mediana pede os dados em ordem. A média sente os extremos; a mediana, não.
- Média ponderada: valor vezes peso, somado, dividido pela soma dos pesos.
- Em gráficos, leia título, eixos e unidades primeiro. Aumento percentual divide pelo valor de partida.
- Probabilidade: favoráveis ÷ possíveis. "E" independente multiplica; "dado que" encolhe o universo.
- Círculo: A = π · r² e C = 2 · π · r. O raio é a metade do diâmetro.
- Prisma e cilindro: área da base vezes altura. 1 m³ = 1.000 L.
- Função afim: fixo mais valor por unidade. Quadrática: o vértice dá o máximo ou o mínimo.
- Distância no plano é Pitágoras.

## Para aprofundar

- [Estatística: média, mediana e moda](/trilhas/matematica-medio/estatistica-media-mediana-e-moda)
- [Média, mediana e moda](/trilhas/estatistica-para-ler-o-brasil/media-mediana-e-moda)
- [Leitura de gráficos e tabelas](/trilhas/matematica-fundamental/leitura-de-graficos-e-tabelas)
- [Como ler um gráfico sem ser enganado](/trilhas/estatistica-para-ler-o-brasil/como-ler-um-grafico-sem-ser-enganado)
- [Matemática: ler gráficos e tabelas](/trilhas/enem-por-area/matematica-ler-graficos-e-tabelas)
- [Probabilidade](/trilhas/matematica-medio/probabilidade)
- [Perímetro e área](/trilhas/matematica-fundamental/perimetro-e-area)
- [Geometria plana](/trilhas/matematica-medio/geometria-plana)
- [Geometria espacial](/trilhas/matematica-medio/geometria-espacial)
- [Funções: a ideia](/trilhas/matematica-medio/funcoes-a-ideia)
- [Função do 1º grau](/trilhas/matematica-medio/funcao-do-1-grau)
- [Função do 2º grau](/trilhas/matematica-medio/funcao-do-2-grau)
- [Formulário de matemática](/trilhas/enem-reta-final/formulario-de-matematica)
