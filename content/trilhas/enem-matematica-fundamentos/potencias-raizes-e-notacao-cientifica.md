---
titulo: "Potências, raízes e notação científica"
resumo: "Potência como multiplicação repetida, as regras que encurtam as contas, raiz quadrada sem calculadora e a notação científica, que escreve números enormes e minúsculos com poucos algarismos."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 10.2, Use Multiplication Properties of Exponents"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/10-2-use-multiplication-properties-of-exponents"
  - titulo: "Prealgebra 2e, seção 10.5, Integer Exponents and Scientific Notation"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/10-5-integer-exponents-and-scientific-notation"
  - titulo: "Prealgebra 2e, seção 5.7, Simplify and Use Square Roots"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/5-7-simplify-and-use-square-roots"
  - titulo: "The International System of Units (SI): Prefixes"
    autor: "Bureau International des Poids et Mesures (BIPM)"
    url: "https://www.bipm.org/en/measurement-units/si-prefixes"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Quanto é 2⁵?"
    opcoes: ["10", "25", "32", "64"]
    resposta: 2
    explicacao: "2⁵ é o 2 multiplicado por ele mesmo cinco vezes: 2 × 2 × 2 × 2 × 2 = 32. Quem marcou 10 fez 2 × 5."
  - pergunta: "Como se escreve 0,00045 em notação científica?"
    opcoes: ["4,5 × 10⁻⁴", "45 × 10⁻⁵", "4,5 × 10⁴", "0,45 × 10⁻³"]
    resposta: 0
    explicacao: "O primeiro número precisa ficar entre 1 e 10: 4,5. Para ir de 0,00045 a 4,5, a vírgula anda 4 casas para a direita, e o expoente fica −4. 45 × 10⁻⁵ tem o mesmo valor, mas não está em notação científica, porque 45 passa de 10."
  - pergunta: "Quanto é 10³ × 10⁵ ÷ 10²?"
    opcoes: ["10¹⁵", "10⁴", "10¹⁰", "10⁶"]
    resposta: 3
    explicacao: "Na multiplicação de mesma base, somam-se os expoentes; na divisão, subtraem-se: 3 + 5 − 2 = 6. Resultado: 10⁶."
  - pergunta: "A raiz quadrada de 50 fica entre quais números inteiros?"
    opcoes: ["6 e 7", "7 e 8", "24 e 26", "5 e 6"]
    resposta: 1
    explicacao: "7² = 49 e 8² = 64. Como 50 fica entre 49 e 64, a raiz de 50 fica entre 7 e 8, bem perto de 7."
---

```provocacao
O noticiário diz que um programa vai custar "2 bilhões de reais" e que uma cidade tem "500 mil habitantes". Quanto isso dá por pessoa? Com tantos zeros, é fácil se perder. Existe um jeito de fazer essa conta em uma linha?
```

## O que você vai aprender

Ao fim desta aula você vai calcular potências, usar as regras que encurtam as contas com potências de mesma base, estimar raízes quadradas sem calculadora e escrever e operar números em notação científica, inclusive com os prefixos quilo, mega, giga, mili, micro e nano.

## Potência é multiplicação repetida

Uma família tem 3 filhos. Cada filho tem 3 filhos. Cada neto tem 3 filhos. Quantos bisnetos? 3 × 3 × 3 = 27. Essa multiplicação do mesmo número por ele mesmo se escreve como **potência**: 3³ = 27. O 3 de baixo é a **base**; o 3 pequeno de cima é o **expoente**, que diz quantas vezes a base aparece.

Cuidado com o engano mais comum: 3³ não é 3 × 3 = 9. É 3 × 3 × 3 = 27. E 2⁵ não é 2 × 5 = 10; é 2 × 2 × 2 × 2 × 2 = 32.

Com sinal, os parênteses mandam. (−3)² = (−3) × (−3) = 9. Já −3² quer dizer "o oposto de 3²": −9. Base negativa com expoente par dá positivo; com expoente ímpar, negativo.

## As regras que encurtam a conta

```formula
aᵐ · aⁿ = aᵐ⁺ⁿ      aᵐ ÷ aⁿ = aᵐ⁻ⁿ      (aᵐ)ⁿ = aᵐ·ⁿ
multiplicando potências de mesma base, some os expoentes
dividindo potências de mesma base, subtraia os expoentes
potência de potência: multiplique os expoentes
```

De onde vem isso? 2³ · 2² = (2 · 2 · 2) · (2 · 2): são cinco 2 multiplicados, 2⁵. Não é preciso decorar: conte os fatores.

Da regra da divisão saem dois casos especiais. Qualquer número (menos o zero) elevado a zero vale 1, porque 5³ ÷ 5³ = 5⁰ e também é 1. E o expoente negativo quer dizer "um sobre": 10⁻² = 1/10² = 1/100 = 0,01.

## Raiz quadrada

A raiz quadrada desfaz o quadrado. √49 = 7 porque 7² = 49. Um terreno quadrado de 144 m² tem lado √144 = 12 m.

Vale saber de cor os quadrados de 1 a 15: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225. Com eles, você estima qualquer raiz. √50 fica entre 7 e 8, porque 50 fica entre 49 e 64, e bem perto de 7.

Para números grandes, separe a potência de 10. √3.600 = √36 × √100 = 6 × 10 = 60. Para decimais, pense na fração: √0,09 = √(9/100) = 3/10 = 0,3.

Atenção: a raiz da soma não é a soma das raízes. √(9 + 16) = √25 = 5, e não 3 + 4 = 7.

## Notação científica

Números com muitos zeros cansam e enganam. A notação científica escreve qualquer número como um número entre 1 e 10 vezes uma potência de 10.

```formula
N = a × 10ⁿ,  com 1 ≤ a < 10
o primeiro fator fica entre 1 e 10; o expoente conta quantas casas a vírgula andou
vírgula para a esquerda (número grande): expoente positivo; para a direita (número pequeno): expoente negativo
```

72.000.000 vira 7,2 × 10⁷: a vírgula andou 7 casas para a esquerda. 0,00045 vira 4,5 × 10⁻⁴: andou 4 casas para a direita.

Para multiplicar, multiplique os primeiros fatores e some os expoentes. (3 × 10⁴) × (2 × 10⁵) = 6 × 10⁹. Para dividir, divida os fatores e subtraia os expoentes. Se o primeiro fator sair do intervalo, ajuste: 0,3 × 10⁴ = 3 × 10³.

Os prefixos do Sistema Internacional são potências de 10, segundo o BIPM: quilo (k) é 10³, mega (M) é 10⁶, giga (G) é 10⁹, mili (m) é 10⁻³, micro (µ) é 10⁻⁶ e nano (n) é 10⁻⁹. Um quilômetro são 10³ metros; um nanômetro é 10⁻⁹ metro.

```navidareal
Volte à provocação, com números redondos de exemplo. Dois bilhões de reais são 2 × 10⁹. Quinhentos mil habitantes são 5 × 10⁵. Por pessoa: (2 ÷ 5) × 10⁹⁻⁵ = 0,4 × 10⁴ = 4 × 10³ = R$ 4.000.

Um número que parecia gigante vira um valor que dá para comparar com o salário. Quando a notícia fala em bilhões, dividir pela população é o primeiro passo para entender se aquilo é muito ou pouco.
```

```verificar
Quanto é (−3)²?
+ 9
- −9
- −6
> O expoente vale para tudo o que está entre os parênteses: (−3) × (−3). Sinais iguais dão positivo.
```

## Exemplo resolvido

**Um conta-gotas solta gotas de 5 × 10⁻² mL. Quantas gotas são necessárias para encher uma garrafa de 1 litro?**

1. Passe o litro para mililitros: 1 L = 1.000 mL = 10³ mL.
2. Divida: 10³ ÷ (5 × 10⁻²) = (1 ÷ 5) × 10³⁻⁽⁻²⁾ = 0,2 × 10⁵.
3. Ajuste o primeiro fator: 0,2 × 10⁵ = 2 × 10⁴.
4. São 20.000 gotas.

Confira: 5 × 10⁻² mL = 0,05 mL; 20 gotas fazem 1 mL. Para 1.000 mL, 20 × 1.000 = 20.000 gotas.

## Como isso cai no ENEM

- **Formatos:** distâncias astronômicas, tamanhos de células e vírus, capacidade de armazenamento digital, populações e orçamentos, crescimento de bactérias que dobram a cada intervalo. A questão pede para escrever um número em notação científica, comparar ordens de grandeza ou fazer uma conta com potências de 10.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, potências, raízes e notação científica tiveram 2 das 81 questões classificadas de Matemática (2,5%). São só duas edições: é tendência, não promessa.
- **Habilidades:** H1 (reconhecer, em situações sociais, os significados e as formas de escrever números e operações), na escrita em notação científica, e H3 (resolver problemas com conhecimentos numéricos), a mais frequente da área nessa base (12 das 81 questões).
- **Armadilhas:**
  - Fazer base vezes expoente: 2⁵ não é 10.
  - Errar o sinal do expoente: número menor que 1 tem expoente negativo.
  - Deixar o primeiro fator fora do intervalo de 1 a 10.
  - Somar os primeiros fatores na multiplicação. Eles se multiplicam; os expoentes é que se somam.
  - Achar que √(a + b) = √a + √b.
- **Na prova:** a Matemática fica no segundo dia, {{enem:aplicacao-dia-2}}, sem calculadora. As potências de 10 são a sua calculadora.

## Questão comentada

**Texto-base.** Uma biblioteca pública digitalizou seu acervo. O sistema guarda 3,2 × 10⁶ arquivos, e cada arquivo ocupa, em média, 2,5 × 10² kB. Considere 1 GB = 10⁶ kB.

**Comando.** O espaço ocupado pelo acervo digital, em gigabytes, é de

A) 800 GB.
B) 80 GB.
C) 8.000 GB.
D) 5,7 GB.
E) 800.000 GB.

**Resolução.**

1. Multiplique os primeiros fatores: 3,2 × 2,5 = 8. (Sem calculadora: 3,2 × 2,5 = 3,2 × 10 ÷ 4 = 32 ÷ 4 = 8.)
2. Some os expoentes: 10⁶ × 10² = 10⁸. Total: 8 × 10⁸ kB.
3. Passe para GB dividindo por 10⁶: 8 × 10⁸⁻⁶ = 8 × 10² = 800 GB.

**Gabarito: A.**

**Por que as outras não:**

- B) 80 GB: um expoente se perdeu, 8 × 10⁷ kB. Some com cuidado: 6 + 2 = 8.
- C) 8.000 GB: na conversão, foram subtraídas 5 casas em vez de 6. 1 GB tem 10⁶ kB.
- D) 5,7 GB: os primeiros fatores foram somados (3,2 + 2,5). Na multiplicação, eles se multiplicam.
- E) 800.000 GB: a conversão usou 1 GB = 10³ kB. O texto diz 10⁶.

```realidade
Procure no seu celular quanto espaço as fotos ocupam e quantas fotos há. Escreva os dois números em notação científica e calcule o tamanho médio de uma foto. Dá mais ou menos que o tamanho de uma música, se você tiver alguma guardada?
```

## Resumo

- aⁿ é a base multiplicada n vezes: 2⁵ = 32.
- Mesma base: na multiplicação, some os expoentes; na divisão, subtraia; potência de potência, multiplique.
- a⁰ = 1 e 10⁻ⁿ = 1/10ⁿ.
- Raiz: use os quadrados de 1 a 15 para estimar. √(a + b) não é √a + √b.
- Notação científica: a × 10ⁿ com 1 ≤ a < 10; número pequeno tem expoente negativo.
- Prefixos: k = 10³, M = 10⁶, G = 10⁹, m = 10⁻³, µ = 10⁻⁶, n = 10⁻⁹.

## Para aprofundar

- [Potências e raízes](/trilhas/matematica-fundamental/potencias-e-raizes)
- [Expressões numéricas](/trilhas/enem-matematica-fundamentos/expressoes-numericas)
- [Arredondamento e estimativa](/trilhas/enem-matematica-fundamentos/arredondamento-e-estimativa)
- [Função exponencial](/trilhas/enem-matematica-funcoes-e-algebra/funcao-exponencial)
- [Unidades de medida](/trilhas/enem-matematica-proporcionalidade/unidades-de-medida)
