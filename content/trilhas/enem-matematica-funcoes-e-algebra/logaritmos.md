---
titulo: "Logaritmos e escalas logarítmicas"
resumo: "O logaritmo como a pergunta que desfaz a potência, as propriedades que o ENEM usa e as escalas em que cada ponto vale dez vezes mais: pH, terremotos e decibéis."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Matriz de Referência do Enem"
    autor: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (Inep)"
  - titulo: "Algebra and Trigonometry 2e, seção 6.3, Logarithmic Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/6-3-logarithmic-functions"
  - titulo: "Algebra and Trigonometry 2e, seção 6.5, Logarithmic Properties"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/6-5-logarithmic-properties"
  - titulo: "Chemistry 2e, seção 14.2, pH and pOH"
    autor: "Paul Flowers e outros (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh"
  - titulo: "College Physics 2e, seção 17.3, Sound Intensity and Sound Level"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/17-3-sound-intensity-and-sound-level"
quiz:
  - pergunta: "Quanto vale log 1.000 (na base 10)?"
    opcoes: ["10", "3", "100", "0,001"]
    resposta: 1
    explicacao: "A pergunta é: 10 elevado a quanto dá 1.000? Como 10³ = 1.000, log 1.000 = 3."
  - pergunta: "Quanto vale log₂ 32?"
    opcoes: ["16", "2", "64", "5"]
    resposta: 3
    explicacao: "2 elevado a quanto dá 32? 2, 4, 8, 16, 32: são cinco fatores 2, então log₂ 32 = 5. Quem marca 16 dividiu 32 por 2."
  - pergunta: "Uma solução tem pH 4 e outra tem pH 6. Comparada à segunda, a concentração de íons H⁺ da primeira é:"
    opcoes: ["100 vezes maior", "2 vezes maior", "1,5 vez maior", "20 vezes maior"]
    resposta: 0
    explicacao: "Cada ponto a menos no pH é uma concentração de H⁺ 10 vezes maior. De 6 para 4 são 2 pontos: 10 × 10 = 100 vezes."
  - pergunta: "Use log 2 ≈ 0,301. Quanto vale, aproximadamente, log 8?"
    opcoes: ["2,408", "0,301", "0,903", "8,301"]
    resposta: 2
    explicacao: "8 = 2³. Pela propriedade da potência, log 8 = 3 × log 2 ≈ 3 × 0,301 = 0,903."
---

```provocacao
No noticiário, um terremoto de magnitude 7 parece "só um pouco" maior que um de magnitude 6. Um barulho de 90 decibéis parece ter o dobro do de 45 decibéis. Será que é isso mesmo?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é um logaritmo, calcular logaritmos simples de cabeça, usar as três propriedades que o ENEM cobra e ler escalas logarítmicas, como o pH, a escala de magnitude dos terremotos e os decibéis, sabendo que cada ponto vale dez vezes mais.

## O logaritmo é uma pergunta

Você já sabe calcular uma potência: 10³ = 1.000. O logaritmo faz a pergunta ao contrário: **10 elevado a quanto dá 1.000?** A resposta é 3.

```formula
log_b a = x   quer dizer   bˣ = a
o logaritmo de a na base b é o expoente x que se põe no b para chegar no a
a base b é positiva e diferente de 1; o a tem de ser positivo
quando a base não aparece, ela é 10: log 1.000 = 3
```

Alguns exemplos, sempre fazendo a pergunta:

- log₂ 8 = 3, porque 2³ = 8.
- log₃ 81 = 4, porque 3⁴ = 81.
- log 100 = 2, porque 10² = 100.
- log 1 = 0, porque qualquer base elevada a zero dá 1.
- log 0,01 = −2, porque 10⁻² = 1/100 = 0,01.

Na base 10, o logaritmo de uma potência de 10 é só contar os zeros: log 10.000 = 4.

```verificar
Quanto vale log₃ 9?
- 3
+ 2
- 27
> 3 elevado a quanto dá 9? 3² = 9, então log₃ 9 = 2.
```

## As três propriedades que a prova usa

O logaritmo transforma multiplicação em soma. É isso que o torna tão útil para contas grandes.

```formula
log (m · n) = log m + log n      log (m ÷ n) = log m − log n      log (mᵏ) = k · log m
o logaritmo de um produto é a soma dos logaritmos
o logaritmo de uma divisão é a diferença dos logaritmos
o logaritmo de uma potência é o expoente vezes o logaritmo da base
```

Na prova, o enunciado costuma dar valores como log 2 ≈ 0,301 e log 3 ≈ 0,477. Com eles você calcula muitos outros:

- log 6 = log 2 + log 3 ≈ 0,301 + 0,477 = 0,778.
- log 5 = log (10 ÷ 2) = 1 − 0,301 = 0,699.
- log 9 = log 3² = 2 × 0,477 = 0,954.

## Logaritmo para achar o tempo

Na aula de função exponencial, você igualou bases para achar o tempo. Quando isso não dá, entra o logaritmo. Se 10ˣ = 2, então x = log 2 ≈ 0,301.

Para uma base qualquer, aplique log dos dois lados e use a propriedade da potência: de bˣ = a vem x · log b = log a, e então x = log a ÷ log b.

## O gráfico do logaritmo

Veja f(x) = log x em tabela:

| x | 0,1 | 1 | 10 | 100 | 1.000 |
| --- | --- | --- | --- | --- | --- |
| log x | −1 | 0 | 1 | 2 | 3 |

Em palavras: o gráfico só existe para x positivo. Ele corta o eixo horizontal em x = 1, sobe sempre, mas cada vez mais devagar: para o log subir 1, o x precisa ser multiplicado por 10. É o espelho da exponencial: a exponencial dispara, o logaritmo vai devagar.

## Escalas em que cada ponto vale dez vezes

Quando uma grandeza vai de valores muito pequenos a muito grandes, usa-se uma **escala logarítmica**: em vez do valor, anota-se o logaritmo dele. Assim, de 1 a 1.000.000.000 a escala vai só de 0 a 9. A consequência que mais cai: **cada ponto a mais na escala é um valor 10 vezes maior**.

- **pH:** mede a acidez. É pH = −log [H⁺], em que [H⁺] é a concentração de íons de hidrogênio. Por causa do sinal de menos, quanto **menor** o pH, mais ácido. Uma solução de pH 3 tem concentração de H⁺ 10 vezes maior que uma de pH 4, e 100 vezes maior que uma de pH 5.
- **Magnitude de terremotos (escala Richter):** é uma escala logarítmica de base 10. Um ponto a mais de magnitude quer dizer uma medida 10 vezes maior no sismógrafo. Uma diferença de 2 pontos, 100 vezes.
- **Decibéis (dB):** medem o nível sonoro, β = 10 · log (I ÷ I₀), em que I é a intensidade do som e I₀ é a intensidade de referência, a mais fraca que se ouve. Por causa do 10 na frente, **cada 10 dB a mais é uma intensidade 10 vezes maior**. 20 dB a mais, 100 vezes.

```navidareal
Volte à provocação. Um terremoto de magnitude 7 registra no sismógrafo uma medida 10 vezes maior que um de magnitude 6. E 90 dB não é o dobro de 45 dB: são 45 dB a mais, uma intensidade cerca de 30 mil vezes maior (10⁴,⁵).

Saber ler uma escala logarítmica protege de dois enganos. O primeiro é achar pequena uma diferença enorme, como entre o barulho de uma conversa e o de uma obra ao lado da escola. O segundo é ler um gráfico com eixo logarítmico como se fosse comum, achando que uma subida reta é um crescimento devagar.
```

## Exemplo resolvido

**Uma aplicação rende 10% ao ano, a juros compostos. Em quanto tempo o valor dobra? Use log 2 ≈ 0,301 e log 1,1 ≈ 0,041.**

1. Dobrar é chegar a 2 vezes o valor inicial: 1,1ᵗ = 2.
2. Aplique log dos dois lados: log (1,1ᵗ) = log 2.
3. Pela propriedade da potência: t · log 1,1 = log 2.
4. Então t = log 2 ÷ log 1,1 ≈ 0,301 ÷ 0,041 ≈ 7,3 anos.

Confira com potências: 1,1⁷ ≈ 1,95, ainda abaixo de 2; 1,1⁸ ≈ 2,14, acima de 2. O valor dobra durante o 8º ano, como a conta indicou.

## Como isso cai no ENEM

- **Formatos:** comparação de terremotos, de níveis sonoros ou de acidez por escalas logarítmicas; tempo para um valor dobrar ou cair pela metade, com os logaritmos dados no enunciado; contas com as propriedades a partir de log 2 e log 3; leitura de gráficos com eixo em escala logarítmica.
- **Habilidades:** H21 (resolver problemas cuja modelagem pede álgebra), H19 (identificar a expressão algébrica que traduz a relação entre grandezas) e H22 (usar álgebra para construir argumentos). Nas provas de 2022 e 2023, classificadas pelo instituto, logaritmos e escalas logarítmicas foram o tópico de 1 das 81 questões de Matemática (1,2%). Na área inteira, a H21 apareceu em 7 dessas 81 questões. São só duas provas: é tendência, não promessa. As mesmas escalas podem aparecer na prova de Ciências da Natureza, no pH e no som.
- **Armadilhas:**
  - Ler a escala como se fosse comum: 1 ponto a mais é 10 vezes, não "um pouco".
  - Esquecer o sinal do pH: pH menor é mais ácido.
  - Em decibéis, achar que cada dB é 10 vezes. São 10 dB para 10 vezes.
  - Usar log (m + n) = log m + log n. A propriedade é do produto, não da soma.
  - Dividir os números em vez dos logaritmos: o tempo é log a ÷ log b, não a ÷ b.

## Questão comentada

**Texto-base.** O nível sonoro, em decibéis (dB), é dado por β = 10 · log (I ÷ I₀), em que I é a intensidade do som e I₀ é uma intensidade de referência. Numa sala de aula silenciosa, um medidor marcou 60 dB. Na calçada em frente, durante uma obra, o mesmo medidor marcou 90 dB.

**Comando.** A intensidade do som na calçada, comparada à da sala, é

A) 1,5 vez maior.
B) 30 vezes maior.
C) 1.000 vezes maior.
D) 3 vezes maior.
E) 100 vezes maior.

**Resolução.**

1. A diferença de nível é 90 − 60 = 30 dB.
2. Pela fórmula, 90 − 60 = 10 · log (I_calçada ÷ I₀) − 10 · log (I_sala ÷ I₀) = 10 · log (I_calçada ÷ I_sala).
3. Então 30 = 10 · log (razão), ou log (razão) = 3.
4. A razão é 10³ = 1.000. Pela regra prática: cada 10 dB é 10 vezes; 30 dB são 10 × 10 × 10.

**Gabarito: C.**

**Por que as outras não:**

- A) 1,5 vez maior: foram divididos os níveis (90 ÷ 60). Decibel é escala logarítmica: a diferença de níveis é que conta, e ela vira um expoente.
- B) 30 vezes maior: a diferença em decibéis foi lida como a razão das intensidades. 30 dB a mais é 10 elevado a 3.
- D) 3 vezes maior: a conta chegou a log (razão) = 3, mas parou no logaritmo. A razão é 10³.
- E) 100 vezes maior: foram contados só 20 dB (2 grupos de 10). A diferença é de 30 dB, 3 grupos.

```realidade
Pense nos sons da sua rotina: o ônibus, a rua de casa, o lugar onde você trabalha. Qual deles você acha que está mais de 10 dB acima de uma conversa? Lembre que 10 dB a mais é uma intensidade 10 vezes maior. Anote o que mais pesa nos seus ouvidos ao longo do dia.
```

## Resumo

- log_b a = x quer dizer bˣ = a: o logaritmo é o expoente.
- Sem base escrita, a base é 10. log 1 = 0 e log de 10ⁿ é n.
- Produto vira soma, divisão vira diferença, potência vira multiplicação pelo expoente.
- Para achar o tempo numa exponencial: x = log a ÷ log b.
- Escala logarítmica: cada ponto a mais é 10 vezes mais. No pH, menor é mais ácido. Em decibéis, cada 10 dB é 10 vezes.

## Para aprofundar

- [Exponencial e logaritmo](/trilhas/matematica-medio/exponencial-e-logaritmo)
- [Potências e raízes](/trilhas/matematica-fundamental/potencias-e-raizes)
- [Função exponencial](/trilhas/enem-matematica-funcoes-e-algebra/funcao-exponencial)
- [Juros simples e compostos](/trilhas/matematica-medio/juros-simples-e-compostos)
