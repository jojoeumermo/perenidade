---
titulo: "Função afim"
resumo: "Valor fixo mais um tanto por unidade: a função que descreve corridas, contas, salários com comissão e reservatórios, e o seu gráfico, a reta."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Matriz de Referência do Enem"
    autor: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (Inep)"
  - titulo: "Algebra and Trigonometry 2e, seção 4.1, Linear Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/4-1-linear-functions"
  - titulo: "Algebra and Trigonometry 2e, seção 4.2, Modeling with Linear Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/4-2-modeling-with-linear-functions"
quiz:
  - pergunta: "Em f(x) = 3x + 12, o que o número 12 representa no gráfico?"
    opcoes: ["o ponto em que a reta corta o eixo vertical", "a inclinação da reta", "o ponto em que a reta corta o eixo horizontal", "o valor máximo da função"]
    resposta: 0
    explicacao: "Com x = 0, f(0) = 12. O b é o valor inicial: é onde a reta corta o eixo vertical. A inclinação é o 3, o número que multiplica o x."
  - pergunta: "Uma reta passa pelos pontos (1, 5) e (3, 11). Qual é a taxa de variação dessa função afim?"
    opcoes: ["6", "2", "3", "8"]
    resposta: 2
    explicacao: "a = (11 − 5) ÷ (3 − 1) = 6 ÷ 2 = 3. Quem marca 6 esqueceu de dividir pela variação de x."
  - pergunta: "Qual é o zero da função f(x) = 2x − 10?"
    opcoes: ["−5", "10", "2", "5"]
    resposta: 3
    explicacao: "O zero é o x que faz f(x) = 0: 2x − 10 = 0, então 2x = 10 e x = 5. Confira: 2 × 5 − 10 = 0."
  - pergunta: "A função f(x) = −4x + 20 é:"
    opcoes: ["crescente, porque o 20 é positivo", "decrescente, porque o −4 é negativo", "constante", "uma parábola"]
    resposta: 1
    explicacao: "Quem decide se a reta sobe ou desce é o a, o número do x. Aqui a = −4: a cada passo em x, o valor cai 4. A reta desce."
---

```provocacao
Um eletricista cobra R$ 80 pela visita mais R$ 50 por hora de serviço. Outro não cobra visita, mas cobra R$ 70 por hora. Para um serviço que você não sabe quanto vai durar, qual dos dois sai mais barato?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer uma função afim, entender o que cada número da lei quer dizer, montar a lei a partir de um texto, de uma tabela ou de dois pontos, achar o zero da função e comparar duas retas para decidir entre duas propostas.

## Um valor fixo e um tanto por unidade

Muita conta do dia a dia tem duas partes. Uma parte fixa, que se paga de qualquer jeito. E uma parte que cresce com o uso: por hora, por quilômetro, por quilo. O primeiro eletricista é assim: R$ 80 fixos e R$ 50 por hora. Para h horas, o preço é:

```formula
f(x) = ax + b
a é a taxa de variação: quanto o valor muda a cada unidade de x
b é o valor inicial: quanto a função vale quando x é zero
no eletricista: f(h) = 50h + 80, com a = 50 reais por hora e b = 80 reais
```

Essa é a **função afim** (também chamada de função do 1º grau). Ler a lei pelos papéis do a e do b é mais útil do que decorar nomes. Mesmo assim, a prova usa estes:

- **a**: taxa de variação, também chamada de coeficiente angular.
- **b**: valor inicial, também chamado de coeficiente linear.

Quando b = 0, a função é **linear**: as grandezas são diretamente proporcionais. Dobrar o x dobra o y. Com b diferente de zero, isso não vale. No primeiro eletricista, 2 horas custam 180 reais e 4 horas custam 280 reais, não 360.

## O gráfico é uma reta

Na função afim, cada passo de 1 em x muda o y sempre o mesmo tanto, o a. Por isso o gráfico é uma reta. Veja o primeiro eletricista em tabela:

| horas | 0 | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- | --- |
| preço (R$) | 80 | 130 | 180 | 230 | 280 |

Em palavras: a reta começa em 80 no eixo vertical e sobe 50 a cada hora.

- **a positivo:** a reta sobe da esquerda para a direita. A função é crescente.
- **a negativo:** a reta desce. A função é decrescente.
- **a igual a zero:** a reta é horizontal. A função é constante.
- **b:** é o ponto em que a reta corta o eixo vertical.

## A lei a partir de dois pontos

Muitas vezes a questão não dá a lei. Ela dá dois valores e diz que a variação é constante. Então:

1. Calcule a taxa: a = (y₂ − y₁) ÷ (x₂ − x₁).
2. Use um dos pontos para achar o b.

Exemplo: um botijão de gás tem 13 kg de gás. Uma família percebe que, depois de 10 dias, sobram 9 kg (é um exemplo). Supondo um consumo constante, a = (9 − 13) ÷ (10 − 0) = −0,4 kg por dia, e b = 13. A lei é g(d) = −0,4d + 13.

## O zero da função

O **zero** (ou raiz) é o valor de x que faz a função dar zero. No gráfico, é onde a reta corta o eixo horizontal. Basta resolver ax + b = 0, o que dá x = −b ÷ a.

No botijão: −0,4d + 13 = 0, então 0,4d = 13 e d = 13 ÷ 0,4 = 32,5. O gás acaba em 32 dias e meio. Na prova, o zero responde a perguntas como "quando o reservatório esvazia" ou "a partir de quantas unidades a empresa deixa de ter prejuízo".

```verificar
Um vendedor ganha R$ 1.500 fixos mais 5% sobre o que vende. Num mês em que vendeu R$ 4.000, quanto ganhou?
- R$ 1.505
+ R$ 1.700
- R$ 2.000
> 5% de 4.000 é 200. O salário é a parte fixa mais a comissão: 1.500 + 200 = 1.700.
```

## Comparar duas retas

Para comparar duas propostas, monte as duas leis e iguale. O ponto em que as retas se cruzam é onde as duas custam o mesmo. Antes e depois dele, uma é mais barata que a outra.

```navidareal
Aplicativos de corrida e taxistas costumam cobrar uma parte fixa e uma parte por quilômetro, às vezes também por minuto. Contas de luz e de água, salários com comissão e planos de celular com franquia também misturam um valor fixo com um valor por unidade.

Toda vez que você ouvir "tanto de saída mais tanto por unidade", há uma função afim escondida. Saber montá-la ajuda a comparar ofertas antes de fechar negócio.
```

## Exemplo resolvido

**Volte aos eletricistas da provocação. A partir de quantas horas o primeiro sai mais barato?**

1. Primeiro eletricista: P₁(h) = 80 + 50h. Segundo: P₂(h) = 70h.
2. Iguale: 80 + 50h = 70h. Então 80 = 70h − 50h = 20h, e h = 80 ÷ 20 = 4 horas.
3. Com 4 horas, os dois cobram o mesmo: 80 + 200 = 280 e 70 × 4 = 280.
4. Teste antes e depois. Com 2 horas: P₁ = 180 e P₂ = 140; o segundo é mais barato. Com 6 horas: P₁ = 380 e P₂ = 420; o primeiro é mais barato.

| horas | 2 | 4 | 6 |
| --- | --- | --- | --- |
| primeiro (R$) | 180 | 280 | 380 |
| segundo (R$) | 140 | 280 | 420 |

Em palavras: a reta do segundo começa mais baixa, em zero, mas é mais inclinada. As retas se cruzam em 4 horas. Para serviços curtos, o segundo compensa; para serviços de mais de 4 horas, o primeiro.

## Como isso cai no ENEM

- **Formatos:** comparação de planos, tarifas e orçamentos; salário fixo mais comissão; reservatório que enche ou esvazia em ritmo constante; conversão entre escalas, como graus Celsius e Fahrenheit; uma reta no plano cartesiano para identificar a lei; tendências que crescem um tanto por ano.
- **Habilidades:** H19 (identificar a expressão algébrica que traduz a relação entre grandezas), H20 (interpretar gráficos cartesianos que relacionam grandezas), H21 (resolver problemas cuja modelagem pede álgebra), H22 (usar álgebra para construir argumentos) e H23 (avaliar propostas de intervenção usando álgebra). Nas provas de 2022 e 2023, classificadas pelo instituto, a função afim foi o tópico de 2 das 81 questões de Matemática (2,5%). Ela também aparece por dentro de outros tópicos, como a leitura de gráficos. Na área inteira, a H21 apareceu em 7 dessas 81 questões e a H19 em 2. São só duas provas: é tendência, não promessa.
- **Armadilhas:**
  - Usar regra de três (proporção) quando há uma parte fixa. Com b diferente de zero, dobrar x não dobra y.
  - Trocar o a e o b na hora de montar a lei.
  - Esquecer o sinal negativo da taxa quando a grandeza diminui.
  - Dividir pela variação de y em vez da variação de x.
  - Dar a resposta em "tempo depois do começo" quando a pergunta pede o horário.

## Questão comentada

**Texto-base.** Para uma manutenção, o registro de saída do reservatório de uma escola foi aberto, e a água começou a sair num ritmo constante. Às 8 h, o reservatório tinha 2.400 litros; às 11 h, tinha 1.800 litros.

**Comando.** Mantido o mesmo ritmo, o reservatório ficará vazio às

A) 20 h.
B) 14 h.
C) 9 h.
D) 23 h.
E) 17 h.

**Resolução.**

1. Taxa: (1.800 − 2.400) ÷ (11 − 8) = −600 ÷ 3 = −200 litros por hora.
2. Às 11 h ainda há 1.800 litros. Para esvaziar, faltam 1.800 ÷ 200 = 9 horas.
3. 11 h + 9 h = 20 h.
4. Conferência pelo começo: às 8 h havia 2.400 litros, e 2.400 ÷ 200 = 12 horas. 8 h + 12 h = 20 h.

**Gabarito: A.**

**Por que as outras não:**

- B) 14 h: a queda de 600 litros em 3 horas foi usada como se fosse por hora (1.800 ÷ 600 = 3, e 11 + 3 = 14). Divida a queda pelo tempo para achar a taxa: 200 litros por hora.
- C) 9 h: 9 é quanto tempo falta a partir das 11 h, não o horário. Some ao horário de partida.
- D) 23 h: as 12 horas do esvaziamento completo foram somadas às 11 h. Elas contam a partir das 8 h, quando o reservatório tinha 2.400 litros.
- E) 17 h: as 9 horas que faltam foram somadas às 8 h. Elas contam a partir das 11 h, quando ainda havia 1.800 litros.

```realidade
Procure um serviço que você usa e que cobra uma parte fixa mais um tanto por unidade (corrida, conta, recarga, mensalidade com extra). Escreva a lei do custo, f(x) = ax + b, dizendo o que é o x. Quanto você pagaria usando o dobro? O valor dobra?
```

## Resumo

- Função afim: f(x) = ax + b. O a é a taxa de variação; o b é o valor inicial.
- O gráfico é uma reta: sobe se a > 0, desce se a < 0, é horizontal se a = 0.
- Com b = 0, as grandezas são proporcionais. Com b ≠ 0, dobrar x não dobra y.
- Lei por dois pontos: a = (y₂ − y₁) ÷ (x₂ − x₁); depois, ache o b com um dos pontos.
- Zero da função: x = −b ÷ a, onde a reta corta o eixo horizontal.
- Para comparar propostas, iguale as leis: o cruzamento é onde valem o mesmo.

## Para aprofundar

- [Função do 1º grau](/trilhas/matematica-medio/funcao-do-1-grau)
- [Equações do 1º grau](/trilhas/matematica-fundamental/equacoes-do-1-grau)
- [Razão e proporção](/trilhas/matematica-fundamental/razao-e-proporcao)
- [Função e leitura de gráficos](/trilhas/enem-matematica-funcoes-e-algebra/funcoes-e-graficos)
- [Função quadrática: vértice, máximo e mínimo](/trilhas/enem-matematica-funcoes-e-algebra/funcao-quadratica)
