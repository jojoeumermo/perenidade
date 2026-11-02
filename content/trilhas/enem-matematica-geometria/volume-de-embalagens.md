---
titulo: "Volume e capacidade de embalagens"
resumo: "Quantos litros cabem, quantas caixas entram no baú, quanto custa o litro e quanto material gasta a embalagem: as contas de quem compra, vende e transporta."
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
  - pergunta: "Caixinhas de 10 cm × 10 cm × 20 cm vão em pé (com os 20 cm na altura) dentro de uma caixa de 45 cm × 30 cm × 60 cm de altura. Quantas caixinhas cabem, todas na mesma posição?"
    opcoes: ["40", "36", "81", "30"]
    resposta: 1
    explicacao: "Conte por medida: 45 ÷ 10 = 4 inteiras (sobram 5 cm), 30 ÷ 10 = 3 e 60 ÷ 20 = 3. São 4 × 3 × 3 = 36. Dividir os volumes daria 40,5, mas a sobra de 5 cm não vira caixinha."
  - pergunta: "Uma caixa é ampliada e todas as suas medidas dobram. O volume fica multiplicado por:"
    opcoes: ["2", "4", "6", "8"]
    resposta: 3
    explicacao: "Volume tem três medidas: 2 × 2 × 2 = 8. A área de papelão, que tem duas medidas, fica 2 × 2 = 4 vezes maior."
  - pergunta: "Quantos copos de 250 mL enchem uma garrafa de 2 L?"
    opcoes: ["8", "80", "4", "12"]
    resposta: 0
    explicacao: "2 L = 2.000 mL. 2.000 ÷ 250 = 8 copos."
  - pergunta: "Um suco de 600 mL custa R$ 4,20. Quanto custaria o litro, pelo mesmo preço?"
    opcoes: ["R$ 4,20", "R$ 6,00", "R$ 7,00", "R$ 2,52"]
    resposta: 2
    explicacao: "Cada 100 mL custa 4,20 ÷ 6 = R$ 0,70. Um litro tem 10 vezes 100 mL: R$ 7,00."
---

```provocacao
No mercado, o mesmo sabão aparece em três tamanhos, com três preços. O maior é sempre o mais barato por litro? E por que a caixa de leite é um bloco, e não uma lata redonda?
```

## O que você vai aprender

Ao fim desta aula você vai calcular a capacidade de uma embalagem em litros, contar quantas embalagens cabem numa caixa maior, comparar preços pelo litro, prever o que acontece quando a embalagem muda de tamanho e comparar o material gasto por embalagens de mesma capacidade.

## Volume e capacidade

**Volume** é o espaço que um objeto ocupa. **Capacidade** é quanto cabe dentro dele. Numa embalagem, a capacidade é o volume do espaço de dentro. Por isso a prova diz "medidas internas": a espessura da parede não guarda nada.

As fórmulas de volume você já conhece da aula de prismas e cilindros: área da base vezes altura. O que muda nesta aula é o que se faz com o volume depois. As pontes entre as unidades são sempre as mesmas:

- 1 m³ = 1.000 L.
- 1 dm³ = 1 L. Um cubo de 10 cm de lado guarda exatamente um litro.
- 1 cm³ = 1 mL.

Uma caixa de leite de 1 L com base de 10 cm por 5 cm tem 1.000 cm³ de capacidade. A altura interna é 1.000 ÷ 50 = 20 cm.

## Quantas cabem: conte pelas medidas

Uma pergunta típica: quantas caixas pequenas cabem numa caixa grande? O caminho tentador é dividir um volume pelo outro. Ele só funciona quando cada medida da grande é múltipla da medida da pequena. Na prática, as caixas não se derretem para ocupar as sobras.

O jeito certo é contar por medida, na posição em que as caixas vão:

1. Quantas cabem no comprimento? Divida e fique só com a parte inteira.
2. Quantas cabem na largura? Idem.
3. Quantas camadas cabem na altura? Idem.
4. Multiplique as três contagens.

Num baú de 90 cm × 60 cm × 50 cm, cubos de 20 cm cabem 4 no comprimento (90 ÷ 20 = 4,5), 3 na largura e 2 na altura (50 ÷ 20 = 2,5). São 4 × 3 × 2 = 24 cubos. A divisão dos volumes daria 33,75, um número que não dá para arrumar.

Com embalagens redondas, cada lata ocupa, na arrumação, um quadrado do tamanho do diâmetro. Uma lata de 10 cm de diâmetro ocupa um quadrado de 10 cm por 10 cm no fundo da caixa.

## O espaço que sobra

Uma lata cilíndrica de raio r dentro de uma caixa quadrada de lado 2r, com a mesma altura, deixa os quatro cantos vazios. Quanto do espaço a lata ocupa? Divida as áreas da base: π · r² dividido por (2r)², que dá π ÷ 4. Com π = 3,14, são cerca de 78,5%. Mais de um quinto da caixa vai vazio.

```verificar
Uma lata de raio 5 cm está numa caixa de base quadrada de 10 cm de lado, com a mesma altura. Usando π = 3, que parte do espaço da caixa a lata ocupa?
- 50%
+ 75%
- 100%
> Base da lata: 3 × 5² = 75 cm². Base da caixa: 10 × 10 = 100 cm². 75 ÷ 100 = 75%. Como as alturas são iguais, a fração do volume é a mesma da base.
```

## Preço por litro

Para comparar embalagens de tamanhos diferentes, ponha todas na mesma medida: o preço de 1 litro (ou de 100 mL, ou de 1 kg). Divida o preço pela quantidade.

```formula
preço por litro = preço ÷ quantidade em litros
o preço da embalagem dividido pela quantidade que ela tem, em litros
```

Exemplo: 500 mL por R$ 2,40 dá 2,40 ÷ 0,5 = R$ 4,80 o litro. 2 L por R$ 8,80 dá 8,80 ÷ 2 = R$ 4,40 o litro. Aqui a maior saiu mais barata, mas isso não é regra. Faça a conta sempre: há promoções do tamanho menor, e há embalagens grandes mais caras por litro.

## Quando a embalagem muda de tamanho

Se todas as medidas de uma embalagem são multiplicadas pelo mesmo número k (a embalagem fica com a mesma forma, só maior ou menor), as grandezas mudam de jeitos diferentes:

```formula
comprimento × k   ·   área × k²   ·   volume × k³
as medidas lineares crescem k vezes, a área (o material) cresce k ao quadrado e o volume (o que cabe) cresce k ao cubo
```

Dobrar as medidas (k = 2) multiplica o material por 4 e a capacidade por 8. Por isso a embalagem grande costuma gastar menos material por litro.

E se só uma medida muda? Num cilindro, quem entra ao quadrado é o raio. Para manter a mesma capacidade com metade do raio, a altura precisa ficar 4 vezes maior.

## Mesma capacidade, menos material

Duas caixas podem guardar o mesmo litro e gastar papelão diferente. Um cubo de 10 cm de aresta tem 6 faces de 100 cm²: 600 cm². Um bloco de 20 cm × 10 cm × 5 cm também guarda 1.000 cm³, mas a área é 2 × (200 + 100 + 50) = 700 cm². Quanto mais "achatada" ou "esticada" a caixa, mais material para o mesmo volume. Entre os blocos, o cubo é o que gasta menos.

Então por que a caixa de leite não é um cubo? Porque a embalagem também precisa caber na mão, na porta da geladeira e no caminhão, sem deixar vão. Blocos se encaixam sem espaço vazio. A melhor embalagem equilibra material, arrumação e uso.

```navidareal
O rótulo de uma embalagem traz a quantidade que ela contém (o "conteúdo líquido"). Quando um produto muda de embalagem e passa a ter menos quantidade pelo mesmo preço, o preço por litro sobe, mesmo que a etiqueta da prateleira mostre o mesmo valor. A conta do preço por litro é a defesa de quem compra: ela mostra o que a etiqueta esconde.
```

## Exemplo resolvido

**Uma caixa-d'água cilíndrica tem 1 m de raio e 1,2 m de altura, medidas internas. Uma família de 4 pessoas gasta, em média, 150 L por pessoa por dia. Com a caixa cheia e sem chuva, a água dura quantos dias? Use π = 3.**

1. Volume: π · r² · h = 3 × 1² × 1,2 = 3,6 m³.
2. Em litros: 3,6 × 1.000 = 3.600 L.
3. Gasto por dia da família: 4 × 150 = 600 L.
4. Duração: 3.600 ÷ 600 = 6 dias.

Confira com uma estimativa: 3.600 L é perto de 4.000; 4.000 ÷ 600 dá um pouco menos de 7. Seis dias faz sentido.

## Como isso cai no ENEM

- **Formatos:** quantos copos, garrafas ou doses uma embalagem rende; quantas caixas cabem num baú ou contêiner; comparação de preço entre tamanhos; mudança de tamanho da embalagem e o efeito no volume e no material; embalagem nova com a mesma capacidade; quantos dias dura um reservatório.
- **Habilidades:** H8 (resolver problemas de geometria de espaço e forma), H12 (resolver problemas com medidas de grandezas) e H14 (avaliar propostas de intervenção usando grandezas e medidas). Nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma questão foi classificada neste tópico específico; o tópico vizinho, prismas e cilindros, teve 3 das 81 questões de Matemática (3,7%), e a geometria inteira teve 24 (29,6%). São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Dividir volumes para contar caixas, em vez de contar por medida.
  - Arredondar para cima o número de caixas numa medida: meia caixa não cabe.
  - Na lata, usar o raio no lugar do diâmetro na hora de arrumar.
  - Achar que dobrar as medidas dobra o volume (ele fica 8 vezes maior).
  - Comparar preços de embalagens diferentes sem passar para o preço por litro.

## Questão comentada

**Texto-base.** Uma cooperativa de apicultoras vende mel em potes cilíndricos de 10 cm de diâmetro e 15 cm de altura. Para o transporte, os potes vão em pé, lado a lado, numa caixa de papelão com medidas internas de 60 cm de comprimento, 40 cm de largura e 30 cm de altura. Os potes não podem ser deitados.

**Comando.** O maior número de potes que cabem na caixa é

A) 48.
B) 32.
C) 64.
D) 24.
E) 192.

**Resolução.**

1. Em pé, cada pote ocupa no fundo um quadrado de 10 cm por 10 cm (o diâmetro).
2. No comprimento: 60 ÷ 10 = 6 potes. Na largura: 40 ÷ 10 = 4 potes. Numa camada: 6 × 4 = 24.
3. Na altura: 30 ÷ 15 = 2 camadas.
4. Total: 24 × 2 = 48 potes.

**Gabarito: A.**

**Por que as outras não:**

- B) 32: o comprimento de 60 cm foi dividido pela altura do pote (15 cm), como se ele estivesse deitado. Em pé, no fundo, conta o diâmetro.
- C) 64: o volume da caixa (72.000 cm³) foi dividido pelo volume de um pote (3 × 25 × 15 = 1.125 cm³, com π = 3). Potes redondos deixam vãos entre si, que não viram potes.
- D) 24: é só uma camada. Na altura de 30 cm cabem duas camadas de 15 cm.
- E) 192: o raio (5 cm) foi usado no lugar do diâmetro. Cada pote ocupa 10 cm, não 5 cm, em cada direção.

```realidade
Escolha um produto que você compra sempre e que vem em dois tamanhos (óleo, sabão, café, leite). Anote o preço e a quantidade de cada um no mercado. Calcule o preço por litro ou por quilo. Qual compensa? A diferença, num mês de compras, daria quanto?
```

## Resumo

- Capacidade é o volume de dentro: 1 m³ = 1.000 L, 1 dm³ = 1 L, 1 cm³ = 1 mL.
- Para contar quantas cabem, divida medida por medida, fique com a parte inteira e multiplique.
- Lata em caixa: ocupa um quadrado do tamanho do diâmetro.
- Preço por litro = preço ÷ litros. Compare sempre na mesma medida.
- Medidas × k: área × k², volume × k³.
- Mesma capacidade pode gastar material diferente: o cubo é o bloco mais econômico.

## Para aprofundar

- [Prismas e cilindros](/trilhas/enem-matematica-geometria/prismas-e-cilindros)
- [Unidades de medida](/trilhas/enem-matematica-proporcionalidade/unidades-de-medida)
- [Razão e proporção](/trilhas/enem-matematica-proporcionalidade/razao-e-proporcao)
- [Geometria espacial](/trilhas/matematica-medio/geometria-espacial)
- [Medidas: comprimento, massa, tempo e capacidade](/trilhas/matematica-fundamental/medidas-comprimento-massa-tempo-e-capacidade)
