---
titulo: "Matemática: funções, gráficos e geometria"
modelo: 9
resumo: "A função afim em problemas do dia a dia, leitura de gráficos, o teorema de Pitágoras, a área do círculo e o volume de sólidos simples."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Matriz de Referência do Encceja: Matemática e suas Tecnologias"
    autor: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (Inep)"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/encceja"
  - titulo: "Base Nacional Comum Curricular: Matemática no Ensino Médio"
    autor: "Ministério da Educação"
    ano: "2018"
    url: "http://basenacionalcomum.mec.gov.br/"
glossario:
  - termo: "função"
    definicao: "Uma regra que liga cada valor de uma grandeza a um valor de outra, como o preço a pagar e os quilômetros rodados."
  - termo: "hipotenusa"
    definicao: "O lado maior de um triângulo retângulo, oposto ao ângulo reto."
quiz:
  - pergunta: "Uma corrida custa R$ 5 de bandeirada mais R$ 2 por quilômetro. Qual função dá o preço P para x km?"
    opcoes: ["P = 2x", "P = 5x + 2", "P = 5 + 2x", "P = 7x"]
    resposta: 2
    explicacao: "O valor fixo (5) soma-se ao valor que varia com os km (2 por km): P = 5 + 2x."
  - pergunta: "Qual é o preço da corrida acima para 10 km?"
    opcoes: ["R$ 20", "R$ 25", "R$ 70", "R$ 52"]
    resposta: 1
    explicacao: "P = 5 + 2 × 10 = 25."
  - pergunta: "Num triângulo retângulo com catetos 6 e 8, quanto mede a hipotenusa?"
    opcoes: ["10", "14", "48", "100"]
    resposta: 0
    explicacao: "Pitágoras: 6² + 8² = 36 + 64 = 100; a raiz de 100 é 10."
  - pergunta: "A área de um círculo de raio r é dada por:"
    opcoes: ["2 · π · r", "π · r²", "π · r", "r²"]
    resposta: 1
    explicacao: "A área do círculo é π vezes o raio ao quadrado. A fórmula 2πr é a do comprimento da circunferência."
---

## O que você vai aprender

Ao fim desta aula você vai saber escrever e usar uma função simples em problemas do dia a dia, ler um gráfico e usar Pitágoras e as fórmulas de área e volume mais comuns.

```suarealidade
Onde você paga um valor fixo mais um valor que cresce com o uso (aplicativo de transporte, conta de água, plano de celular)? Você sabe como o total é calculado?
```

## A função afim

Muitos preços seguem a regra: **um valor fixo + um valor por unidade**. A forma geral é

```formula
y = a · x + b
b é o valor fixo; a é quanto cresce por unidade; x é a quantidade
```

No exemplo da corrida, P = 5 + 2x: R$ 5 de bandeirada e R$ 2 por km. Para x = 10, P = 25. O gráfico dessa função é uma **reta** que começa em 5 e sobe 2 para cada km.

## Ler um gráfico

Um gráfico mostra como uma grandeza varia. O **eixo horizontal** traz uma grandeza (tempo, km); o **vertical**, outra (preço, quantidade). Para ler: ache o valor no eixo horizontal, suba até a linha e leia no eixo vertical. Gráfico de barras compara quantidades; de linha mostra evolução no tempo; de setores (pizza) mostra partes de um todo. Atenção à **escala** dos eixos: ela pode exagerar ou esconder uma diferença.

## Pitágoras

Em todo triângulo **retângulo**, o quadrado da hipotenusa é igual à soma dos quadrados dos catetos:

```formula
a² = b² + c²
a é a hipotenusa; b e c são os catetos
```

O triângulo 3-4-5 (3² + 4² = 5²) é muito usado na obra para "esquadrejar" um canto: se as medidas 3, 4 e 5 fecham, o canto está em ângulo reto.

## Círculo e volume

- **Comprimento da circunferência**: 2 · π · r. **Área do círculo**: π · r². Use π ≈ 3,14.
- **Volume de um cilindro** (como um tonel): π · r² · h.
- **Volume de um bloco**: comprimento × largura × altura. 1 m³ = 1.000 litros.

```verificar
Uma escada de 5 m encosta numa parede, com o pé a 3 m dela. A que altura a escada toca a parede?
- 2 m
+ 4 m
- 8 m
> Hipotenusa 5, cateto 3: 5² − 3² = 16.
```

## Exemplo resolvido

**Um tonel cilíndrico tem raio de 0,5 m e altura de 1 m. Quantos litros cabem? (Use π = 3,14.)**

1. Área da base: π · r² = 3,14 × 0,5² = 3,14 × 0,25 = **0,785 m²**.
2. Volume: base × altura = 0,785 × 1 = **0,785 m³**.
3. Em litros: 0,785 × 1.000 = **785 litros**.

Confira: um tonel de 1 m de altura e uns 1 m de largura caberia pouco menos de 1 m³; 0,785 m³ faz sentido.

```outrolado
# O argumento mais forte de quem discorda
"Função, gráfico e Pitágoras nunca vão servir para quem trabalha com as mãos. É conteúdo de escola para passar de ano."
---
Como você responderia a esse argumento, com respeito e com fatos?
---
Muita gente tem essa impressão, e o ensino ruim contribui. Mas o 3-4-5 do pedreiro é Pitágoras, a conta do aplicativo é uma função, e o gráfico da conta de luz é um instrumento para entender o gasto. Entender a matemática por trás protege contra cobrança errada e abre portas a cursos técnicos. A matriz do Encceja pede exatamente situações do dia a dia.
```

```agir
# Esta semana
Pegue uma conta que mistura valor fixo e variável (água, celular) e escreva a função dela: valor fixo e preço por unidade. Calcule o total de um mês e confira com a conta.
```

## Resumo

- Função afim: y = a·x + b (valor fixo mais quanto cresce por unidade); o gráfico é uma reta.
- Leia gráficos observando eixos e escala.
- Pitágoras: a² = b² + c² (triângulo retângulo); o 3-4-5 esquadreja cantos.
- Área do círculo π·r²; volume do cilindro π·r²·h; 1 m³ = 1.000 L.
