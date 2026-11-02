---
titulo: "Planificações"
resumo: "Abrir uma caixa, uma lata ou um cone em cima da mesa: reconhecer o sólido pelo molde, saber que faces ficam opostas e calcular quanto material o molde gasta."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Contemporary Mathematics, seção 10.7, Volume and Surface Area"
    autor: "Donna Kirk (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/contemporary-mathematics/pages/10-7-volume-and-surface-area"
  - titulo: "Prealgebra 2e, seção 9.6, Solve Geometry Applications: Volume and Surface Area"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-6-solve-geometry-applications-volume-and-surface-area"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma planificação tem dois círculos iguais e um retângulo. Ela monta qual sólido?"
    opcoes: ["Cone", "Cilindro", "Esfera", "Pirâmide"]
    resposta: 1
    explicacao: "Os dois círculos são as tampas e o retângulo é a parte curva, enrolada. É o cilindro, como uma lata."
  - pergunta: "Quantas faces aparecem na planificação de um prisma de base hexagonal?"
    opcoes: ["6", "12", "8", "7"]
    resposta: 2
    explicacao: "Duas bases hexagonais e seis faces laterais retangulares (uma para cada lado do hexágono): 2 + 6 = 8."
  - pergunta: "O rótulo de uma lata cilíndrica de 3 cm de raio, aberto, é um retângulo. Usando π = 3, quanto mede o lado do retângulo que dava a volta na lata?"
    opcoes: ["18 cm", "9 cm", "6 cm", "27 cm"]
    resposta: 0
    explicacao: "Esse lado é a volta da lata, o comprimento da circunferência: 2 · π · r = 2 × 3 × 3 = 18 cm."
  - pergunta: "A planificação de uma pirâmide de base quadrada é formada por:"
    opcoes: ["5 quadrados", "2 quadrados e 4 retângulos", "1 círculo e 1 setor circular", "1 quadrado e 4 triângulos"]
    resposta: 3
    explicacao: "A base é o quadrado. Cada lado da base tem uma face triangular que sobe até o vértice: 4 triângulos."
---

```provocacao
Pegue uma caixa de remédio vazia e desmonte com cuidado, sem rasgar. O que fica em cima da mesa é uma figura plana. Olhando só essa figura, alguém conseguiria dizer qual era a caixa?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer o sólido que um molde monta, saber se um molde de cubo fecha, descobrir quais faces ficam opostas depois de montado e calcular a área do molde, que é o material gasto na embalagem.

## O que é planificar

**Planificar** um sólido é abrir a superfície dele e deitá-la num plano, sem sobrepor nem rasgar as faces. O resultado se chama **planificação** (ou molde). É o caminho de quem fabrica embalagens: a caixa nasce como uma folha de papelão recortada e dobrada.

Duas ideias atravessam a aula inteira:

- A planificação tem **todas as faces** do sólido, cada uma com a forma e o tamanho que tem nele.
- A área da planificação é a **área total** do sólido. Abrir não aumenta nem diminui o material.

## Os moldes de cada sólido

Cada família de sólidos tem um molde com cara própria. Figuras descritas em palavras:

- **Cubo:** seis quadrados iguais. O molde mais conhecido é a cruz: uma fileira de quatro quadrados em pé e um quadrado de cada lado do segundo.
- **Prisma reto:** as duas bases (triângulos, quadrados, hexágonos) e uma faixa de retângulos, um para cada lado da base. Um prisma triangular tem 2 triângulos e 3 retângulos.
- **Cilindro:** dois círculos (as tampas) e um retângulo (a lateral). Um lado do retângulo é a altura; o outro é a volta do círculo, 2 · π · r.
- **Pirâmide:** a base e um triângulo para cada lado dela, todos com a ponta voltada para fora, como uma estrela.
- **Cone:** um círculo (a base) e um **setor circular**, uma fatia de pizza, que enrolado vira a parte inclinada.

A **esfera** não tem planificação exata: não dá para abrir uma bola sobre a mesa sem rasgar ou esticar. É por isso que todo mapa-múndi deforma alguma parte do planeta.

## O cubo: o molde fecha?

Seis quadrados juntos nem sempre fecham um cubo. Há exatamente 11 moldes diferentes que fecham. Em vez de decorar, teste com duas regras:

1. **Nada de quatro quadrados formando um quadrado maior** (2 por 2). Num cubo, uma quina junta só três faces.
2. **Numa fileira de quatro, os dois quadrados de fora vão um de cada lado.** A fileira de quatro dá a volta no cubo (frente, cima, trás, baixo). Os dois que sobram são as faces da esquerda e da direita. Se ficarem do mesmo lado da fileira, os dois vão parar no mesmo lugar.

Para saber que faces ficam **opostas** (frente e trás, cima e baixo): numa fileira reta de quadrados, as faces opostas ficam "pulando uma". Na cruz, o primeiro e o terceiro da fileira são opostos; o segundo e o quarto também; e os dois quadrados dos lados são opostos entre si. Duas faces que se encostam no molde nunca são opostas.

```verificar
No molde em cruz de um cubo, a fileira em pé tem quatro quadrados, de cima para baixo: A, B, C e D. Qual face fica oposta à face A, depois de montado?
- B
+ C
- D
> Numa fileira reta, os opostos ficam pulando um: A com C, e B com D. O B encosta no A, então não pode ser oposto.
```

## O cone e o setor

O cone é o molde que mais engana. O setor circular tem como raio a **geratriz** do cone, g, que é a distância da ponta até a borda da base, pela superfície. E o arco do setor, a parte curva, é a volta da base: 2 · π · r.

Daí sai o ângulo do setor. A geratriz forma um círculo inteiro de volta 2 · π · g. O setor usa só a parte 2 · π · r dela:

```formula
ângulo do setor = 360° · r ÷ g
o ângulo da fatia é a volta inteira multiplicada pela razão entre o raio da base e a geratriz
a área da lateral do cone é π · r · g, pi vezes o raio da base vezes a geratriz
```

Um cone com raio da base 6 cm e geratriz 10 cm tem setor de 360 × 6 ÷ 10 = 216°, um pouco mais que meio círculo.

## A área do molde

Como a planificação é a superfície aberta, a área dela é a soma das áreas das faces:

- Cubo de aresta a: 6 · a².
- Prisma: 2 bases + perímetro da base × altura.
- Cilindro: 2 · π · r² + 2 · π · r · h.
- Pirâmide: base + soma dos triângulos (cada um com a altura dele, chamada **apótema** da pirâmide, que não é a altura da pirâmide).
- Cone: π · r² + π · r · g.

```navidareal
Embalagens de papelão saem da fábrica como uma folha recortada, com abas para colar e fechar, e chegam ao mercado montadas. Quando uma loja recebe caixas "desmontadas", está recebendo planificações empilhadas: elas ocupam muito menos espaço no caminhão. A conta de área do molde, mais a sobra das abas, é o que define quanto papelão a fábrica compra.
```

## Exemplo resolvido

**Uma caixa de presente tem forma de pirâmide de base quadrada, com 10 cm de lado da base. Cada face triangular tem 13 cm de altura, medida do meio do lado da base até a ponta, pela face. Quantos centímetros quadrados de papel tem o molde, sem abas?**

1. Base: 10 × 10 = 100 cm².
2. Cada triângulo: base 10 cm e altura 13 cm. Área: 10 × 13 ÷ 2 = 65 cm².
3. Quatro triângulos: 4 × 65 = 260 cm².
4. Molde: 100 + 260 = 360 cm².

Confira: o molde tem 5 peças, como a pirâmide tem 5 faces. Os 13 cm são o apótema, medido na face, e não a altura da pirâmide (de dentro, a altura seria 12 cm, pelo Pitágoras de 5, 12 e 13).

## Como isso cai no ENEM

- **Formatos:** identificar o sólido pelo molde (ou o molde pelo sólido), dados e cubos com faces marcadas, molde que não fecha, embalagens e caixas montadas a partir de uma folha, rótulo de lata, chapéu de festa e funil feitos com setor circular, quantidade de material de um molde.
- **Habilidades:** H6 (interpretar posição e movimento no espaço e sua representação no plano) e H7 (identificar características de figuras planas e espaciais); quando há conta de área, H8 (resolver problemas de geometria de espaço e forma). Nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma questão foi classificada neste tópico específico; o tópico vizinho vistas e projeções teve 2 das 81 questões de Matemática (2,5%). São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Achar que faces vizinhas no molde podem ser opostas no sólido.
  - Esquecer uma das bases do prisma ou do cilindro.
  - No cilindro, usar o diâmetro ou o raio sozinho como lado do retângulo: o lado é 2 · π · r.
  - No cone, confundir o raio do setor (a geratriz) com o raio da base.
  - Na pirâmide, usar a altura da pirâmide no lugar do apótema da face.

## Questão comentada

**Texto-base.** Um artesão vai fazer funis de papelão em forma de cone (sem a base). A boca do funil é um círculo de 6 cm de raio, e a distância da ponta até a borda da boca, pela superfície, é de 10 cm. Para fazer o molde, ele recorta um setor de um círculo de 10 cm de raio.

**Comando.** O ângulo do setor que ele deve recortar é de

A) 360°.
B) 144°.
C) 180°.
D) 216°.
E) 600°.

**Resolução.**

1. O raio do setor é a geratriz: g = 10 cm. O arco do setor é a volta da boca: 2 · π · 6 = 12π cm.
2. O círculo inteiro de raio 10 tem volta 2 · π · 10 = 20π cm.
3. A fração usada é 12π ÷ 20π = 6 ÷ 10 = 0,6. O ângulo é 0,6 × 360° = 216°.

**Gabarito: D.**

**Por que as outras não:**

- A) 360°: é o círculo inteiro. Enrolado, ele não formaria um cone; a volta ficaria maior que a boca.
- B) 144°: é a parte que sobra do círculo (360° − 216°), a que é jogada fora no recorte.
- C) 180°: meio círculo daria uma boca com raio igual à metade da geratriz, 5 cm. A boca tem 6 cm.
- E) 600°: a razão foi invertida (360 × 10 ÷ 6). Um setor não passa de 360°; a razão é raio da base sobre geratriz.

```realidade
Pegue uma embalagem vazia da sua casa (caixa de creme dental, de remédio, de sabão). Antes de desmontar, desenhe como você acha que é o molde dela. Depois desmonte e compare. Quantas abas de cola existem? Meça o molde e calcule a área de papelão de uma embalagem.
```

## Resumo

- Planificação é a superfície do sólido aberta no plano, com todas as faces.
- A área do molde é a área total do sólido.
- Moldes: cubo (6 quadrados), prisma (2 bases e retângulos), cilindro (2 círculos e 1 retângulo de lado 2 · π · r), pirâmide (base e triângulos), cone (círculo e setor).
- Cubo: nada de bloco 2 por 2; numa fileira de quatro, os extras vão um de cada lado; opostas "pulam uma".
- Cone: o setor tem raio igual à geratriz e ângulo 360° · r ÷ g. Lateral: π · r · g.

## Para aprofundar

- [Geometria espacial](/trilhas/matematica-medio/geometria-espacial)
- [Vistas e projeções ortogonais](/trilhas/enem-matematica-geometria/vistas-e-projecoes)
- [Prismas e cilindros](/trilhas/enem-matematica-geometria/prismas-e-cilindros)
- [Pirâmides e cones](/trilhas/enem-matematica-geometria/piramides-e-cones)
- [Áreas de figuras planas](/trilhas/enem-matematica-geometria/areas-de-figuras-planas)
