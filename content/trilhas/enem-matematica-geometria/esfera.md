---
titulo: "Esfera"
resumo: "Volume e superfície da esfera e do hemisfério, por que o raio vai ao cubo, bolas derretidas em bolinhas e a descoberta de Arquimedes sobre a esfera dentro do cilindro."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 9.6, Solve Geometry Applications: Volume and Surface Area"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-6-solve-geometry-applications-volume-and-surface-area"
  - titulo: "Archimedes of Syracuse (biografia)"
    autor: "J. J. O'Connor e E. F. Robertson, MacTutor History of Mathematics, Universidade de St Andrews"
    url: "https://mathshistory.st-andrews.ac.uk/Biographies/Archimedes/"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é o volume de uma esfera de raio 2 cm? Use π = 3."
    opcoes: ["32 cm³", "48 cm³", "96 cm³", "24 cm³"]
    resposta: 0
    explicacao: "V = 4 · π · r³ ÷ 3 = 4 × 3 × 8 ÷ 3 = 32 cm³. Quem chega a 96 esqueceu de dividir por 3; 48 é a área da superfície (4 × 3 × 4), em cm²; 24 é só π · r³."
  - pergunta: "Qual é a área da superfície de uma bola de raio 2 dm? Use π = 3."
    opcoes: ["16 dm²", "32 dm²", "48 dm²", "96 dm²"]
    resposta: 2
    explicacao: "A = 4 · π · r² = 4 × 3 × 4 = 48 dm². É a área de quatro círculos do mesmo raio."
  - pergunta: "Se o raio de uma esfera dobra, o volume fica multiplicado por:"
    opcoes: ["2", "4", "6", "8"]
    resposta: 3
    explicacao: "No volume, o raio entra ao cubo: 2 × 2 × 2 = 8. A superfície, com r², fica só 4 vezes maior."
  - pergunta: "Uma esfera cabe exatamente dentro de um cilindro (encosta na lateral, no fundo e na tampa). O volume da esfera é que fração do volume do cilindro?"
    opcoes: ["1/3", "2/3", "1/2", "3/4"]
    resposta: 1
    explicacao: "Foi a descoberta de que Arquimedes mais se orgulhava: a esfera ocupa dois terços do cilindro que a envolve. O cone de mesma base e altura ocupa um terço."
---

```provocacao
Uma bola de futebol e uma bola de gude são feitas de materiais diferentes, mas têm a mesma forma. Se a bola de futebol tem um raio dez vezes maior, quantas bolas de gude caberiam, derretidas, dentro dela: dez, cem ou mil?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer a esfera e o hemisfério (a meia esfera), calcular o volume e a área da superfície, e prever o que acontece quando o raio muda. Vai também resolver os problemas de "derreter uma esfera grande para fazer pequenas", que o ENEM gosta de cobrar.

## O que é uma esfera

Pense numa laranja bem redonda, numa bola de vôlei ou numa bolinha de gude. Todos os pontos da casca estão à mesma distância do centro. Essa distância é o **raio** (r). O **diâmetro** é o dobro do raio: atravessa a esfera passando pelo centro.

A palavra "esfera" às vezes quer dizer só a casca e às vezes a bola maciça. Na prova, o enunciado deixa claro pelo que pede. Se pede quanto cabe dentro, é o **volume**. Se pede quanto material cobre a bola (couro, tinta, papel), é a **área da superfície**.

Corte uma laranja ao meio passando pelo centro. Cada metade é um **hemisfério**. O corte mostra um círculo com o mesmo raio da esfera, chamado **círculo máximo**. Ele é o maior círculo que se pode cortar da esfera.

## O volume da esfera

A esfera não tem base nem altura como o prisma, então a regra é outra.

```formula
V = 4 · π · r³ ÷ 3
o volume da esfera é quatro vezes pi vezes o raio ao cubo, dividido por três
r³ é r × r × r; o resultado sai em unidades cúbicas (cm³, m³)
```

O raio ao cubo é o ponto central. Volume tem três dimensões, e as três dependem do raio. Por isso, quando o raio dobra, o volume fica 2 × 2 × 2 = 8 vezes maior. Quando o raio fica dez vezes maior, o volume fica 10 × 10 × 10 = 1.000 vezes maior. É a resposta da provocação: mil bolinhas de gude.

O hemisfério tem metade do volume da esfera: 2 · π · r³ ÷ 3.

## A superfície da esfera

```formula
A = 4 · π · r²
a área da superfície da esfera é quatro vezes pi vezes o raio ao quadrado
é a área de quatro círculos máximos, em unidades quadradas (cm², m²)
```

Uma imagem ajuda a lembrar. Descasque uma laranja e espalhe a casca sobre papel em que você desenhou círculos do tamanho do círculo máximo. A casca preenche quase quatro desses círculos.

A superfície depende do raio ao quadrado. Raio duas vezes maior dá superfície quatro vezes maior. Isso decide quanto couro uma fábrica de bolas gasta, ou quanta tinta pinta um globo.

Atenção no hemisfério: a casca curva tem metade da superfície da esfera (2 · π · r²). Se o hemisfério é maciço, como meia melancia, o corte reto também conta: mais um círculo, π · r².

```verificar
Uma melancia tem raio 10 cm. Se o raio fosse 20 cm, a casca (superfície) seria quantas vezes maior?
- 2 vezes
+ 4 vezes
- 8 vezes
> A superfície depende do raio ao quadrado: 2² = 4. Oito vezes é o que acontece com o volume, porque ele depende do raio ao cubo.
```

## Derreter e remodelar

Quando se derrete uma peça e se faz outra, a quantidade de material não muda. O que se conserva é o **volume**. Esse é o segredo de uma família inteira de questões.

Para saber quantas esferas pequenas saem de uma grande, divida os volumes. O 4 · π ÷ 3 é o mesmo nas duas e se cancela. Sobra a razão dos raios ao cubo: (R ÷ r)³.

Exemplo: uma bola de massinha de raio 6 cm vira bolinhas de raio 2 cm. A razão dos raios é 6 ÷ 2 = 3. Saem 3³ = 27 bolinhas, e não 3 nem 9.

O mesmo vale para encher um recipiente com outro: quantas conchas esféricas enchem uma panela cilíndrica, quantas bolas de sorvete enchem um pote. Calcule os dois volumes na mesma unidade e divida.

```historia
# A esfera no túmulo de Arquimedes, Siracusa, 212 a.C.
Arquimedes viveu em Siracusa, na Sicília, e morreu em 212 a.C., quando os romanos tomaram a cidade. Na obra "Sobre a esfera e o cilindro", ele mostrou que uma esfera encaixada num cilindro (encostando na lateral, no fundo e na tampa) tem dois terços do volume desse cilindro. Mostrou também que a superfície da esfera é dois terços da superfície total do cilindro, contando as tampas.

Ele considerava essa uma das suas maiores descobertas e pediu que ela fosse gravada no seu túmulo. Mais de cem anos depois, em 75 a.C., o romano Cícero estava na Sicília e encontrou o túmulo coberto de mato, reconhecido por uma pequena coluna com a figura de uma esfera dentro de um cilindro.
```

## Exemplo resolvido

**Um centro comunitário tem uma cúpula em forma de hemisfério, com 3 m de raio. Usando π = 3, qual é o volume de ar dentro da cúpula, em litros?**

1. Volume da esfera inteira: 4 × π × r³ ÷ 3 = 4 × 3 × 27 ÷ 3.
2. O 3 de π e o 3 do denominador se cancelam: 4 × 27 = 108 m³.
3. A cúpula é meia esfera: 108 ÷ 2 = 54 m³.
4. Em litros: 54 × 1.000 = 54.000 L.

Confira com Arquimedes: o cilindro que envolve a esfera inteira teria raio 3 m e altura 6 m, ou seja, 3 × 9 × 6 = 162 m³. Dois terços de 162 é 108. A conta bate.

## Como isso cai no ENEM

- **Formatos:** bolas, globos, reservatórios esféricos e cúpulas; derreter uma esfera para fazer outras; esferas dentro de caixas ou de tubos (quanto espaço sobra); material para cobrir a superfície; mudança de raio e o efeito no volume ou na superfície. O enunciado costuma dar π = 3 ou π = 3,14.
- **Habilidades:** H8 (resolver problemas de geometria de espaço e forma) e H7 (identificar características de figuras planas e espaciais). Nas provas de 2022 e 2023, classificadas pelo instituto, o tópico esfera teve 2 das 81 questões de Matemática (2,5%). A geometria inteira teve 24 (29,6%). São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Elevar o raio ao quadrado no volume (é ao cubo) ou ao cubo na superfície (é ao quadrado).
  - Esquecer o "dividido por 3" do volume.
  - Usar o diâmetro como raio.
  - Achar que, com raio 3 vezes maior, cabem 3 bolinhas. Cabem 27.
  - No hemisfério maciço, esquecer o círculo do corte.

## Questão comentada

**Texto-base.** Uma doceira tem uma bola de chocolate maciça com 3 cm de raio. Ela vai derreter essa bola e usar todo o chocolate para fazer bombons esféricos maciços, todos com 1 cm de raio. Despreze as perdas.

**Comando.** O número de bombons que ela consegue fazer é

A) 3.
B) 9.
C) 216.
D) 27.
E) 36.

**Resolução.**

1. Ao derreter, o volume se conserva.
2. Volume da bola: 4 · π · 3³ ÷ 3 = 4 · π · 27 ÷ 3.
3. Volume de cada bombom: 4 · π · 1³ ÷ 3 = 4 · π ÷ 3.
4. Dividindo um pelo outro, o 4 · π ÷ 3 se cancela: 27 ÷ 1 = 27 bombons.

Atalho: a razão dos raios é 3. Ao cubo, 3³ = 27.

**Gabarito: D.**

**Por que as outras não:**

- A) 3: os raios foram comparados direto (3 ÷ 1). O volume depende do raio ao cubo.
- B) 9: a razão foi elevada ao quadrado, como se comparasse superfícies (casca). O chocolate é volume.
- C) 216: o diâmetro da bola grande (6 cm) foi comparado com o raio do bombom (1 cm): 6³ = 216. Compare raio com raio.
- E) 36: entrou a conta da superfície da bola grande, 4 × 3² = 36, dividida por 1. A superfície não mede quanto chocolate há.

```realidade
Pegue uma laranja e meça a volta dela com um barbante. Divida por 6,28 (que é 2 × 3,14) para achar o raio. Calcule o volume e compare com uma laranja que tenha o dobro do raio: quantas laranjas pequenas dariam o suco de uma grande?
```

## Resumo

- Volume da esfera: V = 4 · π · r³ ÷ 3. Superfície: A = 4 · π · r².
- Hemisfério: metade do volume; casca curva com metade da superfície (mais o círculo do corte, se for maciço).
- Raio dobra: superfície vezes 4, volume vezes 8.
- Derreter e remodelar conserva o volume: número de esferas pequenas = (R ÷ r)³.
- A esfera ocupa 2/3 do cilindro que a envolve.

## Para aprofundar

- [Geometria espacial](/trilhas/matematica-medio/geometria-espacial)
- [Potências e raízes](/trilhas/matematica-fundamental/potencias-e-raizes)
- [Circunferência e círculo](/trilhas/enem-matematica-geometria/circunferencia-e-circulo)
- [Prismas e cilindros](/trilhas/enem-matematica-geometria/prismas-e-cilindros)
- [Formulário de matemática](/trilhas/enem-reta-final/formulario-de-matematica)
