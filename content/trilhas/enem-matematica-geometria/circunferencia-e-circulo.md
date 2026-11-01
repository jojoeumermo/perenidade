---
titulo: "Circunferência e círculo"
resumo: "Raio, diâmetro, comprimento da circunferência, área do círculo, arcos, setores e coroas, do jeito que o ENEM cobra: rodas, pizzas, praças e aspersores."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Contemporary Mathematics, seção 10.4, Polygons, Perimeter, and Circumference"
    autor: "Donna Kirk (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/10-4-polygons-perimeter-and-circumference"
  - titulo: "Contemporary Mathematics, seção 10.6, Area"
    autor: "Donna Kirk (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/10-6-area"
  - titulo: "Archimedes of Syracuse (biografia)"
    autor: "J. J. O'Connor e E. F. Robertson, MacTutor History of Mathematics, Universidade de St Andrews"
    url: "https://mathshistory.st-andrews.ac.uk/Biographies/Archimedes/"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma tampa circular tem 5 cm de raio. Usando π = 3,14, qual é o comprimento da borda dessa tampa?"
    opcoes: ["15,7 cm", "31,4 cm", "78,5 cm", "10 cm"]
    resposta: 1
    explicacao: "O comprimento da circunferência é 2 · π · r = 2 × 3,14 × 5 = 31,4 cm. 15,7 é só π · r (faltou o 2), 78,5 é a área (π · r²) e 10 é o diâmetro."
  - pergunta: "Se o raio de um círculo dobra, a área fica multiplicada por:"
    opcoes: ["2", "3", "4", "8"]
    resposta: 2
    explicacao: "Na área, o raio entra ao quadrado: (2r)² = 4r². Dobrar o raio multiplica a área por 4. O comprimento da borda, esse sim, só dobra."
  - pergunta: "Um canteiro circular tem 10 m de diâmetro. Usando π = 3, qual é a área do canteiro?"
    opcoes: ["75 m²", "300 m²", "30 m²", "150 m²"]
    resposta: 0
    explicacao: "O raio é a metade do diâmetro: 5 m. A área é π · r² = 3 × 25 = 75 m². Quem chega a 300 usou o diâmetro no lugar do raio; 30 é o comprimento da borda."
  - pergunta: "Uma fatia de pizza é um setor de 90° num círculo de raio 4 cm. Usando π = 3, qual é a área da fatia?"
    opcoes: ["48 cm²", "24 cm²", "6 cm²", "12 cm²"]
    resposta: 3
    explicacao: "90° é um quarto de volta (90 ÷ 360 = 1/4). O círculo inteiro tem 3 × 16 = 48 cm². Um quarto disso é 12 cm²."
---

```provocacao
A roda de uma bicicleta tem 70 cm de diâmetro. Quantas voltas ela dá enquanto você pedala 1 km até o trabalho?
```

## O que você vai aprender

Ao fim desta aula você vai saber a diferença entre circunferência e círculo, calcular o comprimento de uma borda redonda e a área de uma região redonda, e trabalhar com pedaços do círculo: arcos, setores (as fatias) e coroas (os anéis). Vai também saber por que dobrar o raio não dobra a área.

## Circunferência e círculo não são a mesma coisa

Pense num bambolê e numa pizza. O bambolê é só a borda. A pizza é a borda com tudo o que tem dentro.

A **circunferência** é a linha: o conjunto dos pontos que ficam à mesma distância de um ponto, o **centro**. O **círculo** é a região: a circunferência mais todo o seu interior. Na borda medimos comprimento, em metros ou centímetros. Na região medimos área, em metros quadrados ou centímetros quadrados.

Três medidas aparecem em toda questão:

- **Raio (r):** a distância do centro até a borda.
- **Diâmetro (d):** o segmento que atravessa o círculo passando pelo centro. Ele vale dois raios: d = 2r.
- **Corda:** qualquer segmento que liga dois pontos da borda. O diâmetro é a maior corda.

A primeira armadilha do ENEM mora aqui. A questão dá o diâmetro (de uma roda, de um cano, de uma pizza) e a fórmula pede o raio. Antes de qualquer conta, pergunte: este número é raio ou diâmetro?

## O número π

Pegue qualquer objeto redondo: uma lata, um prato, uma roda. Meça a volta com um barbante e divida pelo diâmetro. O resultado sempre dá um pouco mais que 3. Esse número fixo se chama **π** (lê-se "pi") e vale cerca de 3,14159.

Não é coincidência de medida: em toda circunferência, o comprimento dividido pelo diâmetro é o mesmo número. Por isso a volta de uma roda é sempre "um pouco mais que três diâmetros".

Na prova, o enunciado costuma dizer que valor usar: 3 ou 3,14. Use exatamente o que ele mandar, porque as alternativas foram calculadas com aquele valor.

```formula
C = 2 · π · r   (ou C = π · d)
o comprimento da circunferência é dois vezes pi vezes o raio, ou pi vezes o diâmetro
o resultado é um comprimento: metros, centímetros
```

```historia
# Arquimedes cerca o π, Siracusa, século III a.C.
Arquimedes viveu em Siracusa, na ilha da Sicília, entre 287 e 212 a.C. Sem calculadora e sem os números decimais que usamos hoje, ele quis saber quanto vale a razão entre a volta e o diâmetro.

O método foi desenhar polígonos regulares por dentro e por fora do círculo e ir dobrando o número de lados até chegar a 96. A volta do círculo fica sempre entre o perímetro do polígono de dentro e o do polígono de fora. Assim ele mostrou que π fica entre 3 10/71 e 3 1/7, isto é, entre cerca de 3,1408 e 3,1429.

O "3,14" que a prova manda usar é herdeiro dessa conta feita à mão há mais de dois mil anos.
```

## A área do círculo

Agora a região de dentro. Imagine cortar uma pizza em muitas fatias finas e encaixá-las alternando, uma com a ponta para cima e outra com a ponta para baixo. A figura fica quase um retângulo. A altura desse retângulo é o raio. A base é metade da volta, ou seja, π · r. Base vezes altura dá π · r · r.

```formula
A = π · r²
a área do círculo é pi vezes o raio ao quadrado
o resultado é uma área: metros quadrados, centímetros quadrados
```

Como o raio entra ao quadrado, a área cresce mais depressa que o raio. Raio duas vezes maior dá área quatro vezes maior. Raio três vezes maior dá área nove vezes maior. É isso que o ENEM testa quando compara pizzas, tampas ou canteiros de tamanhos diferentes.

```verificar
Uma pizza grande tem 40 cm de diâmetro. Duas pizzas médias têm 30 cm de diâmetro cada uma. Onde tem mais pizza?
- Na grande, porque 40 é maior que 30
+ Nas duas médias juntas
- É igual
> Compare as áreas. A grande tem raio 20: π · 400. Cada média tem raio 15: π · 225, e duas médias dão π · 450. O π é o mesmo dos dois lados, então basta comparar 400 com 450.
```

## Pedaços do círculo: arco, setor e coroa

Muitas questões não usam o círculo inteiro, e sim uma parte dele. A ideia é sempre a mesma: a parte é proporcional ao ângulo. A volta inteira tem 360°. Meia volta tem 180°, um quarto de volta tem 90°.

- **Arco** é um pedaço da borda. O comprimento do arco é a fração do ângulo vezes a volta inteira.
- **Setor** é uma fatia, como a de pizza. A área do setor é a fração do ângulo vezes a área inteira.
- **Coroa** é o anel entre duas circunferências de mesmo centro, como uma calçada em volta de uma praça redonda. A área da coroa é a área do círculo grande menos a do pequeno.

```formula
arco = (ângulo ÷ 360) · 2 · π · r      setor = (ângulo ÷ 360) · π · r²      coroa = π · (R² − r²)
o arco e o setor são a mesma fração da volta que o ângulo é de 360 graus
a coroa é o círculo grande menos o pequeno; R é o raio de fora e r é o de dentro
```

Cuidado com a coroa: a conta é π · (R² − r²), e não π · (R − r)². Elevar a diferença ao quadrado dá um número bem menor e errado.

```navidareal
Volte à bicicleta da provocação. A roda tem 70 cm de diâmetro, ou 0,7 m. Cada volta completa leva a bicicleta para a frente um comprimento de circunferência: π · d = 3,14 × 0,7 = 2,198 m, quase 2,2 m.

Para andar 1 km, que são 1.000 m, a roda dá 1.000 ÷ 2,198, perto de 455 voltas. É assim que o velocímetro de bicicleta funciona: ele conta as voltas da roda e multiplica pela volta de uma roda.
```

## Exemplo resolvido

**Uma praça redonda tem 20 m de diâmetro. A prefeitura vai fazer, em volta dela, uma calçada de 2 m de largura e uma grade na borda de fora da calçada. Usando π = 3, quantos metros quadrados de calçada serão feitos e quantos metros de grade serão necessários?**

1. Raio da praça: metade de 20 m, ou seja, r = 10 m.
2. Raio de fora da calçada: a calçada soma 2 m ao raio. R = 10 + 2 = 12 m. (Não some 2 m ao diâmetro: a calçada aparece dos dois lados.)
3. Área da calçada é a coroa: π · (R² − r²) = 3 × (144 − 100) = 3 × 44 = 132 m².
4. A grade fica na borda de fora: C = 2 · π · R = 2 × 3 × 12 = 72 m.

Confira: a calçada tem 2 m de largura e dá uma volta de uns 66 m no meio dela (2 × 3 × 11). 2 × 66 = 132. A conta bate por outro caminho.

## Como isso cai no ENEM

- **Formatos:** rodas e engrenagens (quantas voltas para andar uma distância), comparação de pizzas, tampas e canteiros pela área, aspersores e radares que cobrem um setor, pistas e praças com calçada em volta (coroa), relógios e ângulos de ponteiros. Quase sempre o enunciado dá o valor de π.
- **Habilidades:** H8 (resolver problemas de geometria de espaço e forma), H7 (identificar características de figuras planas e espaciais) e H12 (resolver problemas com medidas de grandezas). Nas provas de 2022 e 2023, classificadas pelo instituto, o tópico circunferência e círculo teve 3 das 81 questões de Matemática (3,7%), entre os mais frequentes da geometria. A H8 foi a segunda habilidade de Matemática que mais apareceu: 9 questões (11,1%). São só duas provas: a contagem mostra tendência, não promessa.
- **Armadilhas:**
  - Usar o diâmetro no lugar do raio.
  - Confundir comprimento (2πr) com área (πr²).
  - Achar que dobrar o raio dobra a área. Ela quadruplica.
  - Na coroa, fazer π · (R − r)² em vez de π · (R² − r²).
  - No setor, esquecer de multiplicar pela fração do ângulo.

## Questão comentada

**Texto-base.** Numa horta comunitária, um aspersor fica preso ao chão e gira de um lado para o outro, sempre no mesmo ângulo. Ele molha uma região em forma de setor circular de 120°, com alcance de 6 m a partir do aspersor. A horta quer saber quanta área esse aspersor rega. Use π = 3.

**Comando.** A área molhada pelo aspersor, em metro quadrado, é

A) 12.
B) 18.
C) 36.
D) 108.
E) 144.

**Resolução.**

1. O alcance é o raio do setor: r = 6 m.
2. O círculo inteiro teria área π · r² = 3 × 36 = 108 m².
3. 120° é que fração da volta? 120 ÷ 360 = 1/3.
4. Área molhada: 108 ÷ 3 = 36 m².

**Gabarito: C.**

**Por que as outras não:**

- A) 12: esse é o comprimento do arco molhado, em metros: (1/3) × 2 × 3 × 6 = 12. A pergunta pede área.
- B) 18: a fração foi tomada como 1/6. Mas 120° é um terço de 360°, não um sexto.
- D) 108: essa é a área do círculo inteiro. O aspersor só gira 120°.
- E) 144: o diâmetro, 12 m, entrou no lugar do raio: (1/3) × 3 × 144 = 144. O alcance já é o raio.

```realidade
Procure em casa três objetos redondos: um prato, uma tampa, um copo. Meça a volta de cada um com um barbante e o diâmetro com uma régua. Divida a volta pelo diâmetro e anote. Os três resultados ficaram perto de 3,14?
```

## Resumo

- Circunferência é a borda; círculo é a região. Diâmetro = 2 × raio.
- Comprimento da circunferência: C = 2 · π · r. Área do círculo: A = π · r².
- Use o valor de π que o enunciado mandar.
- Raio duas vezes maior: borda duas vezes maior, área quatro vezes maior.
- Arco e setor: a fração do ângulo (ângulo ÷ 360) vezes a volta ou a área inteira.
- Coroa: π · (R² − r²).

## Para aprofundar

- [Perímetro e área](/trilhas/matematica-fundamental/perimetro-e-area)
- [Geometria plana](/trilhas/matematica-medio/geometria-plana)
- [Matemática, o essencial: geometria, dados e funções](/trilhas/enem-reta-final/matematica-o-essencial-geometria-dados-e-funcoes)
- [Formulário de matemática](/trilhas/enem-reta-final/formulario-de-matematica)
- [Matemática: o que mais cai](/trilhas/enem-por-area/matematica-o-que-mais-cai)
