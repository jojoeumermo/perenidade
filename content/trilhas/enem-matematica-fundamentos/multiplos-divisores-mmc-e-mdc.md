---
titulo: "Múltiplos, divisores, MMC e MDC"
resumo: "Múltiplos, divisores, números primos e os critérios de divisibilidade; o MMC para achar quando as coisas coincidem e o MDC para repartir no maior tamanho possível, sem calculadora."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 2.4, Find Multiples and Factors"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/2-4-find-multiples-and-factors"
  - titulo: "Prealgebra 2e, seção 2.5, Prime Factorization and the Least Common Multiple"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/2-5-prime-factorization-and-the-least-common-multiple"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é o MMC de 6 e 8?"
    opcoes: ["2", "48", "14", "24"]
    resposta: 3
    explicacao: "Múltiplos de 8: 8, 16, 24. O 24 também é múltiplo de 6 (6 × 4). É o menor múltiplo comum. 48 também é comum, mas não é o menor."
  - pergunta: "Qual é o MDC de 36 e 48?"
    opcoes: ["6", "12", "144", "4"]
    resposta: 1
    explicacao: "36 = 2² × 3² e 48 = 2⁴ × 3. Os fatores comuns, com o menor expoente: 2² × 3 = 12. 6 e 4 também dividem os dois, mas não são o maior."
  - pergunta: "Qual destes números é divisível por 3?"
    opcoes: ["4.125", "2.341", "1.003", "5.111"]
    resposta: 0
    explicacao: "Um número é divisível por 3 quando a soma dos algarismos é. 4 + 1 + 2 + 5 = 12, que é divisível por 3. Nos outros, as somas são 10, 4 e 8."
  - pergunta: "Qual é a fatoração de 60 em números primos?"
    opcoes: ["2 × 30", "2² × 15", "2² × 3 × 5", "4 × 15"]
    resposta: 2
    explicacao: "Divida pelos primos até chegar a 1: 60 ÷ 2 = 30, 30 ÷ 2 = 15, 15 ÷ 3 = 5, 5 ÷ 5 = 1. Fica 2² × 3 × 5. Nas outras opções aparecem 30, 15 e 4, que não são primos."
---

```provocacao
Você folga a cada 6 dias. Sua irmã, que mora com você, folga a cada 4. Hoje as duas estão em casa. Daqui a quantos dias vão conseguir passar outra folga juntas?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer múltiplos e divisores, usar os critérios de divisibilidade, decompor um número em primos e calcular o MMC e o MDC. E, mais importante, vai saber quando a questão pede cada um.

## Múltiplos e divisores

Os **múltiplos** de 6 são os resultados da tabuada do 6: 0, 6, 12, 18, 24, 30, e assim por diante, sem fim. Dizer que 24 é múltiplo de 6 é dizer que 24 cabe exatamente na tabuada do 6: 6 × 4 = 24.

Os **divisores** vão no sentido contrário. Os divisores de 12 são os números que dividem 12 sem deixar resto: 1, 2, 3, 4, 6 e 12. São poucos e acabam.

As duas ideias são a mesma, vista dos dois lados: se 24 é múltiplo de 6, então 6 é divisor de 24.

## Critérios de divisibilidade

Sem calculadora, alguns atalhos dizem se uma divisão vai ser exata:

- **por 2:** o último algarismo é par (0, 2, 4, 6, 8).
- **por 3:** a soma dos algarismos é divisível por 3. Em 4.125, 4 + 1 + 2 + 5 = 12: divisível.
- **por 5:** termina em 0 ou 5.
- **por 9:** a soma dos algarismos é divisível por 9.
- **por 10:** termina em 0.
- **por 6:** é divisível por 2 e por 3 ao mesmo tempo.

## Números primos e fatoração

Um número **primo** tem exatamente dois divisores: o 1 e ele mesmo. Os primeiros são 2, 3, 5, 7, 11, 13, 17, 19, 23, 29. O 1 não é primo, porque tem um divisor só. O 2 é o único primo par.

Todo número inteiro maior que 1 pode ser escrito como uma multiplicação de primos, e de um jeito só. Isso é a **fatoração**. Para fatorar, divida pelo menor primo possível até chegar a 1:

- 60 ÷ 2 = 30
- 30 ÷ 2 = 15
- 15 ÷ 3 = 5
- 5 ÷ 5 = 1

Então 60 = 2² × 3 × 5. Para saber se um número é primo, teste os primos até a raiz dele. Para 97, basta testar 2, 3, 5 e 7 (porque 10² = 100 já passa de 97). Nenhum divide: 97 é primo.

## MMC: quando as coisas voltam a coincidir

O **MMC**, mínimo múltiplo comum, é o menor número (sem contar o zero) que é múltiplo de todos ao mesmo tempo. Ele responde perguntas de **coincidência**: daqui a quanto tempo dois ônibus saem juntos de novo, dois turnos de folga caem no mesmo dia, duas luzes piscam juntas.

```formula
MMC = produto dos fatores primos, cada um com o MAIOR expoente
fatore cada número; pegue todos os primos que aparecem, cada um com o maior expoente
MDC = produto dos fatores primos COMUNS, cada um com o MENOR expoente
```

Para 12, 18 e 30: 12 = 2² × 3; 18 = 2 × 3²; 30 = 2 × 3 × 5. O MMC pega 2², 3² e 5: 4 × 9 × 5 = 180.

## MDC: repartir no maior tamanho possível

O **MDC**, máximo divisor comum, é o maior número que divide todos ao mesmo tempo. Ele responde perguntas de **divisão em partes iguais, do maior tamanho possível, sem sobra**: cortar fitas em pedaços iguais, montar kits iguais, cobrir um piso com lajotas quadradas sem cortar.

Para 36 e 48: 36 = 2² × 3² e 48 = 2⁴ × 3. Os primos comuns são 2 e 3. Com o menor expoente: 2² × 3 = 12.

Como saber qual dos dois usar? Pergunte se a resposta é **maior** ou **menor** que os números dados. O momento em que as coisas coincidem fica depois de todos os intervalos: o MMC é maior ou igual aos números. O pedaço que divide todos cabe dentro de cada um: o MDC é menor ou igual aos números.

```navidareal
Volte à provocação. Você folga nos dias 6, 12, 18, 24. Sua irmã, nos dias 4, 8, 12, 16. O primeiro dia em comum é o 12: MMC de 6 e 4.

Quem trabalha em escala sabe que o calendário manda na vida da família. A conta do MMC mostra, com antecedência, quando dá para marcar o almoço de domingo ou a consulta de que os dois precisam ir.
```

```verificar
O número 17 é primo?
+ Sim, só é divisível por 1 e por 17.
- Não, porque é ímpar.
- Não, porque termina em 7.
> Teste os primos até a raiz de 17 (um pouco mais que 4): 2 e 3. Nenhum divide 17.
```

## Exemplo resolvido

**Uma costureira tem duas fitas, de 84 cm e de 120 cm. Ela quer cortar as duas em pedaços do mesmo tamanho, o maior possível, sem sobrar nada. Quantos pedaços vai obter?**

1. "Mesmo tamanho, o maior possível, sem sobra": é MDC.
2. Fatore: 84 = 2² × 3 × 7 e 120 = 2³ × 3 × 5.
3. Primos comuns com o menor expoente: 2² × 3 = 12. Cada pedaço terá 12 cm.
4. Pedaços: 84 ÷ 12 = 7 e 120 ÷ 12 = 10. Total: 17 pedaços.

Confira: 12 cm é menor que as duas fitas, como deve ser um MDC. E 7 × 12 = 84, 10 × 12 = 120.

## Como isso cai no ENEM

- **Formatos:** horários de ônibus, escalas de trabalho, luzes que piscam, engrenagens que voltam à posição inicial (MMC); kits iguais, cortes de tecido ou madeira, lajotas quadradas, grupos de mesmo tamanho (MDC). Às vezes a questão pede a data ou a hora do encontro, e não só o número de dias.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, este tópico teve 1 das 81 questões classificadas de Matemática (1,2%). São só duas edições: é tendência, não promessa.
- **Habilidades:** H3 (resolver problemas com conhecimentos numéricos), a mais frequente da área nessa base (12 das 81 questões), e H2 (identificar padrões numéricos ou princípios de contagem), com 6.
- **Armadilhas:**
  - Usar MMC quando a questão pede MDC, e o contrário. Pergunte se a resposta é maior ou menor que os números.
  - Multiplicar os números em vez de calcular o MMC: dá um múltiplo comum, mas não o menor.
  - Parar no tamanho do pedaço quando a pergunta pede o número de pedaços.
  - Esquecer de converter unidades antes (metros e centímetros, horas e minutos).

## Questão comentada

**Texto-base.** Do terminal de um bairro saem três linhas de ônibus. A linha 1 parte a cada 12 minutos, a linha 2 a cada 18 minutos e a linha 3 a cada 30 minutos. Às 6h, os três ônibus partiram juntos.

**Comando.** Os três ônibus voltarão a partir juntos, pela primeira vez depois das 6h, às

A) 6h06.
B) 7h.
C) 6h30.
D) 15h.
E) 9h.

**Resolução.**

1. "Voltar a partir juntos" é coincidência: MMC de 12, 18 e 30.
2. Fatore: 12 = 2² × 3; 18 = 2 × 3²; 30 = 2 × 3 × 5.
3. Todos os primos, cada um com o maior expoente: 2² × 3² × 5 = 4 × 9 × 5 = 180 minutos.
4. 180 minutos são 3 horas. 6h + 3h = 9h.

**Gabarito: E.**

**Por que as outras não:**

- A) 6h06: 6 minutos é o MDC de 12, 18 e 30. O MDC divide os intervalos; o encontro fica depois de todos eles.
- B) 7h: os intervalos foram somados (12 + 18 + 30 = 60). Às 7h, a linha 2 não parte: 60 não é múltiplo de 18.
- C) 6h30: 30 minutos é só o maior intervalo. Às 6h30 a linha 1 não parte, porque 30 não é múltiplo de 12.
- D) 15h: foram multiplicados 18 e 30 (540 minutos, 9 horas). Dá um momento em que os três coincidem, mas não o primeiro.

```realidade
Escolha duas coisas da sua rotina que se repetem em intervalos diferentes: a feira e o dia do lixo reciclável, a sua folga e a de alguém da casa, o pagamento de duas contas. Calcule pelo MMC quando elas vão cair no mesmo dia e confira no calendário.
```

## Resumo

- Múltiplo: está na tabuada. Divisor: divide sem resto.
- Divisível por 3 ou por 9: olhe a soma dos algarismos.
- Primo tem só dois divisores. O 1 não é primo; o 2 é o único primo par.
- MMC: todos os primos, com o maior expoente. Serve para coincidências.
- MDC: só os primos comuns, com o menor expoente. Serve para repartir no maior tamanho sem sobra.
- MMC é maior ou igual aos números; MDC é menor ou igual.

## Para aprofundar

- [Múltiplos, divisores e números primos](/trilhas/matematica-fundamental/multiplos-divisores-e-numeros-primos)
- [Frações e decimais](/trilhas/enem-matematica-fundamentos/fracoes-e-decimais)
- [Potências, raízes e notação científica](/trilhas/enem-matematica-fundamentos/potencias-raizes-e-notacao-cientifica)
- [Áreas de figuras planas](/trilhas/enem-matematica-geometria/areas-de-figuras-planas)
