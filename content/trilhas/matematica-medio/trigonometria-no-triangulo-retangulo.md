---
titulo: "Trigonometria no triângulo retângulo"
resumo: "Pitágoras, seno, cosseno e tangente: como medir alturas e distâncias sem subir nem atravessar."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 7.2, Right Triangle Trigonometry"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/7-2-right-triangle-trigonometry"
  - titulo: "Prealgebra 2e, seção 9.3, Use Properties of Angles, Triangles, and the Pythagorean Theorem"
    autor: "Lynn Marecek e outros (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/9-3-use-properties-of-angles-triangles-and-the-pythagorean-theorem"
  - titulo: "ABNT NBR 9050: Acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos"
    autor: "Associação Brasileira de Normas Técnicas"
    ano: "2020"
quiz:
  - pergunta: "Um triângulo retângulo tem catetos de 6 m e 8 m. Quanto mede a hipotenusa?"
    opcoes: ["10 m", "14 m", "100 m"]
    resposta: 0
    explicacao: "6² + 8² = 36 + 64 = 100, e a raiz de 100 é 10."
  - pergunta: "O seno de um ângulo agudo, no triângulo retângulo, é a razão entre:"
    opcoes: ["o cateto oposto e a hipotenusa", "o cateto adjacente e a hipotenusa", "o cateto oposto e o cateto adjacente"]
    resposta: 0
    explicacao: "Seno: oposto sobre hipotenusa. Cosseno: adjacente sobre hipotenusa. Tangente: oposto sobre adjacente."
  - pergunta: "Uma rampa sobe 1 metro a cada 12 metros de avanço horizontal. Qual é a sua inclinação, aproximadamente?"
    opcoes: ["12%", "8,33%", "1,2%"]
    resposta: 1
    explicacao: "Inclinação é subida dividida por avanço: 1 ÷ 12 ≈ 0,0833, ou 8,33%."
---

## O triângulo do esquadro

Um **triângulo retângulo** tem um ângulo reto (90°), o canto de um esquadro. Os dois lados que formam o ângulo reto são os **catetos**. O lado em frente a ele, sempre o maior, é a **hipotenusa**.

## O teorema de Pitágoras

Em todo triângulo retângulo:

**hipotenusa² = cateto² + cateto²**

Com catetos de 3 e 4: 3² + 4² = 9 + 16 = 25, e √25 = 5. A hipotenusa mede 5.

O teorema leva o nome do grego Pitágoras, do século VI a.C., mas a relação já era conhecida muito antes na Mesopotâmia, e aparece também em textos antigos da Índia e da China.

### O esquadro do pedreiro

Na obra, o triângulo 3-4-5 serve para **tirar o esquadro**. Marque 60 cm em uma parede a partir do canto e 80 cm na outra. Se a distância entre as duas marcas for exatamente 100 cm, o canto está em 90°. Se for diferente, está fora de esquadro. Esse saber é passado de mestre para ajudante, no canteiro, há muitas gerações.

### Achando um cateto

Uma escada de 5 m está apoiada na parede, com o pé a 3 m dela. A que altura chega?

```conta
5² = 3² + altura²
25 = 9 + altura²
altura² = 16
= altura = 4 m
```

## As três razões

Pitágoras relaciona lado com lado. A **trigonometria** relaciona lado com **ângulo**.

Escolha um dos ângulos agudos do triângulo. Em relação a ele:

- o **cateto oposto** é o que fica em frente;
- o **cateto adjacente** é o que encosta nele.

| Razão | Abreviação | Conta |
| --- | --- | --- |
| seno | sen | cateto oposto ÷ hipotenusa |
| cosseno | cos | cateto adjacente ÷ hipotenusa |
| tangente | tg | cateto oposto ÷ cateto adjacente |

O ponto essencial: essas razões **dependem só do ângulo**, e não do tamanho do triângulo. Todos os triângulos retângulos com um ângulo de 30° são semelhantes (um é ampliação do outro), e em todos eles o cateto oposto mede metade da hipotenusa. Por isso os valores podem ser tabelados uma vez e usados sempre.

## Os ângulos mais usados

| Ângulo | Seno | Cosseno | Tangente |
| --- | --- | --- | --- |
| 30° | 0,5 | 0,866 | 0,577 |
| 45° | 0,707 | 0,707 | 1 |
| 60° | 0,866 | 0,5 | 1,732 |

Para os outros ângulos, use as teclas sin, cos e tan da calculadora científica ou do celular (confira se ela está em graus, "DEG").

## Medindo o que não se alcança

**A altura de uma árvore.** Afaste-se 10 m do tronco. Com um transferidor e um canudo, meça o ângulo entre o chão e a linha que vai do seu olho ao topo. Suponha 30°. A altura acima do seu olho é o cateto oposto; os 10 m são o adjacente. A razão que liga os dois é a tangente:

```conta
tg 30° = altura ÷ 10
altura = 10 × 0,577 = 5,77 m
= somando a altura do olho (1,60 m): cerca de 7,4 m
```

**O alcance de uma escada.** Uma escada de 4 m faz 60° com o chão. A altura que ela alcança é o cateto oposto; a escada é a hipotenusa. Usa-se o seno: altura = 4 × sen 60° = 4 × 0,866 ≈ 3,46 m.

```verificar
Você quer saber a distância entre o pé de uma escada de 6 m e a parede, sabendo que ela faz 60° com o chão. Qual razão usar?
- Seno, porque envolve o cateto oposto
+ Cosseno, porque liga o cateto adjacente à hipotenusa
- Tangente, porque envolve os dois catetos
> A distância no chão encosta no ângulo de 60°. A escada é a hipotenusa.
```

## Inclinação, rampa e direito de ir e vir

A **inclinação** de uma rampa, de um telhado ou de uma rua é a subida dividida pelo avanço horizontal. É a tangente do ângulo, e costuma ser dada em porcentagem.

A norma brasileira de acessibilidade, a NBR 9050, admite para rampas a inclinação máxima de 8,33%: 1 metro de subida para cada 12 metros de comprimento horizontal. Para vencer um degrau de 50 cm, a rampa precisa de pelo menos 6 metros:

```conta
0,50 ÷ comprimento = 1 ÷ 12
= comprimento = 0,50 × 12 = 6 m
```

Uma rampa mais curta que isso é mais íngreme do que a norma permite: quem usa cadeira de rodas não consegue subir sozinho, e descer é perigoso. Com uma trena e essa conta, qualquer pessoa pode fiscalizar a rampa da escola, do posto de saúde ou do ponto de ônibus.

## Para praticar

1. Os catetos medem 5 e 12. Quanto mede a hipotenusa?
2. A hipotenusa mede 10 e um cateto mede 6. Quanto mede o outro?
3. Um poste projeta uma sombra de 5 m quando os raios do Sol fazem 45° com o chão. Qual é a altura do poste?
4. Uma pipa está presa a 50 m de linha esticada, que faz 30° com o chão. A que altura está a pipa?
5. Um telhado avança 4 m na horizontal e sobe 1,20 m. Qual é a inclinação em porcentagem?
6. Uma rampa de 3 m de comprimento horizontal vence 30 cm de altura. Está dentro do limite de 8,33%?

**Respostas:** 1) 13. 2) 8. 3) 5 m (tg 45° = 1). 4) 50 × 0,5 = 25 m. 5) 30%. 6) Não: 0,30 ÷ 3 = 10%.
