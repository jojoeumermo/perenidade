---
titulo: "Fenômenos periódicos e funções trigonométricas"
resumo: "Seno e cosseno no círculo, o radiano, o gráfico em onda e a função que o ENEM usa para marés, rodas-gigantes e temperaturas: como achar máximo, mínimo, amplitude e período sem decorar fórmulas soltas."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Algebra and Trigonometry 2e, seção 7.3, Unit Circle"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/7-3-unit-circle"
  - titulo: "Algebra and Trigonometry 2e, seção 8.1, Graphs of the Sine and Cosine Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/8-1-graphs-of-the-sine-and-cosine-functions"
  - titulo: "Matriz de Referência do Enem"
    autor: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (Inep)"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é o valor máximo da função f(x) = 5 + 2 · sen x?"
    opcoes: ["5", "2", "10", "7"]
    resposta: 3
    explicacao: "O seno vai de −1 a 1. O máximo acontece quando sen x = 1: f = 5 + 2 · 1 = 7. O mínimo seria 5 − 2 = 3."
  - pergunta: "Qual é o período da função f(t) = 3 · cos(2t)?"
    opcoes: ["π", "2π", "3", "4π"]
    resposta: 0
    explicacao: "O período é 2π dividido pelo número que multiplica o t: 2π ÷ 2 = π. O 3 muda a altura da onda, não o período."
  - pergunta: "Quanto vale sen(π/2)?"
    opcoes: ["0", "−1", "1", "1/2"]
    resposta: 2
    explicacao: "π/2 radianos são 90°. No círculo de raio 1, esse ponto fica no alto, com altura 1. Então sen(π/2) = 1."
  - pergunta: "Quantos graus tem um ângulo de π radianos?"
    opcoes: ["90°", "180°", "360°", "3,14°"]
    resposta: 1
    explicacao: "Meia volta no círculo é π radianos, e meia volta tem 180°. Por isso π rad = 180°."
---

```provocacao
A cadeira de uma roda-gigante sobe, chega ao alto, desce, chega ao chão e começa tudo de novo. Em muitas praias, a maré sobe e desce duas vezes por dia. Como uma única conta pode dizer a altura da cadeira, ou da água, em qualquer instante?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que é um fenômeno periódico, o que são o seno e o cosseno no círculo, trocar graus por radianos e ler a função que a prova usa para fenômenos que se repetem: achar o máximo, o mínimo, a amplitude e o período, e o instante em que cada um acontece.

## O que se repete

Um fenômeno **periódico** é o que se repete do mesmo jeito, de tempos em tempos. A roda-gigante, a maré, o dia e a noite, o batimento do coração, as estações do ano.

Dois números descrevem esses fenômenos. O **período** é o tempo de uma repetição completa: uma volta da roda, um ciclo da maré. A **amplitude** é o quanto a grandeza sobe ou desce em relação ao meio. Numa roda-gigante de raio 10 m, a cadeira fica até 10 m acima do centro e até 10 m abaixo dele: a amplitude é 10 m.

## Seno e cosseno no círculo

Desenhe um círculo de raio 1, com centro na origem do plano cartesiano. Um ponto anda sobre ele, a partir do ponto (1, 0), no sentido anti-horário. Depois de girar um ângulo x, ele está num lugar do círculo.

- O **cosseno** de x é a coordenada horizontal desse ponto.
- O **seno** de x é a coordenada vertical, a altura do ponto.

Como o raio é 1, seno e cosseno ficam sempre entre −1 e 1. Alguns valores para guardar: sen 0 = 0, sen 90° = 1, sen 180° = 0, sen 270° = −1. E cos 0 = 1, cos 90° = 0, cos 180° = −1.

Depois de uma volta inteira, o ponto volta ao começo, e os valores se repetem. É por isso que seno e cosseno servem para fenômenos periódicos.

## Graus e radianos

Nas funções, o ângulo costuma vir em **radianos**. Uma volta inteira tem 360°, ou 2π radianos. Meia volta tem 180°, ou π radianos. Para trocar, use a regra de três: π rad = 180°. Assim, 90° = π/2, 60° = π/3 e 30° = π/6.

## A função que a prova usa

O gráfico de sen x é uma onda: começa em 0, sobe até 1, desce até −1 e volta a 0 depois de 2π. Nos problemas, a onda é esticada, levantada e acelerada:

```formula
f(t) = a + b · sen(k · t)      (ou com cosseno)
a é a linha do meio; |b| é a amplitude; máximo = a + |b|; mínimo = a − |b|
o período é 2π ÷ k: quanto maior o k, mais rápido a onda se repete
```

Para achar **quando** acontece o máximo, pergunte quando o seno vale 1: quando o ângulo k · t vale π/2 (ou π/2 mais uma volta). Para o mínimo, quando o ângulo vale 3π/2. Com cosseno, o máximo é no ângulo 0, e o mínimo, no ângulo π.

Se o b for negativo, a onda fica de cabeça para baixo: quando o seno vale 1, a função está no mínimo.

Um jeito seguro de não se perder é montar uma pequena tabela. Escolha os instantes em que o ângulo vale 0, π/2, π, 3π/2 e 2π. Nesses pontos, o seno vale 0, 1, 0, −1 e 0, e o cosseno vale 1, 0, −1, 0 e 1. Calcule a função só nesses cinco instantes: eles mostram o começo, o pico, o meio, o vale e o fim de um ciclo.

```verificar
Qual é o valor mínimo de g(t) = 10 − 4 · cos t?
- 10
+ 6
- −4
> O cosseno vai de −1 a 1. O termo −4 · cos t fica menor quando cos t = 1: g = 10 − 4 = 6. O máximo seria 10 + 4 = 14.
```

```navidareal
Tábuas de maré, publicadas para os portos, dizem a hora e a altura das marés alta e baixa. Pescadores e marisqueiras usam essas tabelas para saber quando sair. Entre uma maré alta e outra, o desenho da altura da água ao longo do dia lembra uma onda de seno.

Na prova, o modelo vem pronto. O seu trabalho é ler nele o que a situação pergunta: a altura máxima, a mínima, o tempo de um ciclo ou o horário de um pico.
```

## Exemplo resolvido

**A altura, em metros, de uma cadeira de roda-gigante é dada por h(t) = 11 − 10 · cos(πt/5), com t em minutos. Qual é a altura mínima, a máxima e o tempo de uma volta?**

1. A linha do meio é 11 m: é a altura do centro da roda.
2. A amplitude é 10 m: é o raio da roda.
3. Mínimo: quando cos = 1, h = 11 − 10 = 1 m. Isso acontece em t = 0, o embarque.
4. Máximo: quando cos = −1, h = 11 + 10 = 21 m. O ângulo πt/5 vale π quando t = 5 minutos.
5. Período: 2π ÷ (π/5) = 2π × 5/π = 10 minutos por volta.

Confira com o bom senso: a cadeira chega ao alto em 5 minutos, a metade da volta.

## Como isso cai no ENEM

- **Formatos:** altura de uma roda-gigante ou de um ponto de uma roda; nível da maré; temperatura ao longo do dia; pressão do sangue ou outro fenômeno do corpo que se repete; gráfico em onda para identificar a função. A questão dá a função e pede o máximo, o mínimo, o período ou o instante de um valor.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, fenômenos periódicos e funções trigonométricas foram o tópico de 1 das 81 questões classificadas de Matemática (1,2%). Nessa base, a H21 teve 7 das 81 questões (8,6%) e a H20, 5 (6,2%). São só duas provas: é tendência, não promessa.
- **Habilidades:** H21 (resolver problemas cuja modelagem pede álgebra), H20 (interpretar gráficos cartesianos que relacionam grandezas) e H19 (identificar a expressão algébrica que traduz a relação entre grandezas).
- **Armadilhas:**
  - Achar que o máximo é a + b mesmo com b negativo, sem pensar em quando ele acontece.
  - Confundir o período com o número k que multiplica o t (o período é 2π ÷ k).
  - Achar o valor da função em t = 0 e dizer que é o máximo.
  - Misturar graus e radianos.

## Questão comentada

**Texto-base.** Num modelo simplificado, a temperatura de uma cidade ao longo de um dia, em graus Celsius, é dada por T(t) = 22 + 5 · sen(π(t − 9)/12), em que t é a hora do dia, de 0 a 24.

**Comando.** Segundo o modelo, a temperatura máxima do dia e o horário em que ela acontece são

A) 27 °C, às 9 h.
B) 27 °C, às 15 h.
C) 22 °C, às 15 h.
D) 17 °C, às 3 h.
E) 27 °C, às 21 h.

**Resolução.**

1. O seno vai de −1 a 1. O máximo é 22 + 5 · 1 = 27 °C.
2. O seno vale 1 quando o ângulo vale π/2. Então π(t − 9)/12 = π/2.
3. Corte o π dos dois lados: (t − 9)/12 = 1/2. Então t − 9 = 6, e t = 15.
4. A máxima é de 27 °C, às 15 h.

**Gabarito: B.**

**Por que as outras não:**

- A) 27 °C, às 9 h: em t = 9 o ângulo é zero, e sen 0 = 0. A temperatura às 9 h é 22 °C, a linha do meio.
- C) 22 °C, às 15 h: o horário está certo, mas faltou a amplitude. Às 15 h, o seno vale 1, e T = 22 + 5.
- D) 17 °C, às 3 h: esse é o mínimo. Em t = 3, o ângulo é −π/2, e o seno vale −1.
- E) 27 °C, às 21 h: em t = 21, o ângulo é π, e sen π = 0. A temperatura às 21 h volta a 22 °C.

```realidade
Escolha uma coisa da sua rotina que se repete: o ônibus que passa no ponto, a maré na praia mais perto, a hora mais quente do dia na sua rua. Qual é o período dela? Ela tem um máximo e um mínimo? Anote durante alguns dias e veja se o padrão se repete mesmo.
```

## Resumo

- Fenômeno periódico é o que se repete; período é o tempo de um ciclo; amplitude é o quanto sobe ou desce em relação ao meio.
- Seno é a altura e cosseno é a posição horizontal de um ponto no círculo de raio 1; os dois ficam entre −1 e 1.
- π rad = 180°; uma volta é 2π.
- Em f(t) = a + b · sen(kt): máximo a + |b|, mínimo a − |b|, período 2π ÷ k.
- Para achar quando, pergunte quando o seno (ou o cosseno) vale 1 ou −1.

## Para aprofundar

- [Trigonometria no triângulo retângulo](/trilhas/matematica-medio/trigonometria-no-triangulo-retangulo)
- [Função e leitura de gráficos](/trilhas/enem-matematica-funcoes-e-algebra/funcoes-e-graficos)
- [Ondas](/trilhas/fisica-medio/ondas)
- [Circunferência e círculo](/trilhas/enem-matematica-geometria/circunferencia-e-circulo)
