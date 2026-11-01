---
titulo: "Prismas e cilindros"
resumo: "Volume e área de caixas, latas, tanques e cisternas: área da base vezes a altura, a conversão para litros e o que acontece quando a embalagem muda de tamanho."
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
  - titulo: "Programa Um Milhão de Cisternas (P1MC)"
    autor: "Articulação Semiárido Brasileiro (ASA)"
    url: "https://www.asabrasil.org.br/acoes/p1mc"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma caixa-d'água em forma de bloco mede 3 m de comprimento, 2 m de largura e 1 m de altura. Quantos litros cabem nela?"
    opcoes: ["600 L", "6 L", "6.000 L", "60.000 L"]
    resposta: 2
    explicacao: "Volume: 3 × 2 × 1 = 6 m³. Cada metro cúbico tem 1.000 litros: 6 × 1.000 = 6.000 L."
  - pergunta: "Um prisma tem como base um triângulo de base 4 cm e altura 3 cm. A altura do prisma é 10 cm. Qual é o volume?"
    opcoes: ["120 cm³", "60 cm³", "17 cm³", "30 cm³"]
    resposta: 1
    explicacao: "Área da base: 4 × 3 ÷ 2 = 6 cm². Volume: 6 × 10 = 60 cm³. Quem chega a 120 esqueceu de dividir a área do triângulo por 2."
  - pergunta: "Uma lata cilíndrica tem o raio dobrado e a altura mantida. O volume fica multiplicado por:"
    opcoes: ["4", "2", "8", "16"]
    resposta: 0
    explicacao: "No volume do cilindro, π · r² · h, o raio entra ao quadrado. Dobrar o raio multiplica o volume por 2² = 4."
  - pergunta: "Qual é a área lateral (o rótulo) de uma lata cilíndrica de raio 2 cm e altura 5 cm? Use π = 3."
    opcoes: ["24 cm²", "120 cm²", "20 cm²", "60 cm²"]
    resposta: 3
    explicacao: "Aberto, o rótulo é um retângulo: a base é a volta da lata (2 × 3 × 2 = 12 cm) e a altura é 5 cm. Área: 12 × 5 = 60 cm²."
---

```provocacao
Uma caixa de leite e uma lata de leite em pó ficam lado a lado na prateleira. Uma é quadrada, a outra é redonda. Como saber qual guarda mais, sem abrir nenhuma das duas?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer prismas e cilindros, calcular o volume deles (quanto cabe dentro), converter esse volume em litros e calcular a área da superfície (quanto material é preciso para fazer a embalagem). Vai também prever o que acontece com o volume quando uma medida muda.

## O que é um prisma e o que é um cilindro

Pense numa pilha de folhas de papel, todas iguais, uma em cima da outra. A pilha tem a forma da folha embaixo, a mesma forma em cima e a mesma forma em qualquer altura. Esse é o segredo dos dois sólidos desta aula.

Um **prisma** tem duas bases iguais e paralelas, que são polígonos (triângulo, quadrado, retângulo, hexágono). As faces dos lados, chamadas **faces laterais**, são retângulos quando o prisma está "em pé", reto. Uma caixa de sapato é um prisma de base retangular. Uma barra de chocolate em forma de telhado é um prisma de base triangular. Um lápis sem ponta é um prisma de base hexagonal.

Um **cilindro** é a mesma ideia com base redonda: duas bases que são círculos iguais e paralelos, ligadas por uma superfície curva. Lata de óleo, cano, caixa-d'água redonda e tambor são cilindros.

O nome de cada prisma vem da base: prisma triangular, quadrangular, pentagonal, hexagonal. O **cubo** é o prisma em que todas as faces são quadrados iguais.

## O volume: área da base vezes a altura

Volta à pilha de folhas. Se cada folha tem uma área e você empilha até uma certa altura, o espaço ocupado é a área de uma folha vezes a altura da pilha. Vale para qualquer prisma e para qualquer cilindro.

```formula
V = A da base · h
o volume é a área da base vezes a altura
no cilindro, a base é um círculo: V = π · r² · h, pi vezes o raio ao quadrado vezes a altura
```

Na caixa (o bloco retangular), a base é um retângulo: comprimento vezes largura. Então o volume é comprimento vezes largura vezes altura. No prisma triangular, a base é um triângulo: base vezes altura do triângulo, dividido por 2. Depois, vezes a altura do prisma.

Repare que há duas "alturas" no prisma triangular: a altura do triângulo da base e a altura do prisma. Dê nome a cada uma antes de fazer a conta.

## De metro cúbico para litro

Volume em metro cúbico (m³) é o espaço de um cubo de 1 m de lado. A prova quase sempre quer a resposta em litros. As pontes são poucas:

- 1 m³ = 1.000 L.
- 1 dm³ = 1 L (um cubo de 10 cm de lado).
- 1 cm³ = 1 mL.

Guarde também que um cubo de 1 m de lado tem 100 cm de lado. Por isso 1 m³ é 100 × 100 × 100 = 1.000.000 cm³, um milhão de mililitros, que são os mesmos 1.000 litros.

```verificar
Uma caixa tem 50 cm de comprimento, 40 cm de largura e 30 cm de altura. Quantos litros cabem nela?
- 600 L
+ 60 L
- 6 L
> 50 × 40 × 30 = 60.000 cm³. Como 1 L = 1.000 cm³, são 60.000 ÷ 1.000 = 60 L. Outro caminho: em decímetros, 5 × 4 × 3 = 60 dm³ = 60 L.
```

## A área da superfície: quanto material

Quem fabrica a embalagem quer saber outra coisa: quanto papelão ou quanta lata gasta. Isso é a **área total**, a soma das áreas de todas as faces.

Desmonte a caixa em cima da mesa (isso se chama **planificação**). Aparecem as duas bases e as faces laterais. No prisma reto, as faces laterais juntas formam um retângulo comprido: a base dele é o perímetro da base do prisma e a altura é a altura do prisma.

No cilindro acontece o mesmo. Tire o rótulo de uma lata e estique: ele vira um retângulo. A base desse retângulo é a volta da lata, 2 · π · r. A altura é a altura da lata.

```formula
A total = 2 · A da base + perímetro da base · h
a área total é as duas bases mais as faces laterais; as laterais juntas dão o perímetro da base vezes a altura
no cilindro: A total = 2 · π · r² + 2 · π · r · h, duas tampas mais o rótulo
```

Leia o enunciado com atenção: "caixa sem tampa" tem só uma base; "rótulo" é só a área lateral; "coluna encostada no chão e no teto" não se pinta nas bases.

## Quando a embalagem muda de tamanho

Volume é uma medida em três dimensões. Se todas as medidas de uma caixa dobram, o volume fica 2 × 2 × 2 = 8 vezes maior. Se só a altura dobra, o volume só dobra.

No cilindro, o raio aparece duas vezes (r²). Dobrar o raio, mantendo a altura, multiplica o volume por 4. Aumentar o raio em 50% (multiplicar por 1,5) multiplica o volume por 1,5 × 1,5 = 2,25. É assim que uma lata "um pouco mais larga" guarda muito mais.

```navidareal
No Semiárido brasileiro, o programa Um Milhão de Cisternas, da Articulação Semiárido Brasileiro (ASA), constrói cisternas para guardar a água da chuva para beber e cozinhar. Segundo a ASA, cada cisterna tem formato cilíndrico, fica semienterrada e guarda 16 mil litros.

16 mil litros são 16 m³. Faça uma conta de exemplo, com medidas escolhidas por nós (não são as medidas oficiais): se o raio fosse 2 m, com π = 3, a base teria 3 × 4 = 12 m², e a água chegaria a 16 ÷ 12, perto de 1,33 m de altura. É a fórmula do cilindro a serviço de quem vive da chuva.
```

## Exemplo resolvido

**Uma associação de moradores tem um tanque cilíndrico de 2 m de diâmetro e 1,5 m de altura. Usando π = 3,14, quantos litros cabem no tanque?**

1. O raio é a metade do diâmetro: r = 1 m.
2. Área da base: π · r² = 3,14 × 1² = 3,14 m².
3. Volume: área da base vezes altura = 3,14 × 1,5 = 4,71 m³.
4. Em litros: 4,71 × 1.000 = 4.710 L.

Confira com uma estimativa: um bloco de base quadrada com 2 m de lado e 1,5 m de altura (a caixa que "abraça" o tanque) teria 2 × 2 × 1,5 = 6 m³. O cilindro ocupa um pouco menos que isso, perto de 79% do bloco. 4,71 m³ faz sentido.

## Como isso cai no ENEM

- **Formatos:** caixas-d'água, cisternas e piscinas (quantos litros, quanto tempo para encher), comparação de embalagens (lata contra caixa), quantidade de material para fabricar uma caixa ou rótulo, tinta para pintar colunas, caixas montadas recortando os cantos de uma folha, mudanças de medida e o efeito no volume.
- **Habilidades:** H8 (resolver problemas de geometria de espaço e forma), H12 (resolver problemas com medidas de grandezas) e H14 (avaliar propostas de intervenção usando grandezas e medidas). Nas provas de 2022 e 2023, classificadas pelo instituto, o tópico prismas e cilindros teve 3 das 81 questões de Matemática (3,7%), empatado com circunferência entre os de geometria que mais apareceram. A geometria inteira teve 24 questões (29,6%). São só duas provas: tendência, não promessa.
- **Armadilhas:**
  - Esquecer de converter: 1 m³ = 1.000 L e 1 cm³ = 1 mL.
  - No prisma triangular, esquecer o "dividido por 2" da área do triângulo.
  - No cilindro, usar o diâmetro no lugar do raio, ou esquecer de elevar o raio ao quadrado.
  - Contar a tampa numa caixa "sem tampa", ou as bases numa coluna.
  - Achar que dobrar o raio dobra o volume. Ele quadruplica.

## Questão comentada

**Texto-base.** Uma cooperativa de agricultoras quer vender leite em pó e testa duas embalagens. A primeira é uma lata cilíndrica com 4 cm de raio da base e 10 cm de altura. A segunda é uma caixa em forma de prisma de base quadrada, com 7 cm de lado da base e 10 cm de altura. As medidas são internas. Use π = 3 e lembre que 1 cm³ = 1 mL.

**Comando.** Qual embalagem tem a maior capacidade, e quantos mililitros a mais ela guarda?

A) A lata, 150 mL a mais.
B) As duas guardam a mesma quantidade.
C) A caixa, 370 mL a mais.
D) A lata, 10 mL a mais.
E) A caixa, 10 mL a mais.

**Resolução.**

1. Lata: área da base π · r² = 3 × 16 = 48 cm². Volume: 48 × 10 = 480 cm³ = 480 mL.
2. Caixa: área da base 7 × 7 = 49 cm². Volume: 49 × 10 = 490 cm³ = 490 mL.
3. A caixa guarda mais: 490 − 480 = 10 mL.

**Gabarito: E.**

**Por que as outras não:**

- A) A lata, 150 mL a mais: a base da lata foi calculada como um quadrado de lado 8 cm (o diâmetro): 64 × 10 = 640. Mas a base é um círculo: π · r².
- B) Iguais: as capacidades são parecidas, mas não iguais. Na prova, faça a conta até o fim antes de arredondar.
- C) A caixa, 370 mL a mais: o raio não foi elevado ao quadrado na lata (3 × 4 × 10 = 120). A área do círculo é π · r².
- D) A lata, 10 mL a mais: a diferença está certa, mas os lados foram trocados. A caixa tem 490 mL e a lata, 480 mL.

```realidade
Escolha uma embalagem da sua cozinha (caixa de leite, lata, pote). Meça com uma régua, calcule o volume em mililitros e compare com o que está escrito no rótulo. A sua conta deu um pouco mais? Pense no porquê: a medida de fora inclui a espessura da embalagem e, às vezes, um espaço vazio no topo.
```

## Resumo

- Prisma: duas bases iguais e paralelas, polígonos. Cilindro: duas bases que são círculos.
- Volume: área da base vezes altura. No cilindro, V = π · r² · h.
- 1 m³ = 1.000 L; 1 dm³ = 1 L; 1 cm³ = 1 mL.
- Área total: as duas bases mais a lateral (perímetro da base vezes altura). No cilindro, o rótulo é 2 · π · r · h.
- Todas as medidas dobram: volume vezes 8. Raio do cilindro dobra: volume vezes 4.

## Para aprofundar

- [Geometria espacial](/trilhas/matematica-medio/geometria-espacial)
- [Medidas: comprimento, massa, tempo e capacidade](/trilhas/matematica-fundamental/medidas-comprimento-massa-tempo-e-capacidade)
- [Perímetro e área](/trilhas/matematica-fundamental/perimetro-e-area)
- [Circunferência e círculo](/trilhas/enem-matematica-geometria/circunferencia-e-circulo)
- [Matemática, o essencial: geometria, dados e funções](/trilhas/enem-reta-final/matematica-o-essencial-geometria-dados-e-funcoes)
- [Formulário de matemática](/trilhas/enem-reta-final/formulario-de-matematica)
