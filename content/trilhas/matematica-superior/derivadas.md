---
titulo: "Derivadas"
resumo: "A taxa de variação em um instante: velocidade, inclinação da curva e a busca de máximos e mínimos."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Calculus Volume 1, seção 3.1, Defining the Derivative"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/3-1-defining-the-derivative"
  - titulo: "Calculus Volume 1, seção 3.3, Differentiation Rules"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/3-3-differentiation-rules"
  - titulo: "Calculus Volume 1, seção 4.3, Maxima and Minima"
    autor: "Gilbert Strang, Edwin Herman e outros (OpenStax)"
    ano: "2016"
    url: "https://openstax.org/books/calculus-volume-1/pages/4-3-maxima-and-minima"
quiz:
  - pergunta: "Qual é a derivada de f(x) = 3x² − 4x + 5?"
    opcoes: ["6x − 4", "3x − 4", "6x² − 4x"]
    resposta: 0
    explicacao: "A derivada de 3x² é 6x; a de −4x é −4; a de uma constante é 0."
  - pergunta: "O que a derivada de uma função em um ponto representa no gráfico?"
    opcoes: ["A altura da curva", "A inclinação da reta tangente à curva", "A área sob a curva"]
    resposta: 1
    explicacao: "A derivada mede quanto a função está subindo ou descendo naquele ponto: é a inclinação da tangente."
  - pergunta: "Em um ponto de máximo ou de mínimo de uma função derivável, a derivada vale:"
    opcoes: ["1", "0", "infinito"]
    resposta: 1
    explicacao: "No topo do morro ou no fundo do vale, a tangente é horizontal: inclinação zero."
---

## Velocidade em um instante

Um carro arranca, e a distância percorrida, em metros, depois de t segundos é s(t) = 5t². Qual é a velocidade exatamente em t = 2?

Velocidade média é distância dividida por tempo. Calcule-a em intervalos cada vez menores, começando em t = 2:

| Intervalo | Distância percorrida | Velocidade média |
| --- | --- | --- |
| de 2 a 3 s | 45 − 20 = 25 m | 25 m/s |
| de 2 a 2,1 s | 22,05 − 20 = 2,05 m | 20,5 m/s |
| de 2 a 2,01 s | 20,2005 − 20 = 0,2005 m | 20,05 m/s |

As médias tendem a **20 m/s**. Esse [limite](/trilhas/matematica-superior/limites) é a velocidade instantânea em t = 2. É o que o velocímetro marca.

## A definição

A **derivada** de f em x é o limite da taxa média de variação quando o intervalo encolhe até zero:

f'(x) = lim (h → 0) [f(x + h) − f(x)] ÷ h

Lê-se "f linha de x". Outra notação, de Leibniz, é dy/dx.

Calculando para f(x) = x²:

```conta
[(x + h)² − x²] ÷ h
= [x² + 2xh + h² − x²] ÷ h
= 2x + h
= quando h tende a 0: 2x
```

A derivada de x² é 2x. Para s(t) = 5t², a derivada é 10t, e em t = 2 vale 20. Confere com a tabela.

## O significado geométrico

A taxa média entre dois pontos é a inclinação da reta que passa por eles (a secante). Quando o segundo ponto se aproxima do primeiro, a secante vira a **tangente**: a reta que encosta na curva naquele ponto. A derivada é a **inclinação da tangente**.

- Derivada **positiva**: a função está subindo.
- Derivada **negativa**: a função está descendo.
- Derivada **zero**: a tangente é horizontal.

## Regras de derivação

Ninguém calcula limites toda vez. Usam-se regras:

| Função | Derivada |
| --- | --- |
| constante | 0 |
| x^n | n × x^(n − 1) |
| e^x | e^x |
| ln x | 1/x |
| sen x | cos x |
| cos x | −sen x |

E, para combinar funções:

- **soma:** a derivada da soma é a soma das derivadas;
- **constante multiplicando:** ela sai para fora. A derivada de 5x³ é 5 × 3x² = 15x²;
- **produto:** (f × g)' = f' × g + f × g';
- **quociente:** (f ÷ g)' = (f' × g − f × g') ÷ g²;
- **regra da cadeia** (função dentro de função): deriva-se a de fora, mantendo a de dentro, e multiplica-se pela derivada da de dentro. A derivada de (2x + 1)³ é 3 × (2x + 1)² × 2 = 6(2x + 1)².

**Exemplo:** f(x) = 3x² − 4x + 5 tem derivada f'(x) = 6x − 4.

```verificar
Um objeto se move segundo s(t) = 4t² + 2t, com s em metros e t em segundos. Qual é a sua velocidade em t = 3?
- 42 m/s
+ 26 m/s
- 14 m/s
> A velocidade é a derivada da posição: v(t) = 8t + 2.
```

## Máximos e mínimos

No ponto mais alto de um morro, você não está subindo nem descendo. Em um máximo ou em um mínimo de uma função derivável, **a derivada é zero**. Isso transforma problemas de otimização em equações.

**O canteiro.** Com 40 m de tela, a área do canteiro retangular de lado x é A(x) = x(20 − x) = 20x − x².

```conta
A'(x) = 20 − 2x
20 − 2x = 0
= x = 10: o quadrado, como já sabíamos pela parábola
```

**A lata.** Qual é o formato de lata cilíndrica que gasta menos chapa para guardar um volume fixo V? A área de chapa é S = 2πr² + 2πrh. Como V = πr²h, a altura é h = V ÷ (πr²), e a área fica só em função do raio:

S(r) = 2πr² + 2V/r

Derivando e igualando a zero: 4πr − 2V/r² = 0, o que dá r³ = V ÷ (2π). Substituindo de volta, chega-se a **h = 2r**: a lata mais econômica tem a altura igual ao diâmetro.

Um cuidado: derivada zero é condição necessária, mas não suficiente. É preciso conferir se o ponto é de máximo, de mínimo ou nenhum dos dois, olhando o sinal da derivada antes e depois (ou a segunda derivada).

## Derivada da derivada

A derivada da posição é a **velocidade**. A derivada da velocidade é a **aceleração**: quanto a velocidade muda por segundo. Para s(t) = 5t², v(t) = 10t e a(t) = 10 m/s², um valor próximo da aceleração da gravidade na Terra. Essa função descreve, aproximadamente, um corpo em queda livre.

## A taxa de variação em toda parte

Sempre que se pergunta "a que ritmo isto está mudando?", a resposta é uma derivada:

- na física, velocidade e aceleração;
- na epidemiologia, o número de casos novos por dia é a derivada do total de casos;
- na economia, o custo de produzir uma unidade a mais (o chamado custo marginal) é a derivada do custo total;
- no clima, a taxa de aquecimento é a derivada da temperatura no tempo.

Isso ajuda a ler notícias. "A inflação desacelerou" é uma frase sobre derivadas: os preços (a função) continuam subindo; a taxa de subida (a primeira derivada) é que diminuiu. "O desemprego parou de crescer" não quer dizer que caiu.

## Uma invenção em dois lugares

O cálculo foi criado na segunda metade do século XVII, de forma independente, pelo inglês Isaac Newton e pelo alemão Gottfried Leibniz. Newton queria descrever o movimento dos corpos; Leibniz buscava um método geral para tangentes e áreas. A disputa sobre quem chegou primeiro envenenou a relação entre os matemáticos ingleses e os do continente por um século. A notação que venceu, dy/dx e o sinal da integral, é a de Leibniz.

## Para praticar

1. Derive f(x) = x³ e calcule a inclinação da tangente em x = 1.
2. Derive f(x) = 3x² − 4x + 5 e calcule f'(2).
3. Ache o ponto de mínimo de f(x) = x² − 6x + 10 e o valor mínimo.
4. Derive, pela regra da cadeia, f(x) = (2x + 1)³.
5. Derive, pela regra do produto, f(x) = x × e^x.
6. O total de casos de uma doença continua crescendo, mas a cada dia surgem menos casos novos que no dia anterior. O que se pode dizer do sinal da primeira e da segunda derivada do total de casos?

**Respostas:** 1) 3x²; 3. 2) 6x − 4; 8. 3) x = 3; o mínimo é 1. 4) 6(2x + 1)². 5) e^x + x × e^x. 6) A primeira é positiva (o total cresce); a segunda é negativa (o ritmo diminui).
