---
titulo: "Inequações"
resumo: "Resolver desigualdades como se fossem equações, com o cuidado de inverter o sinal ao multiplicar ou dividir por negativo, e responder perguntas de 'no mínimo', 'no máximo' e 'a partir de quanto'."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Elementary Algebra 2e, seção 2.7, Solve Linear Inequalities"
    autor: "Lynn Marecek, MaryAnne Anthony-Smith, Andrea Honeycutt Mathis (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/elementary-algebra-2e/pages/2-7-solve-linear-inequalities"
  - titulo: "Algebra and Trigonometry 2e, seção 2.7, Linear Inequalities and Absolute Value Inequalities"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/2-7-linear-inequalities-and-absolute-value-inequalities"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Qual é a solução de 2x + 1 > 9?"
    opcoes: ["x < 4", "x > 5", "x > 10", "x > 4"]
    resposta: 3
    explicacao: "Tire 1 dos dois lados: 2x > 8. Divida por 2, que é positivo: o sinal fica como está, x > 4."
  - pergunta: "Qual é a solução de −3x ≤ 12?"
    opcoes: ["x ≤ −4", "x ≥ −4", "x ≥ 4", "x ≤ 4"]
    resposta: 1
    explicacao: "Divida os dois lados por −3. Ao dividir por um número negativo, o sinal da desigualdade se inverte: x ≥ −4. Confira com x = 0: −3 × 0 = 0, que é menor que 12. E 0 é mesmo maior que −4."
  - pergunta: "Quantos números inteiros satisfazem 1 < x ≤ 5?"
    opcoes: ["4", "5", "3", "6"]
    resposta: 0
    explicacao: "O 1 não entra (o sinal é <) e o 5 entra (o sinal é ≤). Sobram 2, 3, 4 e 5: quatro números."
  - pergunta: "Com R$ 50,00, qual é o maior número de cadernos de R$ 7,00 que dá para comprar?"
    opcoes: ["8", "6", "7", "7,14"]
    resposta: 2
    explicacao: "7x ≤ 50, então x ≤ 50 ÷ 7, que dá pouco mais de 7. Como não se compra parte de um caderno, o maior inteiro é 7. Oito cadernos custariam R$ 56,00."
---

```provocacao
Um salário de R$ 1.500,00 precisa durar 30 dias. As contas fixas levam R$ 900,00. Quanto dá para gastar por dia, no máximo, sem terminar o mês no vermelho? A resposta não é um número só: é uma faixa de valores.
```

## O que você vai aprender

Ao fim desta aula você vai ler e escrever desigualdades, resolver inequações do 1º grau, saber quando o sinal se inverte e transformar perguntas de "no mínimo", "no máximo" e "a partir de quanto" em inequações. E vai saber escolher a resposta inteira certa.

## Desigualdade: o que é maior, o que é menor

Uma equação diz que duas coisas são iguais. Uma **inequação** diz que uma coisa é maior ou menor que outra. Quatro símbolos fazem esse trabalho:

- **x > 4**: x é maior que 4. O 4 não serve.
- **x ≥ 4**: x é maior que 4 ou igual a 4. O 4 serve.
- **x < 4**: x é menor que 4.
- **x ≤ 4**: x é menor que 4 ou igual a 4.

Para lembrar: a abertura do símbolo fica sempre virada para o número maior.

A resposta de uma inequação quase nunca é um número só. É um conjunto de números: todos os maiores que 4, por exemplo. Na reta, isso aparece como uma semirreta, com uma bolinha vazia no 4 (quando ele não entra) ou cheia (quando entra).

## Resolver como uma equação

A boa notícia: quase tudo o que você sabe de equação vale aqui. Pode somar ou subtrair o mesmo número dos dois lados. Pode multiplicar ou dividir os dois lados pelo mesmo número **positivo**. A desigualdade continua verdadeira.

Em 2x + 1 > 9: tire 1 dos dois lados, 2x > 8; divida por 2, x > 4. Confira com um número da resposta, como 5: 2 × 5 + 1 = 11, que é mesmo maior que 9. E com um que está fora, como 3: 2 × 3 + 1 = 7, que não é maior que 9.

## A única regra nova: negativo inverte o sinal

```formula
se a < b, então −a > −b
multiplicar ou dividir os dois lados por um número negativo inverte o sinal da desigualdade
somar e subtrair nunca invertem; multiplicar ou dividir por positivo também não
```

Por quê? Pegue uma verdade simples: 2 < 5. Multiplique os dois lados por −1: −2 e −5. Agora quem é maior? Na reta, −2 está mais perto do zero, mais à direita: −2 > −5. O sinal precisou virar para a frase continuar verdadeira.

Exemplo: −2x + 4 ≥ 10. Tire 4: −2x ≥ 6. Divida por −2 e inverta: x ≤ −3. Confira com x = −4: −2 × (−4) + 4 = 12, que é maior ou igual a 10. Serve.

Se quiser fugir da regra, passe o termo com x para o lado em que ele fica positivo. Em −2x ≥ 6, some 2x e tire 6 dos dois lados: −6 ≥ 2x, ou seja, −3 ≥ x. É a mesma resposta.

## Respostas inteiras: no mínimo, no máximo, a partir de

Na prova, a inequação quase sempre vem de uma situação com quantidades inteiras: pessoas, caixas, minutos, cadernos. A conta dá um limite, e você escolhe o inteiro certo dentro dele.

- **"No máximo", "cabe", "suporta", "o dinheiro dá":** a resposta é o maior inteiro dentro do limite. x ≤ 20,8 dá 20.
- **"No mínimo", "pelo menos", "para atingir":** a resposta é o menor inteiro dentro do limite. x ≥ 6,5, se só valem inteiros, dá 7.
- **"A partir de quanto é mais vantajoso":** atenção ao empate. Se x > 50, o 50 é o ponto em que as duas opções custam o mesmo; a vantagem começa no 51.

Também aparecem faixas, com duas desigualdades juntas: 18 ≤ T ≤ 26 quer dizer que T fica entre 18 e 26, incluindo os dois. Resolva fazendo a mesma operação nas três partes.

```navidareal
Volte ao salário. Gasto por dia: d. Em 30 dias, 30d. Com as contas fixas: 30d + 900 ≤ 1.500. Tire 900: 30d ≤ 600. Divida por 30: d ≤ 20.

Dá para gastar até R$ 20,00 por dia. Qualquer valor nessa faixa fecha o mês; um dia de R$ 30,00 pede dois dias de R$ 15,00 depois. A inequação não diz quanto gastar: diz até onde dá para ir.
```

```verificar
Ao dividir os dois lados de −2x > 6 por −2, a inequação fica:
+ x < −3
- x > −3
- x > 3
> Dividir por um número negativo inverte o sinal. Confira com x = −4: −2 × (−4) = 8, que é maior que 6.
```

## Exemplo resolvido

**Numa escola, a média de três provas precisa ser pelo menos 6,0 para aprovação direta. Uma estudante tirou 6,0 e 5,5 nas duas primeiras. Qual nota, no mínimo, ela precisa tirar na terceira?**

1. Nomeie: x = nota da terceira prova.
2. Média: (6,0 + 5,5 + x) ÷ 3 ≥ 6,0.
3. Multiplique os dois lados por 3 (positivo, o sinal fica): 11,5 + x ≥ 18.
4. Tire 11,5: x ≥ 6,5.
5. Ela precisa tirar pelo menos 6,5.

Confira: com 6,5, a soma é 18 e a média é exatamente 6,0. Serve, porque o sinal é ≥. Com 6,4, a média fica abaixo de 6,0.

## Como isso cai no ENEM

- **Formatos:** escolha entre planos ou orçamentos ("a partir de quantos minutos o plano A é mais barato"), limite de carga de elevador ou de caminhão, nota mínima para atingir uma média, faixas de temperatura ou de consumo, orçamento máximo. A inequação raramente vem escrita: aparece nas palavras "no mínimo", "no máximo", "não pode passar de".
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma das 81 questões de Matemática foi classificada diretamente neste tópico; os conhecimentos algébricos, como um todo, tiveram 11 (13,6%). São só duas edições: um tópico sem questão nessa base pode aparecer em outra prova.
- **Habilidades:** H21 (resolver problemas cuja modelagem pede álgebra), com 7 das 81 questões nessa base, e H23 (avaliar propostas de intervenção usando álgebra), quando a questão pede para escolher a opção mais vantajosa.
- **Armadilhas:**
  - Esquecer de inverter o sinal ao multiplicar ou dividir por negativo.
  - Arredondar para o lado errado: "no máximo" pede o inteiro de baixo; "no mínimo", o de cima.
  - Marcar o ponto de empate quando a pergunta pede a partir de quando uma opção é melhor.
  - Confundir < com ≤ e esquecer se o próprio limite entra.

## Questão comentada

**Texto-base.** Uma associação de moradores vai contratar um plano de telefone para a sede. No plano A, paga-se R$ 40,00 por mês mais R$ 0,20 por minuto. No plano B, paga-se R$ 25,00 por mês mais R$ 0,50 por minuto. Os valores são de um exemplo.

**Comando.** O plano A passa a ser mais barato que o plano B, num mês, a partir de um consumo de

A) 51 minutos.
B) 50 minutos.
C) 22 minutos.
D) 5 minutos.
E) 30 minutos.

**Resolução.**

1. Nomeie: x = minutos no mês. Plano A: 40 + 0,2x. Plano B: 25 + 0,5x.
2. A mais barato que B: 40 + 0,2x < 25 + 0,5x.
3. Tire 0,2x e 25 dos dois lados: 15 < 0,3x.
4. Divida por 0,3 (positivo, o sinal fica): x > 50.
5. Com 50 minutos, os dois custam o mesmo (R$ 50,00). O plano A fica mais barato a partir de 51 minutos.

**Gabarito: A.**

**Por que as outras não:**

- B) 50 minutos: é o ponto de empate. Com 50 minutos, os dois planos custam R$ 50,00. A pergunta pede quando A passa a ser mais barato.
- C) 22 minutos: os preços por minuto foram somados (15 ÷ 0,7 ≈ 21,4). Na inequação, o 0,2x muda de lado e é subtraído: 0,5 − 0,2 = 0,3.
- D) 5 minutos: os 15 foram multiplicados por 0,3 (4,5, arredondado para 5). Para isolar o x, divida por 0,3.
- E) 30 minutos: 15 foi dividido só pelo 0,5 do plano B. A diferença entre os preços por minuto é 0,3.

```realidade
Escolha uma decisão de consumo da sua vida com duas opções: comprar à vista ou a prazo, um plano de celular ou outro, ir de ônibus ou de aplicativo. Escreva uma inequação para descobrir a partir de que ponto uma opção fica mais vantajosa. A conta confirma o que você já fazia?
```

## Resumo

- >, ≥, <, ≤: a abertura do símbolo fica virada para o maior.
- Resolva como equação: some, subtraia, multiplique e divida os dois lados.
- Multiplicar ou dividir por negativo inverte o sinal.
- A resposta é uma faixa de valores. Confira com um número de dentro e um de fora.
- "No máximo": maior inteiro da faixa. "No mínimo": menor inteiro. "A partir de": cuidado com o empate.

## Para aprofundar

- [Equações do 1º grau](/trilhas/enem-matematica-fundamentos/equacoes-do-1-grau)
- [Conjuntos e intervalos](/trilhas/matematica-medio/conjuntos-e-intervalos)
- [Função afim](/trilhas/enem-matematica-funcoes-e-algebra/funcao-afim)
- [Operações com inteiros e racionais](/trilhas/enem-matematica-fundamentos/operacoes-com-inteiros-e-racionais)
