---
titulo: "Equações do 1º grau"
resumo: "Resolver equações mantendo a balança equilibrada, com parênteses e frações, e transformar o texto de uma questão em equação: preço, idade, divisão, lucro."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Prealgebra 2e, seção 2.3, Solving Equations Using the Subtraction and Addition Properties of Equality"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/2-3-solving-equations-using-the-subtraction-and-addition-properties-of-equality"
  - titulo: "Prealgebra 2e, seção 8.3, Solve Equations with Variables and Constants on Both Sides"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/8-3-solve-equations-with-variables-and-constants-on-both-sides"
  - titulo: "Prealgebra 2e, seção 2.2, Evaluate, Simplify, and Translate Expressions"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/prealgebra-2e/pages/2-2-evaluate-simplify-and-translate-expressions"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é o valor de x em 3x + 5 = 20?"
    opcoes: ["25/3", "15", "5", "45"]
    resposta: 2
    explicacao: "Tire 5 dos dois lados: 3x = 15. Divida os dois lados por 3: x = 5. Confira: 3 × 5 + 5 = 20."
  - pergunta: "Qual é o valor de x em 2(x − 4) = 10?"
    opcoes: ["9", "7", "3", "14"]
    resposta: 0
    explicacao: "Divida os dois lados por 2: x − 4 = 5. Some 4: x = 9. Quem chegou a 7 multiplicou o 2 só pelo x, esquecendo o 4."
  - pergunta: "Qual é o valor de x em x/3 + 2 = 6?"
    opcoes: ["4/3", "24", "8", "12"]
    resposta: 3
    explicacao: "Tire 2 dos dois lados: x/3 = 4. Multiplique os dois lados por 3: x = 12. Confira: 12 ÷ 3 + 2 = 6."
  - pergunta: "A soma de um número com o seu dobro é 42. Que número é esse?"
    opcoes: ["21", "14", "40", "84"]
    resposta: 1
    explicacao: "O número é x e o dobro é 2x: x + 2x = 42, então 3x = 42 e x = 14. Confira: 14 + 28 = 42. O 21 é a metade de 42, o que valeria para 'o número e ele mesmo'."
---

```provocacao
Um entregador recebe R$ 40,00 fixos por dia e mais R$ 6,00 por entrega. Hoje ele precisa juntar R$ 160,00 para pagar uma conta. Quantas entregas precisa fazer? Dá para descobrir sem ir testando número por número?
```

## O que você vai aprender

Ao fim desta aula você vai resolver equações do 1º grau, inclusive com parênteses, com a incógnita dos dois lados e com frações, e vai transformar uma situação descrita em palavras numa equação. No fim, vai conferir a resposta substituindo na equação.

## A balança

Uma **equação** é uma igualdade com um valor desconhecido, a **incógnita**, que costuma ser escrita como x. Em 3x + 5 = 20, a pergunta é: que número, vezes 3 e mais 5, dá 20?

Pense numa balança de dois pratos, equilibrada. Num prato estão três sacos iguais de peso desconhecido e mais 5 kg. No outro, 20 kg. Se você tira 5 kg de um prato, precisa tirar 5 kg do outro, ou a balança desequilibra. Sobra: três sacos de um lado e 15 kg do outro. Cada saco pesa 5 kg.

Essa é a regra de ouro: **o que você faz de um lado, faz do outro.** Pode somar, subtrair, multiplicar ou dividir (menos por zero), desde que seja nos dois lados ao mesmo tempo.

## Desfazer na ordem contrária

Para isolar o x, desfaça as operações que estão "presas" a ele, na ordem contrária à da conta. Em 3x + 5 = 20, o x foi multiplicado por 3 e depois somado a 5. Desfaça primeiro a soma, depois a multiplicação:

1. 3x + 5 = 20
2. Tire 5 dos dois lados: 3x = 15
3. Divida os dois lados por 3: x = 5

O atalho que muita gente aprende, "passa para o outro lado trocando o sinal", é só um resumo desse passo. Somar vira subtrair, multiplicar vira dividir. Mas o atalho sem a ideia da balança engana: o 3 de 3x não "passa subtraindo", ele passa dividindo, porque está multiplicando.

## O x dos dois lados e os parênteses

Quando há x dos dois lados, junte os x num lado e os números no outro. Em 5x − 3 = 2x + 9:

1. Tire 2x dos dois lados: 3x − 3 = 9
2. Some 3 dos dois lados: 3x = 12
3. Divida por 3: x = 4

Com parênteses, distribua a multiplicação para cada termo de dentro. 3(x + 2) = 3x + 6, e não 3x + 2. O sinal de menos antes do parêntese troca o sinal de tudo o que está dentro: −2(x − 2) = −2x + 4.

## Equações com frações

Frações assustam, mas há um truque: multiplique a equação inteira, os dois lados e todos os termos, pelo MMC dos denominadores. As frações somem.

Em x/4 + x/6 = 5, o MMC de 4 e 6 é 12. Multiplicando tudo por 12: 3x + 2x = 60. Então 5x = 60 e x = 12.

O cuidado é multiplicar **todos** os termos, inclusive os que não têm fração. Esquecer o 5 do lado direito daria 5x = 5, um erro comum.

```formula
ax + b = c   →   x = (c − b) ÷ a
desfaça primeiro a soma ou a subtração, depois a multiplicação ou a divisão
o que se faz de um lado da igualdade se faz do outro
```

## Do texto para a equação

Na prova, a equação está escondida no texto. Um roteiro em quatro passos:

1. **Nomeie a incógnita.** Escreva "x = número de entregas" ou "x = preço da camiseta". Escolha como x o que a questão pergunta, se der.
2. **Escreva as outras quantidades em função de x.** "O dobro" é 2x; "R$ 100,00 a mais" é x + 100; "a metade" é x/2.
3. **Ache a igualdade.** Procure o que é igual a quê: o total pago, a soma das partes, o lucro desejado.
4. **Resolva e responda o que foi perguntado.** Muitas vezes a questão pede outra quantidade, que depende do x.

Depois, confira substituindo o valor no texto, e não só na equação. Se a equação foi montada errada, ela pode "dar certo" e a resposta continuar errada.

```navidareal
Volte ao entregador. x = número de entregas. O que ele ganha é 40 + 6x. Ele quer 160: 40 + 6x = 160. Tire 40: 6x = 120. Divida por 6: x = 20 entregas.

Confira: 20 × 6 = 120, mais 40 fixos, dá 160. A equação mostra, antes de o dia começar, quanto trabalho a conta exige. É o tipo de conta que ajuda a negociar o valor por entrega.
```

```verificar
Qual é o valor de x em 5x − 3 = 2x + 9?
+ 4
- 2
- 12/7
> Junte os x de um lado (5x − 2x = 3x) e os números do outro (9 + 3 = 12). Então 3x = 12 e x = 4.
```

## Exemplo resolvido

**Num bazar de uma igreja, uma pessoa comprou 3 camisetas de mesmo preço e uma bermuda de R$ 25,00. Pagou R$ 85,00 no total. Quanto custou cada camiseta?**

1. Nomeie: x = preço de uma camiseta.
2. Total: 3x + 25 = 85.
3. Tire 25 dos dois lados: 3x = 60.
4. Divida por 3: x = 20. Cada camiseta custou R$ 20,00.

Confira no texto: 3 camisetas de R$ 20,00 são R$ 60,00; com a bermuda, R$ 85,00. Bate.

## Como isso cai no ENEM

- **Formatos:** comparação de planos e tarifas (quando dois planos custam o mesmo), divisão de um valor com condições ("um recebe R$ 100,00 a mais"), idade, lucro de uma pequena produção, receitas e misturas. A equação raramente vem escrita: é preciso montá-la a partir do texto ou de uma tabela.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma das 81 questões de Matemática foi classificada diretamente no tópico de equações do 1º grau; os conhecimentos algébricos, como um todo, tiveram 11 (13,6%). Equações aparecem como passo dentro de questões de funções e de números; essa ligação é leitura do instituto, não contagem.
- **Habilidades:** H21 (resolver problemas cuja modelagem pede álgebra), com 7 das 81 questões nessa base, e H19 (identificar a expressão algébrica que traduz a relação entre grandezas), com 2.
- **Armadilhas:**
  - Distribuir a multiplicação só para o primeiro termo do parêntese.
  - "Passar" um número que multiplica como se ele estivesse somando.
  - Multiplicar por MMC só os termos com fração.
  - Responder o valor de x quando a questão pede outra quantidade (a idade da mãe, a parte do terceiro irmão).
  - Montar a equação com a informação ao contrário ("tem 5 a menos" virar + 5).

## Questão comentada

**Texto-base.** Uma operadora oferece dois planos de telefone. No plano A, paga-se R$ 30,00 por mês mais R$ 0,50 por minuto de ligação. No plano B, paga-se R$ 54,00 por mês, com minutos ilimitados. Os valores são de um exemplo.

**Comando.** Os dois planos custam o mesmo valor, num mês, para um consumo de

A) 108 minutos.
B) 168 minutos.
C) 12 minutos.
D) 60 minutos.
E) 48 minutos.

**Resolução.**

1. Nomeie: x = minutos de ligação no mês.
2. Custo do plano A: 30 + 0,5x. Custo do plano B: 54.
3. Iguale: 30 + 0,5x = 54.
4. Tire 30 dos dois lados: 0,5x = 24.
5. Divida por 0,5 (o mesmo que multiplicar por 2): x = 48.
6. Confira: 48 × 0,50 = 24; 30 + 24 = 54.

**Gabarito: E.**

**Por que as outras não:**

- A) 108 minutos: os R$ 54,00 foram divididos por 0,50 sem descontar a parte fixa de R$ 30,00 do plano A.
- B) 168 minutos: as mensalidades foram somadas (30 + 54) antes de dividir. A parte fixa do plano A tem de ser subtraída, não somada.
- C) 12 minutos: 24 foi multiplicado por 0,5. O 0,5 está multiplicando o x; para desfazer, divida por 0,5.
- D) 60 minutos: só a parte fixa do plano A foi dividida por 0,50. A igualdade envolve os R$ 54,00 do plano B.

```realidade
Pegue uma conta sua que tenha parte fixa e parte por uso (celular, luz, água, aplicativo de transporte). Monte a equação "quanto preciso usar para a conta chegar a R$ 100,00?" e resolva. O resultado é mais ou menos do que você costuma usar?
```

## Resumo

- Equação é uma balança: o que se faz de um lado se faz do outro.
- Desfaça as operações na ordem contrária: primeiro soma e subtração, depois multiplicação e divisão.
- x dos dois lados: junte os x num lado e os números no outro.
- Parênteses: distribua para todos os termos; menos antes troca todos os sinais.
- Frações: multiplique todos os termos pelo MMC dos denominadores.
- Do texto: nomeie x, escreva o resto em função de x, ache a igualdade, responda o que foi pedido e confira no texto.

## Para aprofundar

- [Equações do 1º grau](/trilhas/matematica-fundamental/equacoes-do-1-grau)
- [Expressões numéricas](/trilhas/enem-matematica-fundamentos/expressoes-numericas)
- [Inequações](/trilhas/enem-matematica-fundamentos/inequacoes)
- [Sistemas lineares](/trilhas/enem-matematica-fundamentos/sistemas-lineares)
- [Função afim](/trilhas/enem-matematica-funcoes-e-algebra/funcao-afim)
